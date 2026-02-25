// 租户调度器 - 选择最合适的主机创建租户
import crypto from 'crypto';
import { getPortainerClient, PortainerEnvironment, DockerInfo } from './portainer.js';
import { tenantDb, hostCacheDb } from './database.js';
import { getQuota, type Plan } from './config.js';
import { logger } from './logger.js';

export interface HostSelection {
  endpointId: number;
  host: PortainerEnvironment;
  stats?: DockerInfo;
  score: number;
}

export interface SchedulingOptions {
  userId?: string;
  tenantId?: string;
  plan: Plan;
  preferSameHost?: boolean;
}

// 租户调度器
export class TenantScheduler {
  private portainer = getPortainerClient();
  private cache = new Map<number, { data: DockerInfo; expires: number }>();
  private cacheTTL = 30000; // 30 秒缓存

  // 获取所有可用的主机
  async getAvailableHosts(): Promise<PortainerEnvironment[]> {
    const environments = await this.portainer.getAvailableEnvironments();
    return environments.filter(env => env.Status === 1); // 1 = up
  }

  // 获取主机 Docker 信息（带缓存）
  async getHostStats(endpointId: number): Promise<DockerInfo | null> {
    const cached = this.cache.get(endpointId);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      const stats = await this.portainer.getDockerInfo(endpointId);
      this.cache.set(endpointId, {
        data: stats,
        expires: Date.now() + this.cacheTTL,
      });
      return stats;
    } catch (error) {
      logger.error('Failed to get host stats', { endpointId, error });
      return null;
    }
  }

  // 计算主机分数（用于选择最佳主机）
  private calculateScore(
    stats: DockerInfo,
    requiredCpu: number,
    requiredMemory: number
  ): number {
    let score = 100;

    // 检查资源是否足够
    const availableMemoryGB = (stats.MemTotal - stats.MemUsed) / (1024 * 1024 * 1024);
    const requiredMemoryGB = requiredMemory / 1024;  // requiredMemory is in MB, convert to GB

    if (availableMemoryGB < requiredMemoryGB) {
      return -1; // 资源不足
    }

    // CPU 使用率评分（越低越好）
    const cpuUsagePercent = (stats.MemUsed / stats.MemTotal) * 100;
    score -= cpuUsagePercent * 0.5;

    // 内存使用率评分（越低越好）
    const memoryUsagePercent = (stats.MemUsed / stats.MemTotal) * 100;
    score -= memoryUsagePercent * 0.5;

    return Math.max(0, score);
  }

  // 使用资源评分选择主机
  async selectByResourceScore(options: SchedulingOptions): Promise<HostSelection | null> {
    const quota = getQuota(options.plan);
    const hosts = await this.getAvailableHosts();

    if (hosts.length === 0) {
      logger.warn('No available hosts');
      return null;
    }

    const candidates: HostSelection[] = [];

    for (const host of hosts) {
      const stats = await this.getHostStats(host.Id);
      if (!stats) continue;

      const score = this.calculateScore(stats, quota.cpu, quota.memory);
      if (score >= 0) {
        candidates.push({
          endpointId: host.Id,
          host,
          stats,
          score,
        });
      }
    }

    if (candidates.length === 0) {
      logger.warn('No hosts with sufficient resources', { quota });
      return null;
    }

    // 按分数排序，选择最高分的主机
    candidates.sort((a, b) => b.score - a.score);

    logger.info('Selected host by resource score', {
      selected: candidates[0].host.Name,
      score: candidates[0].score,
      plan: options.plan,
    });

    return candidates[0];
  }

  // 使用一致性哈希选择主机（同一租户总是在同一主机）
  async selectByConsistentHash(options: SchedulingOptions): Promise<HostSelection | null> {
    const hosts = await this.getAvailableHosts();

    if (hosts.length === 0) {
      return null;
    }

    // 使用 tenantId 或 userId 进行哈希
    const key = options.tenantId || options.userId || '';
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const index = parseInt(hash.substring(0, 8), 16) % hosts.length;
    const host = hosts[index];

    logger.info('Selected host by consistent hash', {
      selected: host.Name,
      key: key.substring(0, 8),
      plan: options.plan,
    });

    return {
      endpointId: host.Id,
      host,
      score: 0,
    };
  }

  // 使用轮询选择主机（均匀分布）
  async selectByRoundRobin(options: SchedulingOptions): Promise<HostSelection | null> {
    const hosts = await this.getAvailableHosts();

    if (hosts.length === 0) {
      return null;
    }

    // 获取当前租户数量
    const counts = await Promise.all(
      hosts.map(async (host) => ({
        host,
        count: await tenantDb.countByEndpoint(host.Id),
      }))
    );

    // 选择租户数量最少的主机
    counts.sort((a, b) => a.count - b.count);
    const selected = counts[0].host;

    logger.info('Selected host by round robin', {
      selected: selected.Name,
      tenantCount: counts[0].count,
      plan: options.plan,
    });

    return {
      endpointId: selected.Id,
      host: selected,
      score: 0,
    };
  }

  // 智能选择：优先使用同一主机，否则轮询
  async select(options: SchedulingOptions): Promise<HostSelection | null> {
    const quota = getQuota(options.plan);

    // 如果指定了 preferSameHost，尝试在现有主机上创建
    if (options.preferSameHost && options.tenantId) {
      const existing = await tenantDb.getByTenantId(options.tenantId);
      if (existing && existing.endpoint_id) {
        const host = await this.portainer.getEnvironment(existing.endpoint_id);
        if (host && host.Status === 1) {
          const stats = await this.getHostStats(host.Id);
          if (stats) {
            const score = this.calculateScore(stats, quota.cpu, quota.memory);
            if (score >= 0) {
              logger.info('Reusing existing host', { host: host.Name });
              return { endpointId: host.Id, host, stats, score };
            }
          }
        }
      }
    }

    // 默认使用轮询策略
    return await this.selectByRoundRobin(options);
  }

  // 验证主机是否有足够资源
  async validateResources(
    endpointId: number,
    plan: Plan
  ): Promise<{ valid: boolean; reason?: string }> {
    const quota = getQuota(plan);
    const stats = await this.getHostStats(endpointId);

    if (!stats) {
      return { valid: false, reason: 'Cannot get host stats' };
    }

    const availableMemoryGB = (stats.MemTotal - stats.MemUsed) / (1024 * 1024 * 1024);
    const requiredMemoryGB = quota.memory / 1024;  // quota.memory is in MB, convert to GB

    if (availableMemoryGB < requiredMemoryGB) {
      return {
        valid: false,
        reason: `Insufficient memory: ${availableMemoryGB.toFixed(2)}GB available, ${requiredMemoryGB.toFixed(2)}GB required`,
      };
    }

    return { valid: true };
  }

  // 清除缓存
  clearCache(): void {
    this.cache.clear();
  }
}

// 导出单例
let schedulerInstance: TenantScheduler | null = null;

export function getScheduler(): TenantScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new TenantScheduler();
  }
  return schedulerInstance;
}
