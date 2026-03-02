# Week 2: tenant-manager Liuma 认证集成实施计划

> **日期**: 2026-02-26
> **状态**: 开始实施
> **前置条件**: Week 1 基础认证集成已完成 ✅

---

## 一、目标

1. **tenant-manager 添加 Liuma token 验证**
   - 调用 Liuma 认证中心的 `/api/auth/verify` 接口
   - 验证 Bearer token 并获取用户信息
   - 扩展现有的认证中间件，支持三种认证方式

2. **更新认证中间件**
   - 支持 JWT token (现有)
   - 支持 Liuma token (新增)
   - 支持 Shared Secret (现有)

3. **测试认证流程**
   - 测试 Liuma token 验证
   - 测试多租户场景

---

## 二、实施步骤

### 步骤 1: 添加 Liuma token 验证函数

#### 1.1 创建 Liuma 认证服务

在 `/home/ubuntu/proj/openclaw/multi-tenant/tenant-manager/src/` 创建 `liuma.ts`:

```typescript
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Liuma 认证用户信息
 */
interface LiumaUser {
  userId: string;
  email: string;
  name?: string;
}

/**
 * 验证 Liuma token
 *
 * 调用 Liuma 认证中心的 /api/auth/verify 接口
 */
export async function verifyLiumaToken(token: string): Promise<LiumaUser> {
  const url = `${config.LIUMA_URL || 'https://auth.liuma.app'}/api/auth/verify`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    logger.warn('Liuma token verification failed', {
      status: response.status,
      token: token.substring(0, 10) + '...',
    });
    throw new Error('Invalid Liuma token');
  }

  const data = await response.json();

  if (!data.valid || !data.userId) {
    throw new Error('Invalid Liuma token response');
  }

  return {
    userId: data.userId,
    email: data.user?.email || '',
    name: data.user?.name,
  };
}
```

#### 1.2 更新配置文件

在 `/home/ubuntu/proj/openclaw/multi-tenant/tenant-manager/.env.example` 添加:

```env
# Liuma 认证中心
LIUMA_URL=https://auth.liuma.app
```

---

### 步骤 2: 更新认证中间件

#### 2.1 修改 `authenticateEither` 中间件

在现有的 `auth.ts` 文件中，更新 `authenticateEither` 函数以支持 Liuma token：

```typescript
export function authenticateEither(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const userSignature = req.headers['x-user-signature'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // 尝试 Liuma token 验证（新增）
    verifyLiumaToken(token)
      .then((liumaUser) => {
        req.userId = liumaUser.userId;
        req.userEmail = liumaUser.email;
        (req as any).authMethod = 'liuma';
        next();
      })
      .catch(() => {
        // Liuma 验证失败，尝试 JWT（回退）
        try {
          const payload = verifyToken(token);
          req.userId = payload.userId;
          req.userEmail = payload.email;
          req.userPlan = payload.plan;
          (req as any).authMethod = 'jwt';
          next();
        } catch (jwtError) {
          // JWT 也失败，返回未授权
          res.status(401).json({ error: 'Invalid token' });
        }
      });

    return; // 等待异步结果
  } else if (userSignature) {
    authenticateSharedSecret(req, res, next);
  } else {
    res.status(401).json({ error: 'Missing authorization' });
  }
}
```

#### 2.2 添加专用的 Liuma 认证中间件

```typescript
/**
 * Liuma 认证中间件
 * 仅支持 Liuma Bearer token
 */
export function authenticateLiuma(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  verifyLiumaToken(req)
    .then((liumaUser) => {
      req.userId = liumaUser.userId;
      req.userEmail = liumaUser.email;
      (req as any).authMethod = 'liuma';
      next();
    })
    .catch((error) => {
      logger.warn('Liuma authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(401).json({ error: 'Liuma authentication failed' });
    });
}
```

---

### 步骤 3: 测试认证流程

#### 3.1 单元测试

在 `/home/ubuntu/proj/openclaw/multi-tenant/tenant-manager/tests/liuma.test.ts` 创建测试：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyLiumaToken } from '../src/liuma';

// Mock fetch
global.fetch = vi.fn();

describe('Liuma Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify valid Liuma token', async () => {
    const mockUser = {
      userId: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        userId: 'user-123',
        user: mockUser,
      }),
    } as never);

    const result = await verifyLiumaToken('valid-token');
    expect(result).toEqual(mockUser);
  });

  it('should throw error for invalid token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as never);

    await expect(verifyLiumaToken('invalid-token')).rejects.toThrow('Invalid Liuma token');
  });

  it('should throw error for invalid response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: false,
        userId: null,
      }),
    } as never);

    await expect(verifyLiumaToken('invalid-token')).rejects.toThrow('Invalid Liuma token response');
  });
});
```

#### 3.2 集成测试

更新 `/home/ubuntu/proj/openclaw/multi-tenant/tenant-manager/tests/auth.test.ts` 添加 Liuma token 测试。

---

## 三、环境变量配置

### .env.example 更新

```bash
# Liuma 认证中心
LIUMA_URL=https://auth.liuma.app

# 现有配置
JWT_SECRET=...
SHARED_SECRET_KEY=...
```

### config.ts 更新

在 `/home/ubuntu/proj/openclaw/multi-tenant/tenant-manager/src/config.ts` 添加：

```typescript
liumaUrl: process.env.LIUMA_URL || 'https://auth.liuma.app',
```

---

## 四、API 集成测试

### 测试场景

1. **场景 1**: 使用 Liuma token 访问 instances API
   ```bash
   # 获取 Liuma token
   # 调用 tenant-manager API
   curl -H "Authorization: Bearer <liuma_token>" \
     http://localhost:3000/instances
   ```

2. **场景 2**: 混合认证
   - 用户使用 Liuma 登录后获得 token
   - 使用该 token 访问 tenant-manager API
   - tenant-manager 验证 token 并返回实例列表

3. **场景 3**: 错误处理
   - 无效的 Liuma token
   - 过期的 token
   - 网络错误

---

## 五、时间线

| 任务 | 预计时间 | 状态 |
|------|---------|------|
| 添加 Liuma 认证服务 | 30 分钟 | ⏳ |
| 更新认证中间件 | 30 分钟 | - |
| 编写单元测试 | 30 分钟 | - |
| 集成测试 | 30 分钟 | - |
| 文档更新 | 15 分钟 | - |

**总计**: 2.5 小时

---

## 六、验收标准

- [ ] `verifyLiumaToken` 函数实现
- [ ] `authenticateEither` 中间件支持 Liuma token
- [ ] `authenticateLiuma` 专用中间件
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 使用 Liuma token 可以成功调用 instances API
