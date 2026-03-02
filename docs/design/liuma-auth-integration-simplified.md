# Liuma 认证集成方案（简化版）

> **日期**: 2025-02-26
> **基于用户反馈修正**

---

## 一、核心原则

### 1.1 不需要独立的 SDK

```
openclaw/
├── src/
│   ├── lib-auth/              # 共享认证库（新建）
│   │   ├── liuma.ts          # Liuma 认证逻辑
│   │   ├── token.ts          # Token 管理
│   │   └── index.ts
│   ├── canvas-host/
│   │   └── app-h5/          # 移动端 H5
│   │       └── lib/auth.ts  # 引用共享库
│   └── multi-tenant/
│       ├── frontend/         # PC 端
│       │   └── lib/auth.ts  # 引用共享库
│       └── tenant-manager/  # 后端服务
```

**为什么不用 SDK**：
- ✅ 都在同一个 monorepo
- ✅ 用 workspace 引用更简单
- ✅ 代码复用更容易
- ❌ 不需要发布到 npm

---

### 1.2 移动端与 PC 端功能一致

| 功能 | 移动端 H5 | PC 端 |
|------|----------|------|
| 查看实例列表 | ✅ | ✅ |
| 创建实例 | ✅ | ✅ |
| 更新实例 | ✅ | ✅ |
| 删除实例 | ✅ | ✅ |
| 重启实例 | ✅ | ✅ |
| 查看日志 | ✅ | ✅ |
| 健康检查 | ✅ | ✅ |
| 添加自定义实例 | ✅ | ✅ |
| 扫描本地实例 | ✅ | ✅ |

**结论**：移动端是完整功能，不是只读。

---

### 1.3 multi-tenant 认证扩展

**现状**：
```typescript
// tenant-manager/src/auth.ts

// 已经支持多种认证
export function authenticateEither(req, res, next) {
  // 1. 尝试 Casdoor token
  // 2. 尝试本地 JWT token
  // 3. 尝试共享 secret
}
```

**改造**：
```typescript
// 添加 Liuma 作为第 4 种认证方式
export function authenticateEither(req, res, next) {
  // 1. 尝试 Casdoor token
  // 2. 尝试本地 JWT token
  // 3. 尝试共享 secret
  // 4. 尝试 Liuma token（新增）
}
```

---

## 二、具体实现

### 2.1 共享认证库

```typescript
// openclaw/src/lib-auth/liuma.ts

export interface LiumaConfig {
  authCenterUrl: string;
  appId: string;
}

export interface LiumaSession {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  };
  token: string;
}

/**
 * Liuma 认证客户端
 */
export class LiumaClient {
  private config: LiumaConfig;

  constructor(config: LiumaConfig) {
    this.config = config;
  }

  /**
   * 获取当前会话
   */
  async getSession(): Promise<LiumaSession | null> {
    // 从服务器端获取（服务端渲染）
    const response = await fetch(`${this.config.authCenterUrl}/api/auth/session`, {
      headers: {
        'Cookie': this.getCookies() // 传递 cookie
      }
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  /**
   * 客户端登录（重定向到 Liuma）
   */
  login(provider: 'google' | 'github' | 'microsoft' = 'google') {
    const params = new URLSearchParams({
      provider,
      redirectURI: window.location.origin + '/auth/callback'
    });

    window.location.href = `${this.config.authCenterUrl}/api/auth/signin?${params}`;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    await fetch(`${this.config.authCenterUrl}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Cookie': this.getCookies()
      }
    });

    // 清除本地 cookie
    document.cookie = 'liuma_session=; path=/; max-age=0';
  }

  private getCookies(): string {
    // 返回当前页面的 cookie
    return document.cookie;
  }
}

/**
 * 创建 Liuma 客户端实例
 */
export function createLiumaClient(config: LiumaConfig) {
  return new LiumaClient(config);
}
```

```typescript
// openclaw/src/lib-auth/token.ts

/**
 * Token 验证（用于 tenant-manager）
 */
export async function verifyLiumaToken(
  token: string,
  liumaUrl: string
): Promise<{ userId: string; email: string; name?: string }> {
  const response = await fetch(`${liumaUrl}/api/auth/session`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Invalid Liuma token');
  }

  const session = await response.json();

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name
  };
}
```

---

### 2.2 tenant-manager 认证扩展

```typescript
// openclaw/multi-tenant/tenant-manager/src/auth.ts

import { verifyLiumaToken } from '../../../src/lib-auth/token.js';

// 现有的认证方式
export async function verifyCasdoorToken(token: string) {
  // ... 现有实现不变
}

export function generateLocalToken(payload: any) {
  // ... 现有实现不变
}

// 新增：验证 Liuma token
export async function verifyLiumaTokenWrapper(token: string) {
  return verifyLiumaToken(token, process.env.LIUMA_URL || 'https://auth.liuma.app');
}

// 扩展认证中间件
export function authenticateEither(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    // 尝试其他认证方式（共享 secret 等）
    return authenticateSharedSecret(req, res, next);
  }

  const token = authHeader.replace('Bearer ', '');

  // 尝试本地 JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    // 继续
  }

  // 尝试 Casdoor
  verifyCasdoorToken(token)
    .then(user => {
      req.user = user;
      next();
    })
    .catch(() => {
      // 继续
    });

  // 尝试 Liuma
  verifyLiumaTokenWrapper(token)
    .then(user => {
      req.user = user;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Unauthorized' });
    });
}
```

---

### 2.3 移动端 H5 集成

```typescript
// openclaw/src/canvas-host/app-h5/lib/auth.ts

import { createLiumaClient } from '../../../src/lib-auth/liuma.js';

export const liuma = createLiumaClient({
  authCenterUrl: process.env.NEXT_PUBLIC_AUTH_CENTER_URL || 'https://auth.liuma.app',
  appId: process.env.NEXT_PUBLIC_APP_ID || 'openclaw-h5'
});

// 登录
export async function login() {
  await liuma.login('google');
}

// 登出
export async function logout() {
  await liuma.logout();
}

// 获取会话
export async function getSession() {
  return await liuma.getSession();
}
```

```typescript
// openclaw/src/canvas-host/app-h5/lib/instances.ts

import { getSession } from './auth';

/**
 * 获取实例列表
 */
export async function getInstances() {
  const session = await getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('http://tenant-manager:3000/instances', {
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch instances');
  }

  return response.json();
}

/**
 * 创建实例
 */
export async function createInstance(data: CreateInstanceInput) {
  const session = await getSession();

  const response = await fetch('http://tenant-manager:3000/instances', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to create instance');
  }

  return response.json();
}

/**
 * 更新实例
 */
export async function updateInstance(instanceId: string, data: UpdateInstanceInput) {
  const session = await getSession();

  const response = await fetch(`http://tenant-manager:3000/instances/${instanceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to update instance');
  }

  return response.json();
}

/**
 * 删除实例
 */
export async function deleteInstance(instanceId: string) {
  const session = await getSession();

  const response = await fetch(`http://tenant-manager:3000/instances/${instanceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to delete instance');
  }
}

/**
 * 重启实例
 */
export async function restartInstance(instanceId: string) {
  const session = await getSession();

  const response = await fetch(`http://tenant-manager:3000/instances/${instanceId}/restart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to restart instance');
  }

  return response.json();
}

/**
 * 查看日志
 */
export async function getInstanceLogs(instanceId: string) {
  const session = await getSession();

  const response = await fetch(`http://tenant-manager:3000/instances/${instanceId}/logs`, {
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch logs');
  }

  return response.text();
}

/**
 * 健康检查
 */
export async function checkInstanceHealth(instanceId: string) {
  const session = await getSession();

  const response = await fetch(`http://tenant-manager:3000/instances/${instanceId}/health`, {
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to check health');
  }

  return response.json();
}

/**
 * 添加自定义实例
 */
export async function addCustomInstance(data: CustomInstanceInput) {
  const session = await getSession();

  const response = await fetch('http://tenant-manager:3000/instances/custom', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to add custom instance');
  }

  return response.json();
}

/**
 * 扫描本地实例
 */
export async function scanLocalInstances() {
  const session = await getSession();

  const response = await fetch('http://tenant-manager:3000/instances/scan-local', {
    headers: {
      'Authorization': `Bearer ${session.token}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to scan local instances');
  }

  return response.json();
}
```

---

### 2.4 PC 端集成（保持 Casdoor）

```typescript
// openclaw/multi-tenant/frontend/src/lib/auth.ts

// PC 端继续使用 Casdoor
export { loginWithCasdoor } from './casdoor';

// 或者同时支持两种认证
export async function loginWithLiuma() {
  // 重定向到 Liuma 登录
  window.location.href = `${process.env.LIUMA_URL}/api/auth/signin?provider=google&redirectURI=${window.location.origin}/auth/callback`;
}
```

---

## 三、项目结构

```
openclaw/
├── src/
│   └── lib-auth/                    # 新建共享认证库
│       ├── liuma.ts
│       ├── token.ts
│       └── index.ts
│
├── canvas-host/
│   └── app-h5/
│       ├── lib/
│       │   ├── auth.ts             # 使用 lib-auth
│       │   └── instances.ts        # 完整 CRUD
│       └── app/
│           ├── (auth)/
│           │   ├── login/
│           │   └── callback/
│           └── (main)/
│               └── instances/
│                   ├── page.tsx          # 实例列表
│                   ├── create/
│                   │   └── page.tsx       # 创建实例
│                   ├── [id]/
│                   │   ├── page.tsx       # 实例详情
│                   │   └── edit/
│                   │       └── page.tsx   # 编辑实例
│                   └── scan-local/
│                       └── page.tsx       # 扫描本地
│
└── multi-tenant/
    ├── tenant-manager/
    │   ├── src/
    │   │   ├── auth.ts               # 添加 Liuma 验证
    │   │   └── routes.ts             # 保持不变
    │   └── package.json
    │
    └── frontend/
        └── src/
            └── lib/
                └── auth.ts            # Casdoor 认证
```

---

## 四、环境变量配置

### Liuma

```bash
# .env
AUTH_CENTER_URL=https://auth.liuma.app
BETTER_AUTH_SECRET=your-secret-key
```

### tenant-manager

```bash
# .env
# 新增 Liuma 配置
LIUMA_URL=https://auth.liuma.app

# 现有配置保持不变
CASDOOR_...
JWT_SECRET=...
```

### app-h5

```bash
# .env.local
NEXT_PUBLIC_AUTH_CENTER_URL=https://auth.liuma.app
NEXT_PUBLIC_APP_ID=openclaw-h5
NEXT_PUBLIC_TENANT_MANAGER_URL=http://tenant-manager:3000
```

---

## 五、实施步骤

### Week 1: 共享认证库

```bash
# 1. 创建共享库
mkdir -p openclaw/src/lib-auth

# 2. 实现 Liuma 客户端
touch openclaw/src/lib-auth/liuma.ts
touch openclaw/src/lib-auth/token.ts
touch openclaw/src/lib-auth/index.ts

# 3. 添加到 workspace
# pnpm-workspace.yaml 已包含 openclaw/src
```

### Week 2: tenant-manager 认证扩展

```bash
# 1. 修改认证中间件
# openclaw/multi-tenant/tenant-manager/src/auth.ts
# 添加 verifyLiumaToken 函数

# 2. 扩展 authenticateEither
# 支持第 4 种认证方式

# 3. 测试
curl -H "Authorization: Bearer <liuma_token>" http://localhost:3000/instances
```

### Week 3: 移动端 H5 集成

```bash
# 1. 实现登录/登出
# openclaw/src/canvas-host/app-h5/lib/auth.ts

# 2. 实现 instances CRUD
# openclaw/src/canvas-host/app-h5/lib/instances.ts

# 3. 创建 UI 页面
# 列表、创建、编辑、删除
```

### Week 4: 测试与优化

```bash
# 1. 端到端测试
# 2. 性能优化
# 3. 文档更新
```

---

## 六、优势总结

| 方面 | 优势 |
|------|------|
| **不需要 SDK** | ✅ 共享 lib，代码复用 |
| **认证扩展** | ✅ 只添加一种验证方式 |
| **功能完整** | ✅ 移动端完整 CRUD |
| **保持兼容** | ✅ PC 端继续用 Casdoor |
| **系统解耦** | ✅ Liuma 专注认证 |
| **不迁移数据** | ✅ instances 保留在 multi-tenant |

---

## 七、关键点澄清

1. **lib-auth 不是 SDK**
   - 是 monorepo 内的共享库
   - 用 workspace 引用
   - 不发布到 npm

2. **multi-tenant 认证是扩展**
   - 现有功能不变
   - 添加 Liuma 验证
   - 支持 4 种认证方式

3. **移动端是完整功能**
   - 与 PC 端功能一致
   - 完整的 CRUD
   - 包括所有实例类型

4. **不需要数据迁移**
   - instances 保留在 multi-tenant
   - Liuma 只负责认证
   - 通过 API 调用访问
