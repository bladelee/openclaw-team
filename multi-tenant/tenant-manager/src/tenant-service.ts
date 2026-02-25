// 租户服务 - 核心业务逻辑
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { getPortainerClient, type ContainerConfig } from './portainer.js';
import { tenantDb, hostCacheDb } from './database.js';
import { getScheduler, type HostSelection } from './scheduler.js';
import { getQuota, config, type Plan } from './config.js';
import { logger } from './logger.js';

export interface CreateTenantOptions {
  userId: string;
  email: string;
  plan?: Plan;
}

export interface TenantInfo {
  tenantId: string;
  userId: string;
  email: string;
  plan: string;
  url: string;
  status: string;
  host?: string;
  port?: number;
  createdAt: Date;
}

// 生成随机 Token
function generateToken(): string {
  return uuidv4() + uuidv4().replace(/-/g, '');
}

// 租户服务
export class TenantService {
  private portainer = getPortainerClient();
  private scheduler = getScheduler();

  // 创建租户
  async create(options: CreateTenantOptions): Promise<TenantInfo> {
    const { userId, email, plan = config.DEFAULT_PLAN } = options;
    const tenantId = `tenant-${userId}`;
    const quota = getQuota(plan);

    logger.info('Creating tenant', { userId, tenantId, plan });

    // 检查是否已存在
    const existing = await tenantDb.getByUserId(userId);
    if (existing) {
      throw new Error(`User ${userId} already has a tenant: ${existing.tenant_id}`);
    }

    // 选择主机
    const selection = await this.scheduler.select({
      userId,
      tenantId,
      plan,
      preferSameHost: false,
    });

    if (!selection) {
      throw new Error('No available host with sufficient resources');
    }

    // 验证资源
    const validation = await this.scheduler.validateResources(selection.endpointId, plan);
    if (!validation.valid) {
      throw new Error(`Resource validation failed: ${validation.reason}`);
    }

    const gatewayToken = generateToken();

    // 创建容器配置
    const containerConfig: ContainerConfig = {
      name: tenantId,
      image: config.GATEWAY_IMAGE,
      env: [
        `NODE_ENV=production`,
        `CLAWDBOT_STATE_DIR=/data/${tenantId}`,
        `GATEWAY_TOKEN=${gatewayToken}`,
        `GATEWAY_BIND=0.0.0.0`,
        `GATEWAY_PORT=18789`,
        `TENANT_ID=${tenantId}`,
        `USER_ID=${userId}`,
      ],
      labels: {
        'openclaw.tenant': tenantId,
        'openclaw.user': userId,
        'openclaw.plan': plan,
        'openclaw.managed': 'true',
        'openclaw.created_at': new Date().toISOString(),
      },
      hostConfig: {
        portBindings: {
          '18789/tcp': [{ hostPort: '0' }], // 自动分配端口
        },
        binds: [
          `${config.DATA_DIR}/${tenantId}:/data/${tenantId}`,
        ],
        memory: quota.memory * 1024 * 1024 * 1024, // 转换为字节
        cpuQuota: quota.cpu * 100000, // 转换为 Docker 单位
      },
    };

    try {
      // 创建容器
      const createResult = await this.portainer.createContainer(
        selection.endpointId,
        containerConfig
      );

      const containerId = createResult.Id;

      logger.info('Container created', { tenantId, containerId });

      // 启动容器
      await this.portainer.startContainer(selection.endpointId, containerId);

      logger.info('Container started', { tenantId, containerId });

      // 获取容器信息（获取分配的端口）
      const containerInfo = await this.portainer.getContainer(
        selection.endpointId,
        containerId
      );

      const portMapping = containerInfo.NetworkSettings.Ports['18789/tcp'];
      const port = portMapping && portMapping[0]
        ? parseInt(portMapping[0].HostPort)
        : 18789;

      // 保存到数据库
      await tenantDb.create({
        tenant_id: tenantId,
        user_id: userId,
        email,
        plan,
        container_id: containerId,
        port,
        endpoint_id: selection.endpointId,
        gateway_token: gatewayToken,
        status: containerInfo.State.Running ? 'running' : 'creating',
      });

      logger.info('Tenant created successfully', {
        tenantId,
        userId,
        host: selection.host.Name,
        port,
      });

      return {
        tenantId,
        userId,
        email,
        plan,
        url: `https://${tenantId}.openclaw.app`,
        status: 'running',
        host: selection.host.Name,
        port,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to create tenant', { userId, tenantId, error });

      // 清理可能已创建的容器
      try {
        const existing = await tenantDb.getByTenantId(tenantId);
        if (existing && existing.container_id) {
          await this.portainer.removeContainer(selection.endpointId, existing.container_id, true);
        }
      } catch (cleanupError) {
        logger.error('Failed to cleanup after error', { cleanupError });
      }

      throw error;
    }
  }

  // 获取租户信息
  async getTenant(userId: string): Promise<TenantInfo | null> {
    const tenant = await tenantDb.getByUserId(userId);

    if (!tenant) {
      return null;
    }

    // 从 Portainer 获取最新状态
    let status = tenant.status;
    if (tenant.container_id && tenant.endpoint_id) {
      try {
        const containerInfo = await this.portainer.getContainer(
          tenant.endpoint_id,
          tenant.container_id
        );
        status = containerInfo.State.Running ? 'running' : 'stopped';

        // 同步状态到数据库
        if (status !== tenant.status) {
          await tenantDb.update(tenant.tenant_id, { status });
        }
      } catch (error) {
        logger.warn('Failed to get container status', {
          tenantId: tenant.tenant_id,
          error,
        });
      }
    }

    return {
      tenantId: tenant.tenant_id,
      userId: tenant.user_id,
      email: tenant.email,
      plan: tenant.plan,
      url: `https://${tenant.tenant_id}.openclaw.app`,
      status,
      port: tenant.port || undefined,
      createdAt: tenant.created_at,
    };
  }

  // 通过 tenant_id 获取租户
  async getTenantByTenantId(tenantId: string): Promise<TenantInfo | null> {
    const tenant = await tenantDb.getByTenantId(tenantId);

    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant.tenant_id,
      userId: tenant.user_id,
      email: tenant.email,
      plan: tenant.plan,
      url: `https://${tenant.tenant_id}.openclaw.app`,
      status: tenant.status,
      port: tenant.port || undefined,
      createdAt: tenant.created_at,
    };
  }

  // 删除租户
  async deleteTenant(userId: string): Promise<boolean> {
    const tenant = await tenantDb.getByUserId(userId);

    if (!tenant) {
      throw new Error(`Tenant not found for user: ${userId}`);
    }

    logger.info('Deleting tenant', { userId, tenantId: tenant.tenant_id });

    if (tenant.container_id && tenant.endpoint_id) {
      try {
        // 停止容器
        await this.portainer.stopContainer(tenant.endpoint_id, tenant.container_id);

        // 删除容器
        await this.portainer.removeContainer(
          tenant.endpoint_id,
          tenant.container_id,
          true // force
        );

        logger.info('Container deleted', {
          tenantId: tenant.tenant_id,
          containerId: tenant.container_id,
        });
      } catch (error) {
        logger.error('Failed to delete container', {
          tenantId: tenant.tenant_id,
          error,
        });
        throw error;
      }
    }

    // 删除数据库记录
    const deleted = await tenantDb.delete(tenant.tenant_id);

    logger.info('Tenant deleted', { userId, tenantId: tenant.tenant_id, deleted });

    return deleted;
  }

  // 重启租户
  async restartTenant(userId: string): Promise<void> {
    const tenant = await tenantDb.getByUserId(userId);

    if (!tenant) {
      throw new Error(`Tenant not found for user: ${userId}`);
    }

    if (!tenant.container_id || !tenant.endpoint_id) {
      throw new Error(`Tenant has no container: ${tenant.tenant_id}`);
    }

    logger.info('Restarting tenant', { userId, tenantId: tenant.tenant_id });

    await this.portainer.restartContainer(tenant.endpoint_id, tenant.container_id);

    // 更新状态
    await tenantDb.update(tenant.tenant_id, { status: 'running' });

    logger.info('Tenant restarted', { userId, tenantId: tenant.tenant_id });
  }

  // 更新租户计划
  async updatePlan(userId: string, newPlan: Plan): Promise<void> {
    const tenant = await tenantDb.getByUserId(userId);

    if (!tenant) {
      throw new Error(`Tenant not found for user: ${userId}`);
    }

    logger.info('Updating tenant plan', { userId, tenantId: tenant.tenant_id, newPlan });

    // TODO: 重新创建容器以应用新配额
    // 目前只更新数据库
    await tenantDb.update(tenant.tenant_id, { plan: newPlan });

    logger.info('Tenant plan updated', { userId, tenantId: tenant.tenant_id, newPlan });
  }

  // 获取租户日志
  async getLogs(userId: string, tail = 100): Promise<string> {
    const tenant = await tenantDb.getByUserId(userId);

    if (!tenant) {
      throw new Error(`Tenant not found for user: ${userId}`);
    }

    if (!tenant.container_id || !tenant.endpoint_id) {
      throw new Error(`Tenant has no container: ${tenant.tenant_id}`);
    }

    return await this.portainer.getContainerLogs(
      tenant.endpoint_id,
      tenant.container_id,
      tail
    );
  }

  // 获取租户统计信息
  async getStats() {
    return await tenantDb.getStats();
  }

  // 列出所有租户
  async listTenants(options: { limit?: number; offset?: number } = {}) {
    return await tenantDb.list(options);
  }
}

// 导出单例
let tenantServiceInstance: TenantService | null = null;

export function getTenantService(): TenantService {
  if (!tenantServiceInstance) {
    tenantServiceInstance = new TenantService();
  }
  return tenantServiceInstance;
}
