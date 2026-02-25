// 数据库模块
import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

// 实例类型
export type InstanceSource = 'managed' | 'custom' | 'hardware';

export interface Instance {
  id: number;
  instance_id: string;
  user_id: string;
  name: string;
  email: string;
  plan: string;
  container_id: string | null;
  container_name: string | null;
  port: number | null;
  endpoint_id: number | null;
  gateway_token: string | null;
  url: string | null;
  status: 'creating' | 'running' | 'stopped' | 'error';
  source: InstanceSource;
  custom_url: string | null;
  health_check_url: string | null;
  health_check_interval: number | null;
  last_health_check: Date | null;
  is_healthy: boolean | null;
  created_at: Date;
  updated_at: Date;
}

// 主机缓存类型
export interface HostCache {
  endpoint_id: number;
  name: string;
  status: string;
  last_check: Date;
  cpu_total: number | null;
  memory_total: number | null;
  cpu_used: number | null;
  memory_used: number | null;
  instance_count: number;
}

// 创建数据库连接池
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      min: config.DATABASE_POOL_MIN,
      max: config.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Database pool error', { error: err.message });
    });

    logger.info('Database pool created', {
      min: config.DATABASE_POOL_MIN,
      max: config.DATABASE_POOL_MAX,
    });
  }

  return pool;
}

// 数据库查询辅助函数
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const pool = getPool();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query', {
      duration,
      rows: result.rowCount,
      text: text.substring(0, 100),
    });

    return result;
  } catch (error) {
    logger.error('Database query error', {
      error: error instanceof Error ? error.message : String(error),
      text: text.substring(0, 100),
    });
    throw error;
  }
}

// 实例数据库操作
export const instanceDb = {
  // 创建实例
  async create(instance: Omit<Instance, 'id' | 'created_at' | 'updated_at'>): Promise<Instance> {
    const result = await query<Instance>(
      `INSERT INTO instances (instance_id, user_id, name, email, plan, container_id, container_name, port, endpoint_id, gateway_token, url, status, source, custom_url, health_check_url, health_check_interval, last_health_check, is_healthy)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        instance.instance_id,
        instance.user_id,
        instance.name,
        instance.email,
        instance.plan,
        instance.container_id,
        instance.container_name,
        instance.port,
        instance.endpoint_id,
        instance.gateway_token,
        instance.url,
        instance.status,
        instance.source || 'managed',
        instance.custom_url || null,
        instance.health_check_url || null,
        instance.health_check_interval || null,
        instance.last_health_check || null,
        instance.is_healthy || null,
      ]
    );

    return result.rows[0];
  },

  // 通过 user_id 获取所有实例
  async getByUserId(userId: string): Promise<Instance[]> {
    const result = await query<Instance>(
      'SELECT * FROM instances WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  },

  // 通过 instance_id 获取实例
  async getByInstanceId(instanceId: string): Promise<Instance | null> {
    const result = await query<Instance>(
      'SELECT * FROM instances WHERE instance_id = $1',
      [instanceId]
    );
    return result.rows[0] || null;
  },

  // 通过 container_id 获取实例
  async getByContainerId(containerId: string): Promise<Instance | null> {
    const result = await query<Instance>(
      'SELECT * FROM instances WHERE container_id = $1',
      [containerId]
    );
    return result.rows[0] || null;
  },

  // 更新实例
  async update(
    instanceId: string,
    updates: Partial<Omit<Instance, 'id' | 'instance_id' | 'created_at'>>
  ): Promise<Instance | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        sets.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (sets.length === 0) {
      return await this.getByInstanceId(instanceId);
    }

    sets.push(`updated_at = NOW()`);
    values.push(instanceId);

    const result = await query<Instance>(
      `UPDATE instances SET ${sets.join(', ')} WHERE instance_id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  },

  // 删除实例
  async delete(instanceId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM instances WHERE instance_id = $1',
      [instanceId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  // 列出所有实例
  async list(options: { limit?: number; offset?: number; status?: string; userId?: string } = {}): Promise<Instance[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(options.status);
      paramIndex++;
    }

    if (options.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      values.push(options.userId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = options.limit ? `LIMIT $${paramIndex++}` : '';
    if (options.limit) values.push(options.limit);
    const offsetClause = options.offset ? `OFFSET $${paramIndex++}` : '';
    if (options.offset) values.push(options.offset);

    const result = await query<Instance>(
      `SELECT * FROM instances ${whereClause} ORDER BY created_at DESC ${limitClause} ${offsetClause}`,
      values
    );

    return result.rows;
  },

  // 获取指定 endpoint_id 的实例数量
  async countByEndpoint(endpointId: number): Promise<number> {
    const result = await query<{ count: bigint }>(
      'SELECT COUNT(*) as count FROM instances WHERE endpoint_id = $1',
      [endpointId]
    );
    return Number(result.rows[0].count);
  },

  // 获取实例统计
  async getStats(): Promise<{
    total: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const result = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE plan = 'free') as free,
         COUNT(*) FILTER (WHERE plan = 'basic') as basic,
         COUNT(*) FILTER (WHERE plan = 'pro') as pro,
         COUNT(*) FILTER (WHERE plan = 'enterprise') as enterprise,
         COUNT(*) FILTER (WHERE status = 'running') as running,
         COUNT(*) FILTER (WHERE status = 'stopped') as stopped,
         COUNT(*) FILTER (WHERE status = 'creating') as creating,
         COUNT(*) FILTER (WHERE status = 'error') as error
       FROM instances`
    );

    const row = result.rows[0];
    return {
      total: Number(row.total),
      byPlan: {
        free: Number(row.free),
        basic: Number(row.basic),
        pro: Number(row.pro),
        enterprise: Number(row.enterprise),
      },
      byStatus: {
        running: Number(row.running),
        stopped: Number(row.stopped),
        creating: Number(row.creating),
        error: Number(row.error),
      },
    };
  },
};

// 保留旧名称以兼容（内部使用）
export const tenantDb = instanceDb;

// 主机缓存数据库操作
export const hostCacheDb = {
  // 获取所有主机
  async getAll(): Promise<HostCache[]> {
    const result = await query<HostCache>('SELECT * FROM host_cache ORDER BY name');
    return result.rows;
  },

  // 获取单个主机
  async get(endpointId: number): Promise<HostCache | null> {
    const result = await query<HostCache>(
      'SELECT * FROM host_cache WHERE endpoint_id = $1',
      [endpointId]
    );
    return result.rows[0] || null;
  },

  // 更新或插入主机
  async upsert(host: Omit<HostCache, 'last_check'> & { last_check?: Date }): Promise<void> {
    await query(
      `INSERT INTO host_cache (endpoint_id, name, status, last_check, cpu_total, memory_total, cpu_used, memory_used, instance_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (endpoint_id) DO UPDATE
       SET name = EXCLUDED.name,
           status = EXCLUDED.status,
           last_check = EXCLUDED.last_check,
           cpu_total = EXCLUDED.cpu_total,
           memory_total = EXCLUDED.memory_total,
           cpu_used = EXCLUDED.cpu_used,
           memory_used = EXCLUDED.memory_used,
           instance_count = EXCLUDED.instance_count`,
      [
        host.endpoint_id,
        host.name,
        host.status,
        host.last_check || new Date(),
        host.cpu_total,
        host.memory_total,
        host.cpu_used,
        host.memory_used,
        host.instance_count,
      ]
    );
  },

  // 删除主机
  async delete(endpointId: number): Promise<void> {
    await query('DELETE FROM host_cache WHERE endpoint_id = $1', [endpointId]);
  },

  // 清理过期缓存（超过 5 分钟未同步）
  async cleanup(): Promise<void> {
    await query(
      'DELETE FROM host_cache WHERE last_check < NOW() - INTERVAL \'5 minutes\''
    );
  },
};

// 事务支持
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 关闭连接池
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}
