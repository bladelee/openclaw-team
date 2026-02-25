-- OpenClaw 多租户管理服务数据库 schema
-- 版本: 1.0.0

-- 租户表
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    plan VARCHAR(20) NOT NULL DEFAULT 'basic',
    CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),

    -- 容器信息（通过 Portainer 管理）
    container_id VARCHAR(100),
    port INTEGER,
    endpoint_id INTEGER,

    -- 认证信息
    gateway_token VARCHAR(255),

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'creating',
    CHECK (status IN ('creating', 'running', 'stopped', 'error')),

    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_endpoint_id ON tenants(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- 主机缓存表
CREATE TABLE IF NOT EXISTS host_cache (
    endpoint_id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    public_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    last_sync TIMESTAMP NOT NULL DEFAULT NOW(),

    -- 资源信息缓存
    cpu_total DECIMAL(3, 2),
    cpu_used DECIMAL(3, 2),
    memory_total INTEGER,
    memory_used INTEGER,
    tenant_count INTEGER DEFAULT 0,

    -- 元数据
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_host_cache_status ON host_cache(status);
CREATE INDEX IF NOT EXISTS idx_host_cache_last_sync ON host_cache(last_sync);

-- 租户操作日志表（可选，用于审计）
CREATE TABLE IF NOT EXISTS tenant_logs (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    CHECK (action IN ('create', 'delete', 'restart', 'update_plan', 'start', 'stop')),

    -- 操作结果
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_message TEXT,

    -- 额外信息
    details JSONB DEFAULT '{}',

    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tenant_logs_tenant_id ON tenant_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_logs_user_id ON tenant_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_logs_action ON tenant_logs(action);
CREATE INDEX IF NOT EXISTS idx_tenant_logs_created_at ON tenant_logs(created_at DESC);

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用更新时间戳触发器
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_host_cache_updated_at
    BEFORE UPDATE ON host_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
