# Liuma 与 multi-tenant 集成方案分析

> **日期**: 2025-02-26
> **基于用户反馈重新分析**

---

## 问题澄清

### 1. 认证系统

| 系统 | 用途 | 是否保留 |
|------|------|---------|
| **Casdoor** | multi-tenant 的 SSO，已有用户使用 | ✅ **必须保留** |
| **Better Auth (Liuma)** | 新的统一认证中心 | ✅ **新增** |

**结论**：**双认证系统并存**，各自服务不同用途。

---

### 2. host_configs vs instances

#### Liuma 设计的 host_configs

```sql
-- Liuma 原设计
CREATE TABLE host_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,           -- "家里的小主机"
  url TEXT NOT NULL,            -- "https://openclaw.example.com"
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  health_status TEXT,           -- online/offline/unknown
  created_at TIMESTAMP DEFAULT NOW()
);
```

**设计目的**：让移动端 H5 用户配置多个 OpenClaw 主机地址，实现跨设备同步。

---

#### multi-tenant 的 instances

```sql
-- multi-tenant 现有实现
CREATE TABLE instances (
  instance_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,           -- "test-prod"
  endpoint_id INTEGER,          -- 部署在哪个主机
  container_id TEXT,            -- Portainer container ID
  container_name TEXT,
  port INTEGER,
  gateway_token TEXT,
  url TEXT,                     -- 实例访问 URL
  status TEXT,                  -- creating/running/stopped/error
  created_at TIMESTAMP DEFAULT NOW()
);

-- 支持多种类型
-- 1. 容器实例（通过 Portainer 管理）
-- 2. 自定义/外部实例（手动添加 URL）
-- 3. 硬件实例（物理设备）
```

**功能**：
- ✅ 容器生命周期管理（启动、停止、重启）
- ✅ 自定义实例（连接外部 OpenClaw）
- ✅ 健康检查（容器状态）
- ✅ 日志查看
- ✅ 本地扫描（发现本地实例）

---

### 3. 功能对比

| 功能 | Liuma host_configs | multi-tenant instances | 重合度 |
|------|-------------------|----------------------|--------|
| **存储用户实例** | ✅ | ✅ | 100% |
| **实例 CRUD** | ✅ | ✅ | 100% |
| **健康检查** | ✅ | ✅ | 100% |
| **跨设备同步** | ✅ | ❌ | Liuma 独有 |
| **容器管理** | ❌ | ✅ | multi-tenant 独有 |
| **硬件支持** | ❌ | ✅ | multi-tenant 独有 |
| **多种实例类型** | ❌ | ✅ | multi-tenant 独有 |

---

## 方案选项

### 方案 A：保持独立（推荐用于保守策略）

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      双系统独立架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  移动端 H5                                                  │
│   ├── Liuma 认证（Better Auth + OAuth）                     │
│   └── host_configs（简单的地址簿）                          │
│       • 仅存储 URL                                          │
│       • 跨设备同步                                          │
│       • 轻量级                                              │
│                                                             │
│  PC 端 Web                                                  │
│   ├── Casdoor 认证                                          │
│   └── instances（完整的实例管理）                           │
│       • 容器生命周期                                        │
│       • 多种实例类型                                        │
│       • Portainer 集成                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 不破坏现有实现 | ❌ 两个系统维护成本高 |
| ✅ 移动端轻量简单 | ❌ 数据不同步 |
| ✅ PC 端功能完整 | ❌ 用户体验割裂 |
| ✅ 风险最低 | ❌ 需要维护两套认证 |

#### 适用场景

- 团队资源有限，不想大规模重构
- 移动端和 PC 端用户群体不同
- 短期快速上线

---

### 方案 B：统一到 multi-tenant（推荐用于渐进式）

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                   统一到 multi-tenant                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              multi-tenant（统一后端）                │  │
│  │                                                       │  │
│  │  认证层：                                             │  │
│  │  ├── Casdoor（PC 端）                                │  │
│  │  └── Better Auth（移动端，通过 Liuma SDK）           │  │
│  │                                                       │  │
│  │  数据层：                                             │  │
│  │  └── instances 表（扩展支持更多字段）                │  │
│  │      ├── 跨设备同步（新增）                          │  │
│  │      ├── 容器管理（现有）                            │  │
│  │      ├── 硬件支持（现有）                            │  │
│  │      └── 外部实例（现有）                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  客户端：                                                   │
│  ├── 移动端 H5 → Liuma SDK → multi-tenant API              │
│  └── PC 端 Web → 直接调用 multi-tenant API                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 修改内容

**1. multi-tenant 扩展认证**

```typescript
// tenant-manager/src/auth.ts

// 现有：Casdoor 认证
export async function verifyCasdoorToken(token: string) {
  // ... 现有实现
}

// 新增：支持 Liuma token
export async function verifyLiumaToken(token: string) {
  // 调用 Liuma API 验证
  const response = await fetch(`${LIUMA_URL}/api/auth/session`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const session = await response.json();
  return {
    userId: session.user.id,
    email: session.user.email,
    source: 'liuma'
  };
}

// 统一认证中间件
export function authenticateEither(req, res, next) {
  const casdoorToken = req.headers['x-casdoor-token'];
  const liumaToken = req.headers['x-liuma-token'];

  if (casdoorToken) {
    return verifyCasdoorToken(casdoorToken).then(user => {
      req.user = user;
      next();
    });
  }

  if (liumaToken) {
    return verifyLiumaToken(liumaToken).then(user => {
      req.user = user;
      next();
    });
  }

  res.status(401).json({ error: 'Unauthorized' });
}
```

**2. instances 表扩展**

```sql
-- 添加跨设备同步字段
ALTER TABLE instances ADD COLUMN sync_id TEXT UNIQUE;
ALTER TABLE instances ADD COLUMN is_synced BOOLEAN DEFAULT false;
ALTER TABLE instances ADD COLUMN last_synced_at TIMESTAMP;

-- 添加设备标识
ALTER TABLE instances ADD COLUMN device_id TEXT;
ALTER TABLE instances ADD COLUMN device_type TEXT; -- 'mobile', 'desktop'

-- 添加更详细的类型字段
ALTER TABLE instances ADD COLUMN instance_type TEXT DEFAULT 'container';
-- 'container', 'hardware', 'external', 'custom'
```

**3. API 扩展**

```typescript
// tenant-manager/src/routes.ts

// 新增：跨设备同步 API
router.post('/instances/sync', authenticateEither, async (req, res) => {
  const { user } = req;
  const instances = await instanceDb.getUserInstances(user.userId);

  // 返回给客户端
  res.json({ instances });
});

// 新增：标记为已同步
router.put('/instances/:instanceId/sync', authenticateEither, async (req, res) => {
  const { instanceId } = req.params;
  await instanceDb.updateInstance(instanceId, {
    is_synced: true,
    last_synced_at: new Date()
  });
  res.json({ success: true });
});
```

**4. Liuma SDK 修改**

```typescript
// @liuma/auth-sdk 指向 multi-tenant API

export class LiumaAuth {
  private config: {
    authCenterUrl: string;  // Liuma 认证地址
    instanceApiUrl: string; // multi-tenant API 地址
  };

  async getHosts(): Promise<HostConfig[]> {
    // 调用 multi-tenant API
    const response = await fetch(`${this.config.instanceApiUrl}/instances`, {
      headers: {
        'X-Liuma-Token': await this.getToken()
      }
    });

    return response.json();
  }

  async addHost(host: Omit<HostConfig, 'id'>): Promise<HostConfig> {
    const response = await fetch(`${this.config.instanceApiUrl}/instances`, {
      method: 'POST',
      headers: {
        'X-Liuma-Token': await this.getToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(host)
    });

    return response.json();
  }
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 统一数据源 | ⚠️ 需要修改 multi-tenant |
| ✅ 功能完整（支持所有实例类型） | ⚠️ 增加复杂度 |
| ✅ 跨设备同步 | ⚠️ 需要数据迁移 |
| ✅ 保留现有 Casdoor | ⚠️ 双认证系统 |

#### 适用场景

- 希望统一数据管理
- 可以接受中等规模改动
- 需要完整的实例管理功能

---

### 方案 C：分支开发（推荐用于实验性）

#### 架构

```
main 分支（稳定版）
├── 保留现有实现
├── Casdoor 认证
└── instances API

auth-refactor 分支（实验版）
├── Liuma 认证集成
├── 跨设备同步
└── 新功能测试
```

#### 实施步骤

**Week 1-2: 创建分支**

```bash
# 从 main 创建功能分支
git checkout -b auth-refactor

# 开发新功能
# - 集成 Liuma 认证
# - 添加跨设备同步
# - 扩展 instances 表
```

**Week 3-4: 并行开发**

```bash
# main 分支：继续维护和 Bug 修复
git checkout main
# ... 修复 Bug ...

# auth-refactor 分支：开发新功能
git checkout auth-refactor
# ... 开发新功能 ...
```

**Week 5: 测试与对比**

```bash
# 部署两个版本进行对比
# main: 部署到 production
# auth-refactor: 部署到 staging

# 收集用户反馈和性能数据
```

**Week 6: 合并或放弃**

```bash
# 选项 A：合并到 main
git checkout main
git merge auth-refactor

# 选项 B：放弃重构
git branch -D auth-refactor
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 不影响稳定版 | ❌ 需要维护两个分支 |
| ✅ 可以充分测试 | ❌ 合并可能冲突 |
| ✅ 随时可以放弃 | ❌ 资源占用 |
| ✅ 降低风险 | ❌ 时间成本高 |

---

### 方案 D：混合方案（推荐用于灵活性）

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     混合架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Liuma（轻量级配置同步）                                    │
│   ├── Better Auth 认证                                      │
│   └── host_configs（仅存储配置）                            │
│       • URL 列表                                            │
│       • 基本元数据（name, description）                     │
│       • 同步标识                                            │
│                                                             │
│  multi-tenant（完整实例管理）                               │
│   ├── Casdoor 认证                                          │
│   └── instances（完整管理）                                 │
│       • 容器生命周期                                        │
│       • 硬件支持                                            │
│       • Portainer 集成                                      │
│                                                             │
│  同步层（新增）                                             │
│   └── 定期从 host_configs 同步到 instances                  │
│       • 或者反之                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 实现方式

**选项 1：Liuma 作为主数据源**

```typescript
// 用户在移动端添加配置
// 1. 保存到 Liuma host_configs
await liumaAuth.addHost({ name: "家里的小主机", url: "..." });

// 2. 同步服务定期推送到 multi-tenant
// backend/sync-service.ts
async function syncToMultiTenant() {
  const hosts = await liumaDb.getHostConfigs();

  for (const host of hosts) {
    await tenantManager.createInstance({
      name: host.name,
      url: host.url,
      type: 'external',
      source: 'liuma-sync'
    });
  }
}
```

**选项 2：multi-tenant 作为主数据源**

```typescript
// 用户在 PC 端创建实例
// 1. 保存到 multi-tenant instances
await createInstance({ name: "test-prod", ... });

// 2. Webhook 推送到 Liuma
// tenant-manager/src/webhook.ts
router.post('/webhooks/instance-created', async (req, res) => {
  const instance = req.body;

  // 推送到 Liuma
  await fetch(`${LIUMA_URL}/api/user/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: instance.name,
      url: instance.url,
      sync_id: instance.instance_id
    })
  });
});
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 保留现有系统 | ❌ 数据同步复杂 |
| ✅ 灵活性高 | ❌ 可能不一致 |
| ✅ 渐进式迁移 | ❌ 需要维护同步逻辑 |
| ✅ 可以随时调整 | ❌ 调试困难 |

---

## 关于 Token 验证性能

之前提到的"token 验证性能影响"是不准确的担忧。让我澄清：

### Token 验证的实际情况

```typescript
// 场景 1：直接验证（每次请求都验证 Liuma token）
router.get('/instances', authenticateEither, async (req, res) => {
  // 每次都要调用 Liuma API 验证 token
  const user = await verifyLiumaToken(req.headers['x-liuma-token']);
  // ...
});

// 问题：
// - 每次请求都需要网络调用到 Liuma
// - 增加延迟（~50-200ms）
```

```typescript
// 场景 2：本地缓存（验证一次后缓存）
const tokenCache = new Map();

async function verifyLiumaTokenWithCache(token: string) {
  if (tokenCache.has(token)) {
    return tokenCache.get(token); // 从缓存读取，无网络调用
  }

  // 首次验证
  const user = await verifyLiumaToken(token);
  tokenCache.set(token, user);

  // 5分钟后过期
  setTimeout(() => tokenCache.delete(token), 5 * 60 * 1000);

  return user;
}

// 优势：
// - 验证一次后，后续请求直接从缓存读取
// - 性能与本地 JWT 相当
```

### 结论

**Token 验证不是性能问题**：
- ✅ 使用缓存后，性能影响可忽略
- ✅ 仅首次验证需要网络调用
- ✅ 缓存有效期内的请求无额外延迟

**真正的性能考虑**：
- 网络延迟：首次验证 ~50-200ms
- 缓存命中：与本地 JWT 相当 < 1ms
- 缓存失效：定期刷新

---

## 方案推荐

### 如果资源有限，求稳

→ **方案 A（保持独立）**

### 如果希望统一，可接受中等改动

→ **方案 B（统一到 multi-tenant）**

### 如果想充分测试，降低风险

→ **方案 C（分支开发）**

### 如果需要最大灵活性

→ **方案 D（混合方案）**

---

## 下一步

1. **明确优先级**：
   - 是否必须跨设备同步？
   - 移动端是否需要完整实例管理？
   - PC 端用户是否需要配置同步？

2. **评估资源**：
   - 开发团队规模
   - 可接受的改动范围
   - 时间压力

3. **选择方案**：
   - 根据上述分析选择合适方案
   - 创建详细的实施计划

4. **验证假设**：
   - 方案 C（分支开发）可以先用最小成本验证
   - 收集真实数据后再做最终决定
