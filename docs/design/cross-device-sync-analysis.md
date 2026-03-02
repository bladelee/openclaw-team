# 跨设备同步与数据存储方案分析

> **日期**: 2025-02-26
> **问题**: 是否需要将 instances 迁移到 Liuma？

---

## 一、什么是"跨设备同步"？

### 1.1 误解澄清

**我之前描述的"跨设备同步"可能是伪需求**，因为：

```
┌─────────────────────────────────────────────────────────────┐
│              multi-tenant 现有架构（已经是跨设备的）        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户 A 在 PC 端创建 instance                              │
│   ↓                                                         │
│  保存在 tenant-manager 数据库（服务器）                     │
│   ↓                                                         │
│  用户 A 在手机上登录 → 同样能看到这个 instance              │
│                                                             │
│  这本来就是跨设备的！                                       │
└─────────────────────────────────────────────────────────────┘
```

**结论**：multi-tenant 的 instances 数据**本身就是跨设备**的，因为存储在服务器。

---

### 1.2 "跨设备同步"的真实场景（是否有必要？）

#### 场景 A：离线使用（移动端 H5）

```
用户在手机上（离线状态）
  ↓
打开 OpenClaw 移动端 H5
  ↓
查看实例列表 → 从 IndexedDB 读取（本地缓存）
  ↓
点击某个实例 → 发现离线，提示"请检查网络"

用户在网络恢复后
  ↓
自动从服务器拉取最新数据
  ↓
更新本地缓存
```

**问题**：
- ✅ 这个场景合理
- ❌ 但 multi-tenant 的 API 本身就可以支持
- ❌ 不需要 Liuma 额外实现"同步"功能

**实现方式**（不需要 Liuma）：
```typescript
// 移动端 H5 直接调用 multi-tenant API
const instances = await fetch('https://tenant-manager.openclaw.app/instances', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 本地缓存到 IndexedDB
await localDB.setInstances(instances);
```

---

#### 场景 B：多系统数据合并（真的有这个需求吗？）

```
假设场景（可能不存在）：
  用户在 PC 端（multi-tenant）创建容器实例
  用户在移动端（H5）添加外部实例
  需要在两个地方都能看到完整的实例列表
```

**问题**：
- ❌ 这是假设的场景，真的有这个需求吗？
- ❌ 移动端 H5 是否需要创建容器实例？
- ❌ 如果不需要，就不存在"数据合并"问题

**现实场景（更可能）**：
```
PC 端（multi-tenant）：
  - 创建容器实例
  - 启动/停止容器
  - 查看日志

移动端 H5：
  - 查看实例列表（只读）
  - 快速访问实例（点击跳转）
  - 可能添加外部实例（手动配置的 URL）
```

**如果这是真实需求**：
- ✅ PC 端管理的容器，移动端自动可见
- ✅ 移动端添加的外部实例，PC 端也能看到
- ✅ 数据来源统一

---

## 二、是否需要迁移 instances 到 Liuma？

### 2.1 数据存储方案对比

| 方案 | 数据存储位置 | 优缺点 |
|------|-------------|--------|
| **方案 1：迁移到 Liuma** | Liuma 数据库 | ❌ 增加复杂度<br>❌ 需要数据迁移<br>❌ 耦合两个系统 |
| **方案 2：保留在 multi-tenant** | multi-tenant 数据库 | ✅ 不迁移<br>✅ 系统解耦<br>⚠️ 需要认证 |
| **方案 3：混合（推荐）** | multi-tenant 为主，Liuma 为辅 | ✅ 灵活性<br>✅ 性能最优 |

---

### 2.2 方案 2 详细分析：保留在 multi-tenant

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    方案 2：不迁移                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Liuma（认证中心）                      │   │
│  │  • 用户认证（Better Auth）                         │   │
│  │  • Token 管理                                       │   │
│  │  • 不存储 instances 数据                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          │ 返回 token                      │
│                          ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          移动端 H5（客户端）                       │   │
│  │                                                     │   │
│  │  1. 使用 Liuma SDK 登录                            │   │
│  │  2. 获取 token                                     │   │
│  │  3. 用 token 调用 multi-tenant API                 │   │
│  │     fetch('/instances', {                         │   │
│  │       headers: { 'Authorization': token }          │   │
│  │     })                                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          │ API 调用                       │
│                          ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       multi-tenant（实例管理）                     │   │
│  │  • instances 数据库                                │   │
│  │  • 验证 Liuma token                                │   │
│  │  • 返回 instances 列表                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 实现

**Liuma（认证中心）**：
```typescript
// Liuma 只负责认证，不存储 instances
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: { clientId: ..., clientSecret: ... },
    github: { clientId: ..., clientSecret: ... }
  }
});

// Liuma API
export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  return Response.json(session);
}
```

**multi-tenant（验证 Liuma token）**：
```typescript
// tenant-manager/src/auth.ts

import jwt from 'jsonwebtoken';

export async function verifyLiumaToken(token: string) {
  try {
    // 方式 1：调用 Liuma API 验证（推荐，更安全）
    const response = await fetch(`${process.env.LIUMA_URL}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const session = await response.json();
    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name
    };

  } catch (error) {
    throw new Error('Token verification failed');
  }
}

// 方式 2：本地验证 JWT（性能更好，需要共享密钥）
export function verifyLiumaTokenLocal(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.LIUMA_JWT_SECRET);
    return {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

// 中间件
export async function authenticateLiuma(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = await verifyLiumaToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

**multi-tenant 路由**：
```typescript
// tenant-manager/src/routes.ts

// 支持两种认证方式
router.get('/instances',
  authenticateEither, // Casdoor 或 Liuma
  async (req, res) => {
    const instances = await instanceDb.getUserInstances(req.user.userId);
    res.json(instances);
  }
);
```

**移动端 H5（使用）**：
```typescript
// app-h5/lib/instances.ts

import { auth } from './auth'; // Liuma SDK

export async function getInstances() {
  // 1. 获取 Liuma token
  const session = await auth.getSession();
  const token = session.token; // 或从 cookie 获取

  // 2. 调用 multi-tenant API
  const response = await fetch('https://tenant-manager.openclaw.app/instances', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch instances');
  }

  return response.json();
}

// 使用
export async function loadInstances() {
  try {
    const instances = await getInstances();

    // 缓存到 IndexedDB（离线支持）
    await localDB.setInstances(instances);

    return instances;
  } catch (error) {
    // 离线时从本地缓存读取
    return await localDB.getInstances();
  }
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 不需要数据迁移 | ⚠️ 需要 Liuma token 验证 |
| ✅ 系统解耦，职责清晰 | ⚠️ 多一次网络调用（可缓存） |
| ✅ instances 功能完整 | ⚠️ 依赖两个服务 |
| ✅ 保留现有 Casdoor | - |
| ✅ 移动端轻量 | - |

---

### 2.3 方案 3 详细分析：混合方案（推荐）

#### 核心思路

**Liuma 存储轻量级配置，multi-tenant 存储完整实例**

```
┌─────────────────────────────────────────────────────────────┐
│              数据分层存储（方案 3）                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Liuma 数据库（用户配置）                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  user_preferences                                   │   │
│  │  ├── user_id                                        │   │
│  │  ├── default_instance_id    (默认实例)              │   │
│  │  ├── recent_instances       (最近使用)              │   │
│  │  ├── pinned_instances       (置顶实例)              │   │
│  │  └── display_settings       (显示设置)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  multi-tenant 数据库（实例数据）                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  instances                                          │   │
│  │  ├── instance_id                                     │   │
│  │  ├── user_id                                         │   │
│  │  ├── name                                            │   │
│  │  ├── type (container/hardware/external)             │   │
│  │  ├── endpoint_id / url                              │   │
│  │  ├── status                                          │   │
│  │  ├── container_id (如果是容器)                      │   │
│  │  └── ... (其他运行时数据)                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 数据职责划分

| 数据类型 | 存储位置 | 理由 |
|---------|---------|------|
| **用户偏好** | Liuma | • 默认实例<br>• 最近使用<br>• 置顶列表 |
| **实例元数据** | multi-tenant | • 实例配置<br>• 运行状态<br>• 容器信息 |
| **运行时数据** | multi-tenant | • 端口、容器 ID<br>• 健康状态<br>• 日志 |

#### API 设计

**Liuma API（用户偏好）**：
```typescript
// 获取用户偏好
GET /api/user/preferences
Response: {
  defaultInstanceId: "abc123",
  recentInstanceIds: ["abc123", "def456"],
  pinnedInstanceIds: ["abc123"],
  displaySettings: { ... }
}

// 更新默认实例
PUT /api/user/preferences/default-instance
Body: { instanceId: "abc123" }

// 添加到最近使用
POST /api/user/preferences/recent
Body: { instanceId: "abc123" }

// 置顶/取消置顶
PUT /api/user/preferences/pinned
Body: { instanceId: "abc123", pinned: true }
```

**multi-tenant API（实例数据）**：
```typescript
// 获取实例列表（不变）
GET /instances
Response: [
  {
    instanceId: "abc123",
    name: "test-prod",
    type: "container",
    status: "running",
    url: "https://test-prod.openclaw.app",
    ...
  }
]

// 获取单个实例详情（不变）
GET /instances/:instanceId

// 创建实例（不变）
POST /instances
```

#### 客户端使用

```typescript
// 移动端 H5

// 1. 获取用户偏好（从 Liuma）
const preferences = await fetch('/api/user/preferences', {
  headers: { 'Cookie': liumaCookie }
});
const { defaultInstanceId, recentInstanceIds } = await preferences.json();

// 2. 获取实例列表（从 multi-tenant）
const instances = await fetch('/instances', {
  headers: { 'Authorization': `Bearer ${liumaToken}` }
});
const allInstances = await instances.json();

// 3. 合并显示
const displayList = allInstances.map(instance => ({
  ...instance,
  isDefault: instance.id === defaultInstanceId,
  isRecent: recentInstanceIds.includes(instance.id),
  isPinned: preferences.pinnedInstanceIds.includes(instance.id)
}));

// 4. 按偏好排序
const sortedList = sortByPreferences(displayList, preferences);
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 职责清晰 | ⚠️ 需要两次 API 调用 |
| ✅ 性能优化（Liuma 数据轻量） | ⚠️ 数据可能不一致 |
| ✅ 灵活性高 | ⚠️ 复杂度略高 |
| ✅ 不破坏现有实现 | - |
| ✅ 更好的用户体验 | - |

---

## 三、其他方案

### 方案 4：完全通过 SDK 集成（最轻量）

#### 架构

```
移动端 H5
  ↓
使用 Liuma SDK（仅认证）
  ↓
SDK 自动调用 multi-tenant API
  ↓
返回合并后的数据
```

#### 实现

```typescript
// @liuma/auth-sdk

export class LiumaAuth {
  private config: {
    authCenterUrl: string;
    instanceApiUrl: string;
  };

  async getInstances(): Promise<Instance[]> {
    // 1. 获取 token（从 cookie 或 storage）
    const token = await this.getToken();

    // 2. 调用 multi-tenant API
    const response = await fetch(`${this.config.instanceApiUrl}/instances`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch instances');
    }

    return response.json();
  }

  // SDK 自动处理 token 刷新
  private async getToken(): Promise<string> {
    let token = await this.storage.get('liuma_token');

    if (this.isTokenExpired(token)) {
      token = await this.refreshToken();
    }

    return token;
  }
}
```

#### 使用

```typescript
// 移动端 H5
import { LiumaAuth } from '@liuma/auth-sdk';

const auth = new LiumaAuth({
  authCenterUrl: 'https://auth.liuma.app',
  instanceApiUrl: 'https://tenant-manager.openclaw.app'
});

// 登录
await auth.login('google');

// 获取实例列表（SDK 自动处理认证）
const instances = await auth.getInstances();
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 最轻量 | ❌ SDK 依赖 multi-tenant |
| ✅ 开发简单 | ❌ SDK 变复杂 |
| ✅ 用户体验好 | - |
| ✅ 不需要数据迁移 | - |

---

## 四、方案对比总结

| 方案 | 数据存储 | 复杂度 | 灵活性 | 推荐度 |
|------|---------|--------|--------|--------|
| **方案 1：迁移到 Liuma** | Liuma | 高 | 低 | ⭐⭐ 不推荐 |
| **方案 2：保留在 multi-tenant** | multi-tenant | 低 | 中 | ⭐⭐⭐⭐ 推荐（保守） |
| **方案 3：混合存储** | 分层 | 中 | 高 | ⭐⭐⭐⭐ 推荐（灵活） |
| **方案 4：SDK 集成** | multi-tenant | 中 | 中 | ⭐⭐⭐⭐ 推荐（简单） |

---

## 五、最终推荐

### 短期（快速实现）

**方案 2 + 方案 4 组合**：
- ✅ 保留 instances 在 multi-tenant
- ✅ Liuma 只负责认证
- ✅ 通过 SDK 集成，简化客户端调用

### 长期（优化体验）

**方案 3（混合存储）**：
- ✅ 用户偏好存储在 Liuma（轻量）
- ✅ 实例数据存储在 multi-tenant（完整）
- ✅ 更好的用户体验

---

## 六、关键结论

1. **不需要迁移 instances 到 Liuma**
   - multi-tenant 的功能更完整
   - 迁移会增加复杂度
   - 通过 API 调用即可

2. **"跨设备同步"不是真正的需求**
   - multi-tenant 本身就是跨设备的
   - 离线支持通过本地缓存实现
   - 不需要额外的"同步"逻辑

3. **Liuma 应该保持轻量**
   - 专注于认证
   - 不存储业务数据
   - 通过 SDK 提供便利

4. **SDK 集成是最佳方案**
   - 简化客户端调用
   - 自动处理认证
   - 不破坏现有架构
