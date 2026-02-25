// Express 路由
import express from 'express';
import { getInstanceService } from './instance-service.js';
import { authenticate, optionalAuth, requireAdmin, generateToken, generateRefreshToken, verifyToken, authenticateSharedSecret, authenticateEither, generateSignature, type AuthenticatedRequest } from './auth.js';
import { getPortainerClient } from './portainer.js';
import { instanceDb, hostCacheDb, type InstanceSource } from './database.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { z } from 'zod';
import { validateCustomInstance, performHealthCheck, type RegisterCustomInstanceInput } from './health-check.js';
import { getCasdoorService } from './casdoor.js';

const router = express.Router();
const instanceService = getInstanceService();

// ============ 认证路由 ============

// Casdoor OAuth 登录入口
router.get('/auth/casdoor/login', async (req, res) => {
  try {
    const casdoor = getCasdoorService();
    if (!casdoor) {
      return res.status(501).json({ error: 'Casdoor is not configured' });
    }

    const redirect = req.query.redirect as string;
    const authUrl = casdoor.getAuthorizationUrl(redirect);

    res.redirect(authUrl);
  } catch (error) {
    logger.error('Casdoor login failed', { error });
    res.status(500).json({ error: 'Failed to initiate Casdoor login' });
  }
});

// Casdoor OAuth 回调
router.get('/auth/casdoor/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    const casdoor = getCasdoorService();
    if (!casdoor) {
      return res.status(501).json({ error: 'Casdoor is not configured' });
    }

    // 处理回调，获取用户信息
    const { user, originalRedirect } = await casdoor.handleCallback(code as string, state as string);

    // 生成本地 JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      plan: 'basic', // TODO: 从 Casdoor attributes 中获取
    });

    const refreshToken = generateRefreshToken(user.id);

    // 跳转到前端，携带 token
    const frontendUrl = originalRedirect || `${config.FRONTEND_URL || 'http://localhost:3001'}/dashboard`;
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('refreshToken', refreshToken);

    logger.info('Casdoor callback successful, redirecting to frontend', {
      userId: user.id,
      redirectUrl: redirectUrl.toString(),
    });

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('Casdoor callback failed', { error });
    const errorUrl = new URL(`${config.FRONTEND_URL || 'http://localhost:3001'}/login`);
    errorUrl.searchParams.set('error', 'authentication_failed');
    errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Unknown error');
    res.redirect(errorUrl.toString());
  }
});

// Casdoor Token 验证（供前端调用）
router.post('/auth/casdoor/verify', express.json(), async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    const casdoor = getCasdoorService();
    if (!casdoor) {
      return res.status(501).json({ error: 'Casdoor is not configured' });
    }

    const verification = await casdoor.verifyToken(accessToken);

    if (!verification.active) {
      return res.status(401).json({ error: 'Token is not active' });
    }

    // 生成本地 JWT token
    const localToken = generateToken({
      userId: verification.sub || verification.user_id,
      email: verification.email,
      plan: verification.plan || 'basic',
    });

    res.json({
      token: localToken,
      user: {
        userId: verification.sub || verification.user_id,
        email: verification.email,
        name: verification.name,
      },
    });
  } catch (error) {
    logger.error('Casdoor token verification failed', { error });
    res.status(401).json({ error: 'Token verification failed' });
  }
});

// 登录（简化版，生产环境应使用 OAuth）
router.post('/auth/login', express.json(), async (req, res) => {
  try {
    const { email, password } = req.body;

    // TODO: 实现真实的密码验证
    // 目前简化为直接生成 token

    const userId = email.split('@')[0]; // 简化处理

    const token = generateToken({
      userId,
      email,
      plan: 'basic',
    });

    const refreshToken = generateRefreshToken(userId);

    res.json({
      token,
      refreshToken,
      expiresIn: 3600, // 1 小时
      userId,  // 返回 userId 供前端使用
      email,
    });
  } catch (error) {
    logger.error('Login failed', { error });
    res.status(500).json({ error: 'Login failed' });
  }
});

// 刷新 token
router.post('/auth/refresh', express.json(), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }

    const payload = verifyToken(refreshToken);

    // 生成新的 access token
    const token = generateToken({
      userId: payload.userId,
      email: payload.email || '',
      plan: payload.plan,
    });

    res.json({
      token,
      expiresIn: 3600,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ============ 实例管理路由 ============

// 创建实例（支持 JWT 或 Shared Secret 认证）
router.post('/instances', authenticateEither, express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(50).optional(),
      email: z.string().email(),
      plan: z.enum(['free', 'basic', 'pro', 'enterprise']).optional(),
    });

    const input = schema.parse(req.body);

    const result = await instanceService.create({
      userId: req.userId!,
      name: input.name,
      email: input.email,
      plan: input.plan,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    logger.error('Failed to create instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create instance' });
  }
});

// 获取当前用户的所有实例（支持 JWT 或 Shared Secret 认证）
router.get('/instances', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const instances = await instanceService.getInstancesByUser(req.userId!);
    res.json(instances);
  } catch (error) {
    logger.error('Failed to get instances', { error });
    res.status(500).json({ error: 'Failed to get instances' });
  }
});

// 通过 instance_id 获取实例（公开接口，用于路由查询）
router.get('/instances/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = await instanceService.getInstance(instanceId);

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    res.json(instance);
  } catch (error) {
    logger.error('Failed to get instance by ID', { error });
    res.status(500).json({ error: 'Failed to get instance' });
  }
});

// 删除实例（支持 JWT 或 Shared Secret 认证）
router.delete('/instances/:instanceId', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const { instanceId } = req.params;

    // 验证实例属于当前用户
    const instance = await instanceDb.getByInstanceId(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (instance.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await instanceService.deleteInstance(instanceId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete instance' });
  }
});

// 重启实例（支持 JWT 或 Shared Secret 认证）
router.post('/instances/:instanceId/restart', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const { instanceId } = req.params;

    // 验证实例属于当前用户
    const instance = await instanceDb.getByInstanceId(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (instance.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await instanceService.restartInstance(instanceId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to restart instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to restart instance' });
  }
});

// 更新实例名称
router.put('/instances/:instanceId', authenticateEither, express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const { instanceId } = req.params;
    const schema = z.object({
      name: z.string().min(1).max(50),
    });

    const input = schema.parse(req.body);

    // 验证实例属于当前用户
    const instance = await instanceDb.getByInstanceId(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (instance.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await instanceService.updateInstanceName(instanceId, input.name);
    res.json({ success: true, name: input.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    logger.error('Failed to update instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update instance' });
  }
});

// 获取实例日志（支持 JWT 或 Shared Secret 认证）
router.get('/instances/:instanceId/logs', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const { instanceId } = req.params;
    const tail = req.query.tail ? parseInt(req.query.tail as string) : 100;

    // 验证实例属于当前用户
    const instance = await instanceDb.getByInstanceId(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (instance.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logs = await instanceService.getLogs(instanceId, tail);
    res.type('text/plain').send(logs);
  } catch (error) {
    logger.error('Failed to get logs', { error });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// ============ 自定义实例路由 ============

// 接入自定义实例（支持 JWT 或 Shared Secret 认证）
router.post('/instances/custom', authenticateEither, express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(50),
      instanceType: z.enum(['cloud', 'hardware']),
      url: z.string().max(2048).optional(), // Allow empty string, will be validated based on instance type
      ip: z.string().ip().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      apiToken: z.string().optional(),
      healthCheckUrl: z.string().max(2048).optional(), // Allow empty string
      healthCheckInterval: z.number().int().min(10).default(60),
    });

    const input = schema.parse(req.body);

    // Validate based on instance type
    if (input.instanceType === 'cloud') {
      if (!input.url || input.url.trim() === '') {
        return res.status(400).json({ error: 'URL is required for cloud instances' });
      }
      // Validate URL format for cloud instances
      try {
        new URL(input.url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format for cloud instance' });
      }
    }
    if (input.instanceType === 'hardware') {
      if (!input.ip) {
        return res.status(400).json({ error: 'IP is required for hardware instances' });
      }
    }

    // Validate connection (healthCheckUrl is optional, can be empty)
    const validationInput: RegisterCustomInstanceInput = {
      name: input.name,
      instanceType: input.instanceType,
      url: input.instanceType === 'cloud' ? input.url : undefined,
      ip: input.instanceType === 'hardware' ? input.ip : undefined,
      port: input.port,
      apiToken: input.apiToken,
      healthCheckUrl: input.healthCheckUrl || undefined,
    };
    const validationResult = await validateCustomInstance(validationInput);
    if (!validationResult.urlValid && validationResult.error) {
      return res.status(400).json({ error: 'Connection validation failed', details: validationResult });
    }

    // Build custom URL
    let customUrl: string;
    if (input.instanceType === 'hardware') {
      customUrl = `http://${input.ip}:${input.port || 18789}`;
    } else {
      customUrl = input.url!;
    }

    // Create instance record
    const instanceId = `instance-${input.name}`;
    const source: InstanceSource = input.instanceType === 'hardware' ? 'hardware' : 'custom';

    await instanceDb.create({
      instance_id: instanceId,
      user_id: req.userId!,
      name: input.name,
      email: req.userEmail || '',
      plan: 'basic', // Custom instances don't use plan-based resources
      container_id: null,
      container_name: null,
      port: null,
      endpoint_id: null,
      gateway_token: input.apiToken || null,
      url: customUrl,
      custom_url: customUrl,
      health_check_url: input.healthCheckUrl || null,
      health_check_interval: input.healthCheckInterval,
      last_health_check: new Date(),
      is_healthy: validationResult.healthCheck,
      status: validationResult.healthCheck ? 'running' : 'stopped',
      source,
    });

    // Return created instance
    const instance = await instanceDb.getByInstanceId(instanceId);
    res.status(201).json(instance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    logger.error('Failed to register custom instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to register custom instance' });
  }
});

// 验证自定义实例连接（支持 JWT 或 Shared Secret 认证）
router.post('/instances/custom/validate', authenticateEither, express.json(), async (req: AuthenticatedRequest, res) => {
  try {
    const schema = z.object({
      instanceType: z.enum(['cloud', 'hardware']),
      url: z.string().max(2048).optional(), // Allow empty string, will be validated based on instance type
      ip: z.string().ip().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      apiToken: z.string().optional(),
      healthCheckUrl: z.string().max(2048).optional(), // Allow empty string
    });

    const input = schema.parse(req.body);

    // Validate based on instance type
    if (input.instanceType === 'cloud') {
      if (!input.url || input.url.trim() === '') {
        return res.status(400).json({ error: 'URL is required for cloud instances' });
      }
      try {
        new URL(input.url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // Build validation input with only relevant fields
    const validationInput: RegisterCustomInstanceInput = {
      name: 'validation',
      instanceType: input.instanceType,
      url: input.instanceType === 'cloud' ? input.url : undefined,
      ip: input.instanceType === 'hardware' ? input.ip : undefined,
      port: input.port,
      apiToken: input.apiToken,
      healthCheckUrl: input.healthCheckUrl || undefined,
    };

    const result = await validateCustomInstance(validationInput);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    logger.error('Failed to validate custom instance', { error });
    res.status(500).json({ error: 'Failed to validate connection' });
  }
});

// 健康检查（支持 JWT 或 Shared Secret 认证）
router.get('/instances/:instanceId/health', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const { instanceId } = req.params;

    const instance = await instanceDb.getByInstanceId(instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    if (instance.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isHealthy = await performHealthCheck(instance);
    res.json({
      instanceId,
      isHealthy,
      lastCheck: instance.last_health_check,
    });
  } catch (error) {
    logger.error('Failed to perform health check', { error });
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

// 局域网扫描（发现本地硬件盒子）
router.get('/instances/scan-local', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const subnet = (req.query.subnet as string) || '192.168.1';
    const port = parseInt((req.query.port as string) || '18789');
    const timeout = parseInt((req.query.timeout as string) || '1000');

    const devices: Array<{ ip: string; name: string; type: string }> = [];

    // Scan IP range (1-254)
    const scanPromises: Promise<void>[] = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      scanPromises.push(
        (async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`http://${ip}:${port}/health`, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              devices.push({
                ip,
                name: `Device-${i}`,
                type: 'hardware',
              });
            }
          } catch {
            // Ignore unreachable devices
          }
        })()
      );
    }

    await Promise.all(scanPromises);

    res.json({
      subnet,
      port,
      devices,
      count: devices.length,
    });
  } catch (error) {
    logger.error('Failed to scan local network', { error });
    res.status(500).json({ error: 'Failed to scan local network' });
  }
});

// 列出所有实例（管理员）
router.get('/admin/instances', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    const userId = req.query.userId as string | undefined;

    const instances = await instanceService.listInstances({ limit, offset, userId });
    res.json(instances);
  } catch (error) {
    logger.error('Failed to list instances', { error });
    res.status(500).json({ error: 'Failed to list instances' });
  }
});

// 获取实例统计
router.get('/admin/instances/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = await instanceService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============ 兼容旧 API (保留以兼容前端) ============

// 旧: GET /tenants/me -> 新: GET /instances
router.get('/tenants/me', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const instances = await instanceService.getInstancesByUser(req.userId!);
    // 返回第一个实例（兼容旧前端）
    if (instances.length === 0) {
      return res.status(404).json({ error: 'No instances found' });
    }
    // 如果只有一个实例，返回单个对象（兼容）
    if (instances.length === 1) {
      return res.json(instances[0]);
    }
    // 多个实例，返回数组
    res.json(instances);
  } catch (error) {
    logger.error('Failed to get instances', { error });
    res.status(500).json({ error: 'Failed to get instances' });
  }
});

// 旧: DELETE /tenants/me -> 新: DELETE /instances/:instanceId
// 为了兼容，删除用户的第一个实例
router.delete('/tenants/me', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const instances = await instanceDb.getByUserId(req.userId!);
    if (instances.length === 0) {
      return res.status(404).json({ error: 'No instances found' });
    }
    // 删除第一个实例
    await instanceService.deleteInstance(instances[0].instance_id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete instance' });
  }
});

// 旧: POST /tenants/me/restart -> 新: POST /instances/:instanceId/restart
router.post('/tenants/me/restart', authenticateEither, async (req: AuthenticatedRequest, res) => {
  try {
    const instances = await instanceDb.getByUserId(req.userId!);
    if (instances.length === 0) {
      return res.status(404).json({ error: 'No instances found' });
    }
    // 重启第一个实例
    await instanceService.restartInstance(instances[0].instance_id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to restart instance', { error });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to restart instance' });
  }
});

// ============ 主机管理路由 ============

// 获取所有主机状态
router.get('/hosts', async (req, res) => {
  try {
    const portainer = getPortainerClient();
    const environments = await portainer.getEnvironments();

    const hosts = await Promise.all(
      environments.map(async (env) => {
        const instanceCount = await instanceDb.countByEndpoint(env.Id);

        return {
          id: env.Id,
          name: env.Name,
          status: env.Status === 1 ? 'active' : 'down',
          type: env.Type, // 1 = Standalone, 6 = Swarm
          publicUrl: env.PublicURL,
          instanceCount,
        };
      })
    );

    res.json(hosts);
  } catch (error) {
    logger.error('Failed to get hosts', { error });
    res.status(500).json({ error: 'Failed to get hosts' });
  }
});

// 获取单个主机详情
router.get('/hosts/:endpointId', async (req, res) => {
  try {
    const { endpointId } = req.params;
    const portainer = getPortainerClient();

    const env = await portainer.getEnvironment(parseInt(endpointId));
    const stats = await portainer.getDockerInfo(parseInt(endpointId));
    const instances = await instanceDb.list({});

    // 筛选该主机上的实例
    const hostInstances = instances.filter(i => i.endpoint_id === parseInt(endpointId));

    res.json({
      id: env.Id,
      name: env.Name,
      status: env.Status === 1 ? 'active' : 'down',
      stats: {
        cpuTotal: stats.NCPU,
        memoryTotal: Math.round(stats.MemTotal / 1024 / 1024 / 1024), // GB
        memoryUsed: Math.round(stats.MemUsed / 1024 / 1024 / 1024), // GB
        serverVersion: stats.ServerVersion,
      },
      instances: hostInstances.map(i => ({
        instanceId: i.instance_id,
        userId: i.user_id,
        name: i.name,
        email: i.email,
        plan: i.plan,
        status: i.status,
        containerId: i.container_id,
      })),
    });
  } catch (error) {
    logger.error('Failed to get host details', { error });
    res.status(500).json({ error: 'Failed to get host details' });
  }
});

// ============ 内部路由（供 Nginx 调用）============

// 内部路由查询接口
router.get('/internal/route', async (req, res) => {
  try {
    const host = req.query.host as string; // 例如：instance-a.openclaw.app

    // 提取实例名称 (格式: instance-name.openclaw.app 或 name.openclaw.app)
    const match = host.match(/^([a-z0-9-]+)\.openclaw\.app$/i);
    if (!match) {
      return res.status(404).end();
    }

    const instanceName = match[1];

    // 查询数据库获取实例信息
    const instance = await instanceDb.getByInstanceId(`instance-${instanceName}`);
    if (!instance) {
      // 尝试通过 name 查找
      const allInstances = await instanceDb.list({});
      const found = allInstances.find(i => i.name === instanceName);
      if (!found) {
        return res.status(404).end();
      }
    }

    const targetInstance = instance || await instanceDb.list({}).then(instances =>
      instances.find(i => i.name === instanceName)
    );

    if (!targetInstance || !targetInstance.container_id || !targetInstance.endpoint_id || !targetInstance.port) {
      return res.status(404).end();
    }

    // 获取 Portainer 环境信息
    const portainer = getPortainerClient();
    const environment = await portainer.getEnvironment(targetInstance.endpoint_id);

    if (!environment || environment.Status !== 1) {
      return res.status(503).end();
    }

    // 返回目标地址（通过响应头）
    const targetUrl = `http://${environment.PublicURL || 'localhost'}:${targetInstance.port}`;
    res.setHeader('X-Target', targetUrl);
    res.setHeader('X-Container-Id', targetInstance.container_id);
    res.setHeader('X-Endpoint-Id', targetInstance.endpoint_id.toString());
    res.status(200).end();
  } catch (error) {
    logger.error('Failed to resolve route', { error });
    res.status(500).end();
  }
});

// ============ 健康检查 ============

// 签名生成辅助接口（用于开发测试）
router.get('/auth/signature/:userId', (req, res) => {
  const { userId } = req.params;
  const signature = generateSignature(userId);
  res.json({
    userId,
    signature,
    headers: {
      'X-User-ID': userId,
      'X-User-Email': 'user@example.com',
      'X-User-Signature': signature,
    },
    example: `curl -X POST http://localhost:3000/api/instances \\
  -H "Content-Type: application/json" \\
  -H "X-User-ID: ${userId}" \\
  -H "X-User-Email: user@example.com" \\
  -H "X-User-Signature: ${signature}" \\
  -d '{"email": "user@example.com", "plan": "basic"}'`,
  });
});

// SSO 集成信息
router.get('/auth/sso-info', (req, res) => {
  const ssoInfo: any = {
    authentication: {
      jwt: 'Authorization: Bearer <token>',
      sharedSecret: {
        headers: {
          'X-User-ID': '<user-id>',
          'X-User-Email': '<user-email>',
          'X-User-Signature': '<hmac-signature>',
        },
        signatureFormat: '<signature>:<timestamp>',
        algorithm: 'HMAC-SHA256',
        tolerance: `${config.SIGNATURE_TOLERANCE} seconds`,
      },
    },
    endpoints: {
      createInstance: 'POST /api/instances',
      getInstances: 'GET /api/instances',
      getInstance: 'GET /api/instances/:instanceId',
      deleteInstance: 'DELETE /api/instances/:instanceId',
      restartInstance: 'POST /api/instances/:instanceId/restart',
      updateInstance: 'PUT /api/instances/:instanceId',
      getLogs: 'GET /api/instances/:instanceId/logs',
    },
  };

  // 添加 Casdoor 信息（如果启用）
  if (config.CASDOOR_ENABLED) {
    ssoInfo.casdoor = {
      enabled: true,
      loginUrl: `${config.CASDOOR_ENDPOINT}/login/oauth/authorize`,
      tokenUrl: `${config.CASDOOR_ENDPOINT}/api/login/oauth/access_token`,
      callbackUrl: config.CASDOOR_REDIRECT_URI,
      organization: config.CASDOOR_ORGANIZATION,
      application: config.CASDOOR_APPLICATION,
      flow: {
        step1: `GET /api/auth/casdoor/login?redirect=/dashboard`,
        step2: 'User logs in with Casdoor',
        step3: `GET /api/auth/casdoor/callback?code=xxx&state=xxx`,
        step4: 'Redirects to frontend with JWT token',
      },
    };
  }

  res.json(ssoInfo);
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Prometheus metrics endpoint
router.get('/metrics', async (req, res) => {
  // TODO: 实现 Prometheus metrics
  res.set('Content-Type', 'text/plain');
  res.send('# TODO: Implement Prometheus metrics');
});

export default router;
