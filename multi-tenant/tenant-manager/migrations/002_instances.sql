-- 重构：将 tenants 改为 instances，支持一个用户多个实例

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS host_cache CASCADE;

-- 实例表 (一个用户可以有多个实例)
CREATE TABLE instances (
  instance_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'creating',
  endpoint_id INTEGER,
  container_id TEXT,
  container_name TEXT,
  port INTEGER,
  gateway_token TEXT,
  url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_instances_user_id ON instances(user_id);
CREATE INDEX idx_instances_container_id ON instances(container_id);
CREATE INDEX idx_instances_endpoint_id ON instances(endpoint_id);

-- 主机缓存表
CREATE TABLE host_cache (
  endpoint_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  last_check TIMESTAMP NOT NULL DEFAULT NOW(),
  cpu_total REAL,
  memory_total INTEGER,
  cpu_used REAL,
  memory_used INTEGER,
  instance_count INTEGER DEFAULT 0
);

-- 统计视图
CREATE VIEW instance_stats AS
SELECT
  plan,
  status,
  COUNT(*) as count
FROM instances
GROUP BY plan, status;
