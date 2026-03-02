# Liuma 与 multi-tenant 功能重合分析与重构方案

> **日期**: 2025-02-26
> **状态**: 设计阶段

---

## 1. 功能对比分析

### 1.1 Liuma 认证中心功能

| 功能模块 | API 端点 | 说明 |
|---------|---------|------|
| **用户认证** | | |
| 社交登录 | `/api/auth/signin` | OAuth 2.0 (GitHub/Google/Microsoft) |
| 登出 | `/api/auth/signout` | Better Auth 提供的标准接口 |
| 会话管理 | `/api/auth/session` | Cookie-based session |
| **主机配置管理** | | |
| 获取主机列表 | `GET /api/user/hosts` | 用户的所有主机配置 |
| 创建主机配置 | `POST /api/user/hosts` | 添加新的主机配置 |
| 更新主机配置 | `PUT /api/user/hosts/:id` | 修改主机配置 |
| 删除主机配置 | `DELETE /api/user/hosts/:id` | 删除主机配置 |
| 健康检查 | `POST /api/user/hosts/:id/health` | 检查主机在线状态 |
| 跨设备同步 | `POST /api/user/hosts/sync` | 同步主机配置到云端 |
| **用户管理** | | |
| 获取用户信息 | `GET /api/user` | 当前用户信息 |
| 更新用户信息 | `PUT /api/user` | 修改用户信息 |

**数据库表**：
- `users` - 用户基本信息
- `accounts` - OAuth 账户关联
- `sessions` - 会话管理
- `host_configs` - 主机配置存储

---

### 1.2 multi-tenant/tenant-manager 功能

| 功能模块 | API 端点 | 说明 |
|---------|---------|------|
| **用户认证** | | |
| 社交登录 | `/auth/casdoor/login` | Casdoor OAuth |
| OAuth 回调 | `/auth/casdoor/callback` | 处理 Casdoor 回调 |
| Token 验证 | `/auth/casdoor/verify` | 验证 Casdoor token |
| 简化登录 | `/auth/login` | 邮箱密码登录（临时） |
| Token 刷新 | `/auth/refresh` | 刷新 JWT token |
| **实例管理** | | |
| 获取实例列表 | `GET /instances` | 用户的所有实例 |
| 创建实例 | `POST /instances` | 创建新实例（启动容器） |
| 更新实例 | `PUT /instances/:instanceId` | 更新实例配置 |
| 删除实例 | `DELETE /instances/:instanceId` | 删除实例（停止容器） |
| 重启实例 | `POST /instances/:instanceId/restart` | 重启容器 |
| 查看日志 | `GET /instances/:instanceId/logs` | 容器日志 |
| 自定义实例 | `POST /instances/custom` | 添加外部实例 |
| 验证实例 | `POST /instances/custom/validate` | 验证外部实例 |
| 健康检查 | `GET /instances/:instanceId/health` | 容器健康状态 |
| 扫描本地 | `GET /instances/scan-local` | 发现本地实例 |
| **主机/端点管理** | | |
| 获取主机列表 | `GET /hosts` | 所有可用主机（端点） |
| 获取主机详情 | `GET /hosts/:endpointId` | 主机容量信息 |
| **租户管理** | | |
| 获取租户信息 | `GET /tenants/me` | 当前租户信息 |
| 删除租户 | `DELETE /tenants/me` | 删除账户 |

**数据库表**：
- `instances` - 实例信息（容器）
- `host_cache` - 主机（端点）缓存

---

### 1.3 功能重合点

| 重合功能 | Liuma | multi-tenant | 冲突分析 |
|---------|-------|--------------|---------|
| **用户认证** | Better Auth | Casdoor | ⚠️ 不同的认证系统 |
| **主机配置 CRUD** | `host_configs` 表 | `instances` 表 | ⚠️ 概念相似但用途不同 |
| **健康检查** | 主机在线状态 | 容器健康状态 | ✅ 可以统一 |
| **跨设备同步** | ✅ 支持 | ❌ 不支持 | Liuma 特有功能 |

---

### 1.4 关键差异

| 维度 | Liuma `host_configs` | multi-tenant `instances` |
|------|---------------------|------------------------|
| **用途** | 存储用户配置的主机地址 | 管理运行的容器实例 |
| **生命周期** | 静态配置，长期存在 | 动态容器，启动/停止 |
| **所有权** | 用户配置的数据 | 用户运行的实例 |
| **健康检查** | 网络连通性检查 | 容器状态检查 |
| **数据来源** | 用户手动添加 | 容器调度系统创建 |
| **跨设备** | 需要同步 | 无需同步（本地管理） |

---

## 2. 架构问题

### 2.1 当前架构的混乱

```
┌─────────────────────────────────────────────────────────────────┐
│                     当前混乱的架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户                                                           │
│   │                                                            │
│   ├── Liuma 认证（Better Auth）─────→ host_configs 表          │
│   │       存储主机配置                                          │
│   │                                                            │
│   └── multi-tenant（Casdoor）──────→ instances 表              │
│           存储容器实例                                          │
│                                                                 │
│  ❌ 问题：                                                       │
│  1. 两个独立的认证系统                                          │
│  2. 主机配置概念混淆                                            │
│  3. 用户需要理解两者的区别                                       │
│  4. 跨设备同步 vs 本地管理                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 认证流程冲突

**移动端 H5**：
- 使用 Liuma 认证（Better Auth）
- 读取 `host_configs` 表

**PC 端**：
- 使用 multi-tenant 认证（Casdoor）
- 读取 `instances` 表

**结果**：两套完全独立的系统，无法共享用户数据和配置。

---

## 3. 重构方案

### 3.1 目标架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    统一认证架构（推荐）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Liuma 认证中心（统一认证）                  │   │
│  │                                                          │   │
│  │  • 用户认证（Better Auth + OAuth）                       │   │
│  │  • 用户配置管理（host_configs）                          │   │
│  │  • 跨设备同步                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          │ REST API                             │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │       multi-tenant（实例管理服务）                       │   │
│  │                                                          │   │
│  │  • 容器生命周期管理                                      │   │
│  │  • 实例 CRUD（instances 表）                            │   │
│  │  • Portainer 集成                                        │   │
│  │  • 端点容量管理（host_cache）                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 明确职责划分

#### Liuma 认证中心职责

**负责**：
- ✅ 用户身份认证（统一认证源）
- ✅ 主机配置管理（用户配置的主机列表）
  - **定义**：用户想要连接的 OpenClaw Gateway 地址
  - **示例**：`https://openclaw.example.com`, `http://192.168.1.100:3000`
- ✅ 跨设备同步主机配置
- ✅ 用户个人资料管理
- ✅ RBAC 权限管理

**不负责**：
- ❌ 容器生命周期管理
- ❌ 实例调度
- ❌ Portainer 集成

#### multi-tenant/tenant-manager 职责

**负责**：
- ✅ 容器实例管理（启动、停止、重启）
- ✅ 实例 CRUD（instances 表）
  - **定义**：在某个主机上运行的 OpenClaw 容器实例
  - **包含**：container_id、port、status、url
- ✅ Portainer API 调用
- ✅ 主机容量监控（host_cache）
- ✅ 健康检查（容器级别）

**不负责**：
- ❌ 用户认证（使用 Liuma 的认证）
- ❌ 主机配置管理（从 Liuma 获取）

---

### 3.3 数据模型关系

```sql
-- Liuma 数据库（liuma_auth）
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT
);

CREATE TABLE host_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,           -- 用户给主机起的名字
  url TEXT NOT NULL,            -- 主机地址
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  health_status TEXT,           -- online/offline/unknown
  last_health_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- multi-tenant 数据库（tenant_manager）
CREATE TABLE instances (
  instance_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,        -- 引用 Liuma users.id
  name TEXT NOT NULL,           -- 实例名称
  endpoint_id INTEGER,          -- 部署在哪个主机
  container_id TEXT,            -- Portainer container ID
  container_name TEXT,
  port INTEGER,
  gateway_token TEXT,
  url TEXT,                     -- 实例访问 URL
  status TEXT,                  -- creating/running/stopped/error
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE host_cache (
  endpoint_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,           -- 主机名称
  url TEXT,                     -- 主机 API 地址
  status TEXT,                  -- 主机状态
  last_check TIMESTAMP,
  cpu_total REAL,
  memory_total INTEGER,
  instance_count INTEGER
);
```

**关系说明**：
- `host_configs` 表存储用户**配置**的主机地址（用户想用哪些主机）
- `instances` 表存储用户**创建**的实例（实际运行的容器）
- `host_cache` 表存储系统**可用**的主机（管理员配置的端点）

---

### 3.4 API 重构

#### Liuma 认证中心 API（保持不变）

```
POST   /api/auth/signin         # 社交登录
POST   /api/auth/signout        # 登出
GET    /api/auth/session        # 获取会话
GET    /api/user                # 获取用户信息
PUT    /api/user                # 更新用户信息

# 主机配置管理（用户配置的主机列表）
GET    /api/user/hosts          # 获取主机配置列表
POST   /api/user/hosts          # 添加主机配置
PUT    /api/user/hosts/:id      # 更新主机配置
DELETE /api/user/hosts/:id      # 删除主机配置
POST   /api/user/hosts/:id/health  # 检查主机连通性
POST   /api/user/hosts/sync     # 跨设备同步
```

#### multi-tenant/tenant-manager API（修改认证）

```
# 认证（使用 Liuma 的 token）
POST   /auth/verify             # 验证 Liuma token，返回本地 token
POST   /auth/refresh            # 刷新本地 token

# 实例管理（容器实例）
GET    /instances               # 获取用户的实例列表
POST   /instances               # 创建新实例（启动容器）
PUT    /instances/:instanceId   # 更新实例配置
DELETE /instances/:instanceId   # 删除实例（停止容器）
POST   /instances/:instanceId/restart  # 重启实例
GET    /instances/:instanceId/logs     # 查看日志
GET    /instances/:instanceId/health   # 容器健康状态

# 自定义实例（连接外部容器）
POST   /instances/custom        # 添加自定义实例
POST   /instances/custom/validate  # 验证自定义实例

# 主机/端点管理（系统可用主机）
GET    /hosts                   # 获取可用主机列表
GET    /hosts/:endpointId       # 获取主机详情

# 租户信息
GET    /tenants/me              # 获取当前租户信息
```

**认证流程变更**：

```typescript
// 旧流程（Casdoor）
用户 → Casdoor OAuth → multi-tenant token → 访问 API

// 新流程（Liuma）
用户 → Liuma OAuth → Liuma token → 验证 → multi-tenant token → 访问 API
```

---

### 3.5 客户端集成变更

#### 移动端 H5

```typescript
// 使用 Liuma SDK
import { LiumaAuth } from '@liuma/auth-sdk';

const auth = new LiumaAuth({
  authCenterUrl: 'https://auth.liuma.app',
  appId: 'openclaw-h5',
});

// 1. 登录（Liuma）
await auth.login('google');

// 2. 获取用户配置的主机列表
const hosts = await auth.getHosts();
// 返回: [{ id, name, url: 'https://openclaw.example.com' }]

// 3. 选择主机后，获取该主机上的实例
const instances = await fetch(`${host.url}/api/instances`, {
  headers: { Authorization: `Bearer ${liumaToken}` }
});
```

#### PC 端（multi-tenant frontend）

```typescript
// 1. 使用 Liuma 登录
import { LiumaAuth } from '@liuma/auth-sdk/server';

const auth = new LiumaAuth({
  authCenterUrl: 'https://auth.liuma.app',
  appId: 'openclaw-pc',
});

const session = await auth.getSession();
const liumaToken = session.token; // 或从 cookie 获取

// 2. 验证并获取 multi-tenant token
const verifyResponse = await fetch('http://tenant-manager:3000/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: liumaToken })
});

const { token: tenantToken } = await verifyResponse.json();

// 3. 使用 tenantToken 访问实例 API
const instances = await fetch('http://tenant-manager:3000/instances', {
  headers: { Authorization: `Bearer ${tenantToken}` }
});
```

---

### 3.6 数据迁移策略

#### 阶段 1：双认证系统并存（临时）

```typescript
// tenant-manager 添加认证中间件支持
function authenticateEither(req, res, next) {
  // 尝试 Liuma token
  const liumaToken = req.headers['x-liuma-token'];
  if (liumaToken) {
    return verifyLiumaToken(liumaToken).then(next);
  }

  // 尝试 Casdoor token
  const casdoorToken = req.headers['x-casdoor-token'];
  if (casdoorToken) {
    return verifyCasdoorToken(casdoorToken).then(next);
  }

  // 尝试本地 JWT token
  return authenticate(req, res, next);
}
```

#### 阶段 2：数据迁移

```sql
-- 1. 迁移用户数据
INSERT INTO tenant_manager.instances (user_id, ...)
SELECT user_id, ...
FROM liuma_auth.host_configs
WHERE ...;

-- 2. 统一 user_id
-- 确保两个系统使用相同的 user_id
```

#### 阶段 3：移除 Casdoor

```bash
# 删除 Casdoor 相关代码
rm -f tenant-manager/src/casdoor.ts
rm -f tenant-manager/src/routes.ts:casdoor-*

# 更新环境变量
# 删除 CASDOOR_* 相关配置
```

---

## 4. 实施步骤

### Week 1-2: Liuma 认证中心开发

- [ ] 实现 Better Auth 配置
- [ ] 实现 host_configs CRUD API
- [ ] 实现健康检查 API
- [ ] 实现跨设备同步 API
- [ ] 编写单元测试

### Week 3: multi-tenant 认证改造

- [ ] 添加 Liuma token 验证 API
- [ ] 修改认证中间件支持双 token
- [ ] 更新 `/instances` API 使用 Liuma user_id
- [ ] 保留 Casdoor 作为回退（临时）
- [ ] 更新测试

### Week 4: 客户端集成

- [ ] 更新 app-h5 使用 Liuma SDK
- [ ] 更新 multi-tenant frontend 使用 Liuma 认证
- [ ] 实现统一的登录流程
- [ ] 测试跨设备同步

### Week 5: 数据迁移与清理

- [ ] 迁移现有数据到新架构
- [ ] 移除 Casdoor 依赖
- [ ] 清理旧代码
- [ ] 更新文档

---

## 5. 风险与注意事项

### 5.1 认证统一风险

**风险**：一次性移除 Casdoor 可能导致现有用户无法登录

**缓解**：
1. 保留 Casdoor 作为回退选项
2. 分阶段迁移，先让新用户使用 Liuma
3. 提供数据迁移工具

### 5.2 数据一致性

**风险**：host_configs 和 instances 可能不同步

**缓解**：
1. 明确两者的职责边界
2. 定期同步数据
3. 添加监控和告警

### 5.3 性能影响

**风险**：每次请求都需要验证 Liuma token

**缓解**：
1. 使用短期 JWT token 缓存
2. 实现本地 token 刷新机制
3. 添加 Redis 缓存

---

## 6. 总结

### 关键变化

1. **统一认证**：Liuma 作为唯一认证源
2. **职责分离**：
   - Liuma 管理用户和主机配置
   - multi-tenant 管理容器实例
3. **数据明确**：
   - `host_configs` = 用户配置的主机列表
   - `instances` = 运行的容器实例
4. **API 简化**：移除重复的认证 API

### 优势

- ✅ 统一的用户体验
- ✅ 跨设备主机配置同步
- ✅ 更清晰的架构
- ✅ 减少代码重复
- ✅ 更好的安全性

### 下一步

1. 评审本方案
2. 确认实施优先级
3. 创建详细的任务清单
4. 开始实施
