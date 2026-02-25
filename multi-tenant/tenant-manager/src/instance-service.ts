// 实例服务 - 核心业务逻辑
import { v4 as uuidv4 } from 'uuid';
import { getPortainerClient, type ContainerConfig } from './portainer.js';
import { instanceDb, type InstanceSource } from './database.js';
import { getScheduler } from './scheduler.js';
import { getQuota, config, type Plan } from './config.js';
import { logger } from './logger.js';

export interface CreateInstanceOptions {
  userId: string;
  name?: string;
  email: string;
  plan?: Plan;
}

export interface InstanceInfo {
  instanceId: string;
  userId: string;
  name: string;
  email: string;
  plan: string;
  url: string;
  status: string;
  containerId: string;
  containerName: string;
  host?: string;
  port?: number;
  createdAt: Date;
}

// 生成随机 Token
function generateToken(): string {
  return uuidv4() + uuidv4().replace(/-/g, '');
}

// 生成实例名称
function generateInstanceName(userId: string): string {
  // 格式: {user}-{random}
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}-${random}`;
}

// 生成实例 URL
export function generateInstanceUrl(instanceName: string): string {
  const format = config.INSTANCE_URL_FORMAT;
  const baseDomain = config.INSTANCE_BASE_DOMAIN;
  const scheme = config.INSTANCE_URL_SCHEME;

  // Replace placeholders in format string
  let url = format
    .replace('{name}', instanceName)
    .replace('{baseDomain}', baseDomain);

  return `${scheme}://${url}`;
}

// 实例服务
export class InstanceService {
  private portainer = getPortainerClient();
  private scheduler = getScheduler();

  // 创建实例
  async create(options: CreateInstanceOptions): Promise<InstanceInfo> {
    const { userId, name, email, plan = config.DEFAULT_PLAN } = options;
    const instanceName = name || generateInstanceName(userId);
    const instanceId = `instance-${instanceName}`;
    const quota = getQuota(plan);

    logger.info('Creating instance', { userId, instanceId, instanceName, plan });

    // 选择主机
    const selection = await this.scheduler.select({
      userId,
      instanceId,
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
    const containerName = `openclaw-${instanceName}`;

    // 创建容器配置
    const containerConfig: ContainerConfig = {
      name: containerName,
      image: config.GATEWAY_IMAGE,
      env: [
        `NODE_ENV=production`,
        `CLAWDBOT_STATE_DIR=/data/${instanceName}`,
        `GATEWAY_TOKEN=${gatewayToken}`,
        `GATEWAY_BIND=0.0.0.0`,
        `GATEWAY_PORT=18789`,
        `INSTANCE_ID=${instanceId}`,
        `INSTANCE_NAME=${instanceName}`,
        `USER_ID=${userId}`,
      ],
      labels: {
        'openclaw.instance': instanceId,
        'openclaw.instance-name': instanceName,
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
          `${config.DATA_DIR}/${instanceName}:/data/${instanceName}`,
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

      logger.info('Container created', { instanceId, containerId, containerName });

      // 启动容器
      await this.portainer.startContainer(selection.endpointId, containerId);

      logger.info('Container started', { instanceId, containerId });

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
      await instanceDb.create({
        instance_id: instanceId,
        user_id: userId,
        name: instanceName,
        email,
        plan,
        container_id: containerId,
        container_name: containerName,
        port,
        endpoint_id: selection.endpointId,
        gateway_token: gatewayToken,
        url: generateInstanceUrl(instanceName),
        status: containerInfo.State.Running ? 'running' : 'creating',
        source: 'managed',
        custom_url: null,
        health_check_url: null,
        health_check_interval: null,
        last_health_check: null,
        is_healthy: null,
      });

      logger.info('Instance created successfully', {
        instanceId,
        instanceName,
        userId,
        containerId,
        containerName,
        host: selection.host.Name,
        port,
      });

      return {
        instanceId,
        userId,
        name: instanceName,
        email,
        plan,
        url: generateInstanceUrl(instanceName),
        status: 'running',
        containerId,
        containerName,
        host: selection.host.Name,
        port,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to create instance', { userId, instanceId, error });

      // 清理可能已创建的容器
      try {
        const existing = await instanceDb.getByInstanceId(instanceId);
        if (existing && existing.container_id) {
          await this.portainer.removeContainer(selection.endpointId, existing.container_id, true);
        }
      } catch (cleanupError) {
        logger.error('Failed to cleanup after error', { cleanupError });
      }

      throw error;
    }
  }

  // 获取用户的所有实例
  async getInstancesByUser(userId: string): Promise<InstanceInfo[]> {
    const instances = await instanceDb.getByUserId(userId);

    // 从 Portainer 获取最新状态
    return await Promise.all(
      instances.map(async (instance) => {
        let status = instance.status;
        if (instance.container_id && instance.endpoint_id) {
          try {
            const containerInfo = await this.portainer.getContainer(
              instance.endpoint_id,
              instance.container_id
            );
            status = containerInfo.State.Running ? 'running' : 'stopped';

            // 同步状态到数据库
            if (status !== instance.status) {
              await instanceDb.update(instance.instance_id, { status });
            }
          } catch (error) {
            logger.warn('Failed to get container status', {
              instanceId: instance.instance_id,
              error,
            });
          }
        }

        return {
          instanceId: instance.instance_id,
          userId: instance.user_id,
          name: instance.name,
          email: instance.email,
          plan: instance.plan,
          url: instance.url || generateInstanceUrl(instance.name),
          status,
          containerId: instance.container_id || '',
          containerName: instance.container_name || '',
          port: instance.port || undefined,
          createdAt: instance.created_at,
          // Custom instance fields
          source: instance.source,
          customUrl: instance.custom_url,
          healthCheckUrl: instance.health_check_url,
          healthCheckInterval: instance.health_check_interval,
          lastHealthCheck: instance.last_health_check,
          isHealthy: instance.is_healthy,
        };
      })
    );
  }

  // 通过 instance_id 获取实例
  async getInstance(instanceId: string): Promise<InstanceInfo | null> {
    const instance = await instanceDb.getByInstanceId(instanceId);

    if (!instance) {
      return null;
    }

    // 从 Portainer 获取最新状态
    let status = instance.status;
    if (instance.container_id && instance.endpoint_id) {
      try {
        const containerInfo = await this.portainer.getContainer(
          instance.endpoint_id,
          instance.container_id
        );
        status = containerInfo.State.Running ? 'running' : 'stopped';

        // 同步状态到数据库
        if (status !== instance.status) {
          await instanceDb.update(instance.instance_id, { status });
        }
      } catch (error) {
        logger.warn('Failed to get container status', {
          instanceId: instance.instance_id,
          error,
        });
      }
    }

    return {
      instanceId: instance.instance_id,
      userId: instance.user_id,
      name: instance.name,
      email: instance.email,
      plan: instance.plan,
      url: instance.url || generateInstanceUrl(instance.name),
      status,
      containerId: instance.container_id || '',
      containerName: instance.container_name || '',
      port: instance.port || undefined,
      createdAt: instance.created_at,
      // Custom instance fields
      source: instance.source,
      customUrl: instance.custom_url,
      healthCheckUrl: instance.health_check_url,
      healthCheckInterval: instance.health_check_interval,
      lastHealthCheck: instance.last_health_check,
      isHealthy: instance.is_healthy,
    };
  }

  // 删除实例
  async deleteInstance(instanceId: string): Promise<boolean> {
    const instance = await instanceDb.getByInstanceId(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    logger.info('Deleting instance', { instanceId, instanceName: instance.name });

    if (instance.container_id && instance.endpoint_id) {
      try {
        // 停止容器
        await this.portainer.stopContainer(instance.endpoint_id, instance.container_id);

        // 删除容器
        await this.portainer.removeContainer(
          instance.endpoint_id,
          instance.container_id,
          true // force
        );

        logger.info('Container deleted', {
          instanceId,
          containerId: instance.container_id,
        });
      } catch (error) {
        logger.error('Failed to delete container', {
          instanceId,
          error,
        });
        throw error;
      }
    }

    // 删除数据库记录
    const deleted = await instanceDb.delete(instanceId);

    logger.info('Instance deleted', { instanceId, deleted });

    return deleted;
  }

  // 重启实例
  async restartInstance(instanceId: string): Promise<void> {
    const instance = await instanceDb.getByInstanceId(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    if (!instance.container_id || !instance.endpoint_id) {
      throw new Error(`Instance has no container: ${instanceId}`);
    }

    logger.info('Restarting instance', { instanceId, instanceName: instance.name });

    await this.portainer.restartContainer(instance.endpoint_id, instance.container_id);

    // 更新状态
    await instanceDb.update(instanceId, { status: 'running' });

    logger.info('Instance restarted', { instanceId });
  }

  // 更新实例名称
  async updateInstanceName(instanceId: string, newName: string): Promise<void> {
    const instance = await instanceDb.getByInstanceId(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    logger.info('Updating instance name', { instanceId, oldName: instance.name, newName });

    await instanceDb.update(instanceId, { name: newName });

    logger.info('Instance name updated', { instanceId, newName });
  }

  // 更新实例计划
  async updatePlan(instanceId: string, newPlan: Plan): Promise<void> {
    const instance = await instanceDb.getByInstanceId(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    logger.info('Updating instance plan', { instanceId, instanceName: instance.name, newPlan });

    // TODO: 重新创建容器以应用新配额
    // 目前只更新数据库
    await instanceDb.update(instanceId, { plan: newPlan });

    logger.info('Instance plan updated', { instanceId, newPlan });
  }

  // 获取实例日志
  async getLogs(instanceId: string, tail = 100): Promise<string> {
    const instance = await instanceDb.getByInstanceId(instanceId);

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    if (!instance.container_id || !instance.endpoint_id) {
      throw new Error(`Instance has no container: ${instanceId}`);
    }

    return await this.portainer.getContainerLogs(
      instance.endpoint_id,
      instance.container_id,
      tail
    );
  }

  // 获取实例统计信息
  async getStats() {
    return await instanceDb.getStats();
  }

  // 列出所有实例（管理员）
  async listInstances(options: { limit?: number; offset?: number; userId?: string } = {}) {
    return await instanceDb.list(options);
  }
}

// 导出单例
let instanceServiceInstance: InstanceService | null = null;

export function getInstanceService(): InstanceService {
  if (!instanceServiceInstance) {
    instanceServiceInstance = new InstanceService();
  }
  return instanceServiceInstance;
}

// 保留旧名称以兼容
export { getTenantService } from './tenant-service.js';
