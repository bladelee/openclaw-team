# Liuma 认证集成实施方案

> **日期**: 2025-02-26
> **状态**: 实施阶段

---

## 一、目标

1. **移动端 H5**：集成 Liuma 认证 + 完整 instances CRUD
2. **PC 端 Web**：改为 Liuma 认证，保留 Casdoor 作为备份入口
3. **tenant-manager 后端**：扩展支持 Liuma token 验证
4. **共享认证库**：创建 `src/lib-auth` 供移动端和 PC 端共用

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         认证架构                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Liuma 认证中心（统一认证）                  │    │
│  │  • Better Auth + OAuth (GitHub/Google/Microsoft)       │    │
│  │  • 用户会话管理                                         │    │
│  │  • 不存储 instances 数据                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          │ Token 验证                             │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           tenant-manager（后端服务）                    │    │
│  │  • 验证 Liuma token（主要）                            │    │
│  │  • 验证 Casdoor token（备份）                          │    │
│  │  • instances CRUD                                       │    │
│  │  • 容器生命周期管理                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          │ REST API                              │
│          ┌───────────────┴───────────────┐                     │
│          ▼                               ▼                     │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │  移动端 H5       │           │  PC 端 Web      │              │
│  │  (app-h5)       │           │  (frontend)     │              │
│  │                 │           │                 │              │
│  │  • Liuma 登录   │           │  • Liuma 登录   │              │
│  │  • 完整 CRUD    │           │  • 完整 CRUD    │              │
│  │                 │           │  • Casdoor入口  │              │
│  └─────────────────┘           └─────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、实施计划

### Phase 1: app-h5 基础认证集成（Week 1）

> **使用已实现的 @liuma/auth-sdk**（位置：/home/ubuntu/proj/liuma/packages/auth-sdk/）

#### 1.1 安装 SDK

```bash
# 在 app-h5 目录
cd src/canvas-host/app-h5
pnpm add @liuma/auth-sdk@workspace:*
```

#### 1.2 环境变量

```bash
# src/canvas-host/app-h5/.env

VITE_AUTH_CENTER_URL=https://auth.liuma.app
VITE_APP_ID=openclaw-h5
```

#### 1.3 SDK 初始化

```typescript
// src/canvas-host/app-h5/src/lib/auth.ts

import { LiumaAuth } from '@liuma/auth-sdk';

export const auth = new LiumaAuth({
  authCenterUrl: import.meta.env.VITE_AUTH_CENTER_URL || 'https://auth.liuma.app',
  appId: import.meta.env.VITE_APP_ID || 'openclaw-h5',
  redirectUri: window.location.origin + '/auth/callback',
  storagePrefix: 'openclaw',
  debug: import.meta.env.DEV,
});
```

#### 1.4 认证 Context

```typescript
// src/canvas-host/app-h5/src/contexts/AuthContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LiumaAuth } from '@liuma/auth-sdk';
import type { User, Session } from '@liuma/auth-sdk';

interface AuthContextType {
  auth: LiumaAuth | null;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider?: 'google' | 'github' | 'microsoft' | 'wechat' | 'email') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<LiumaAuth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authInstance = new LiumaAuth({
      authCenterUrl: import.meta.env.VITE_AUTH_CENTER_URL || 'https://auth.liuma.app',
      appId: import.meta.env.VITE_APP_ID || 'openclaw-h5',
      redirectUri: `${window.location.origin}/auth/callback`,
      storagePrefix: 'openclaw',
      debug: import.meta.env.DEV,
    });

    setAuth(authInstance);

    authInstance.getSession().then((session) => {
      if (session) {
        setSession(session);
        setUser(session.user);
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (provider = 'google') => {
    if (!auth) throw new Error('Auth not initialized');
    await auth.login(provider);
  };

  const logout = async () => {
    if (!auth) throw new Error('Auth not initialized');
    await auth.logout();
    setSession(null);
    setUser(null);
  };

  const value: AuthContextType = {
    auth,
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

### Phase 2: tenant-manager 后端改造（Week 1）

#### 2.1 添加 Liuma token 验证

```typescript
// multi-tenant/tenant-manager/src/auth/liuma.ts

import { HTTPClient } from '@liuma/auth-sdk';

/**
 * 验证 Liuma token
 * 调用 Liuma 认证中心的 /api/auth/verify 接口
 */
export async function verifyLiumaToken(
  token: string,
  liumaUrl: string = process.env.LIUMA_URL || 'https://auth.liuma.app'
): Promise<{ userId: string; email: string; name?: string }> {
  const response = await fetch(`${liumaUrl}/api/auth/verify`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Invalid Liuma token');
  }

  const data = await response.json();

  if (!data.valid || !data.userId) {
    throw new Error('No user in session');
  }

  return {
    userId: data.userId,
    email: data.user?.email,
    name: data.user?.name
  };
}
```

#### 2.2 更新认证中间件

```typescript
// openclaw/multi-tenant/tenant-manager/src/auth.ts

import express from 'express';
import jwt from 'jsonwebtoken';

/**
 * 认证中间件 - 支持多种认证方式
 *
 * 优先级：
 * 1. Liuma token (Bearer token)
 * 2. 本地 JWT token
 * 3. Casdoor token
 * 4. 共享 secret
 */
export function authenticateEither(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers['authorization'];

  // 方式 1: 尝试 Liuma Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    verifyLiumaTokenWrapper(token)
      .then(user => {
        req.user = user;
        (req as any).authMethod = 'liuma';
        return next();
      })
      .catch(() => {
        // 继续尝试其他方式
      });

    return; // 等待异步结果
  }

  // 方式 2: 尝试本地 JWT
  if (authHeader) {
    try {
      const decoded = jwt.verify(
        authHeader,
        process.env.JWT_SECRET || 'fallback-secret'
      );
      req.user = decoded;
      (req as any).authMethod = 'local';
      return next();
    } catch {
      // 继续
    }
  }

  // 方式 3: 尝试 Casdoor
  const casdoorToken = req.headers['x-casdoor-token'] as string;
  if (casdoorToken) {
    verifyCasdoorToken(casdoorToken)
      .then(user => {
        req.user = user;
        (req as any).authMethod = 'casdoor';
        return next();
      })
      .catch(() => {
        // 继续
      });

    return;
  }

  // 方式 4: 共享 secret（内部调用）
  const sharedSecret = req.headers['x-shared-secret'] as string;
  if (sharedSecret && sharedSecret === process.env.SHARED_SECRET) {
    req.user = { userId: 'internal', email: 'internal@openclaw' };
    (req as any).authMethod = 'shared-secret';
    return next();
  }

  // 所有方式都失败
  res.status(401).json({ error: 'Unauthorized' });
}
```

#### 2.3 添加可选认证中间件

```typescript
// openclaw/multi-tenant/tenant-manager/src/auth.ts

/**
 * 可选认证 - 允许未登录访问，但会附加用户信息（如果已登录）
 */
export function optionalAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  authenticateEither(req, res, () => {
    // 认证失败也继续
    next();
  });
}
```

#### 2.4 环境变量

```bash
# openclaw/multi-tenant/tenant-manager/.env

# 新增 Liuma 配置
LIUMA_URL=https://auth.liuma.app

# 现有配置保持不变
JWT_SECRET=...
CASDOOR_...
SHARED_SECRET=...
```

---

### Phase 3: PC 端 Web 改造（Week 2）

#### 3.1 登录页面改造

**方案 A：替换为主登录，Casdoor 隐藏**

```typescript
// openclaw/multi-tenant/frontend/src/app/login/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLiumaLogin = (provider: 'google' | 'github' = 'google') => {
    setLoading(true);

    // 重定向到 Liuma 登录
    const params = new URLSearchParams({
      provider,
      redirectURI: `${window.location.origin}/auth/callback`
    });

    window.location.href = `${process.env.NEXT_PUBLIC_LIUMA_URL}/api/auth/signin?${params}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-2xl font-bold text-center mb-6">
            OpenClaw 多租户管理
          </h1>

          {/* Liuma 登录按钮 */}
          <div className="space-y-3">
            <button
              onClick={() => handleLiumaLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentCo