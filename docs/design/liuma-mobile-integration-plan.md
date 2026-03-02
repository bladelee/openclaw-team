# 借鉴 Liuma 移动端实现方案

> **日期**: 2025-02-26
> **目标**: 将 Liuma 的认证集成到 app-h5

---

## 一、Liuma 移动端分析

### 1.1 技术栈对比

| 项目 | 框架 | 构建工具 | 认证方式 |
|------|------|---------|---------|
| **Liuma** | Next.js 15 | Turbopack | Better Auth |
| **app-h5** | React 19 + Vite | Vite 6 | 当前无认证（需集成）|

**关键差异**：
- Liuma 使用 Next.js App Router + Server Components
- app-h5 使用 React + Vite（SPA）
- 两者都是 React，但运行环境不同

---

### 1.2 Liuma 认证实现

#### Better Auth 配置

```typescript
// /home/ubuntu/proj/liuma/src/lib/auth/auth-instance.ts

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin } from "better-auth/plugins";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  plugins: [
    adminPlugin({...}),
    nextCookies(), // Cookie 存储
  ],
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL,
  database: drizzleAdapter(pgDb, {
    schema: { user: UserTable, session: SessionTable, ... }
  }),
  emailAndPassword: {
    enabled: emailAndPasswordEnabled,
    disableSignUp: !signUpEnabled,
  },
  socialProviders: {
    github: socialAuthenticationProviders.github,
    google: socialAuthenticationProviders.google,
    microsoft: socialAuthenticationProviders.microsoft,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 60 },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
});
```

#### 认证组件

```typescript
// /home/ubuntu/proj/liuma/src/components/auth/sign-in.tsx

"use client";

import { authClient } from "auth/client";  // Better Auth 客户端
import { toast } from "sonner";

export default function SignIn({...}) {
  const handleSocialSignIn = (provider: "google" | "github" | "microsoft") => {
    // Better Auth 提供的客户端方法
    authClient.signIn.social({ provider })
      .catch((e) => {
        toast.error(e.error);
      });
  };

  return (
    <div>
      <Button onClick={() => handleSocialSignIn("google")}>
        <GoogleIcon />
        Google
      </Button>
      <Button onClick={() => handleSocialSignIn("github")}>
        <GithubIcon />
        GitHub
      </Button>
    </div>
  );
}
```

#### 认证流程

```
用户点击"Google 登录"
  ↓
authClient.signIn.social({ provider: "google" })
  ↓
Better Auth 重定向到 Google OAuth
  ↓
用户完成授权，回调到 /api/auth/callback
  ↓
Better Auth 创建会话，设置 cookie
  ↓
重定向回 /（或其他页面）
  ↓
后续请求自动携带 cookie
```

---

### 1.3 Liuma 移动端特点

#### 移动端布局

```typescript
// /home/ubuntu/proj/liuma/src/app/mobile/layout.tsx

export default function MobileLayout({ children }) {
  return (
    <div className="mobile-container h-screen w-full overflow-hidden">
      {/* 主内容区域 */}
      <main className="h-full overflow-y-auto pb-16">
        {children}
      </main>

      {/* 底部导航栏 */}
      <MobileTabBar />
    </div>
  );
}
```

#### 移动端特性

1. **视口适配**
```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false, // 禁止缩放
  viewportFit: 'cover', // 适配刘海屏
};
```

2. **底部导航栏**
3. **响应式设计**
4. **触摸优化**

---

## 二、app-h5 现状分析

### 2.1 技术栈

- **框架**: React 19 + Vite 6
- **路由**: React Router（pages 目录结构）
- **状态管理**: React Context + Hooks
- **样式**: CSS 变量

### 2.2 现有页面

```
app-h5/pages/
├── chat/          # 聊天页面（主入口）
├── settings/      # 设置页面
└── canvas/        # Canvas/A2UI 页面
```

### 2.3 无认证状态

- ❌ 没有用户认证
- ❌ 没有会话管理
- ❌ 没有登录页面
- ✅ 直接连接 Gateway WebSocket

---

## 三、集成方案

### 3.1 方案选择

由于 app-h5 是 **Vite + React** 项目，**不是 Next.js**，我们需要：

**方案 A：直接调用 Liuma API（推荐）**

```
app-h5 (Vite + React)
  ↓
不使用 Better Auth SDK
  ↓
直接调用 Liuma 的 REST API
  ↓
手动管理会话（localStorage/cookie）
```

**优势**：
- ✅ 不依赖 Better Auth 客户端（为 Next.js 优化）
- ✅ 更简单直接
- ✅ 完全控制认证流程
- ✅ 与现有 app-h5 架构一致

---

### 3.2 具体实现

#### 步骤 1: 创建登录页面

```typescript
// app-h5/pages/login/page.tsx（新建）

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleIcon, GithubIcon } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const LIUMA_URL = import.meta.env.VITE_LIUMA_URL || 'https://auth.liuma.app';
  const REDIRECT_URI = `${window.location.origin}/auth/callback`;

  const handleLogin = async (provider: 'google' | 'github') => {
    setLoading(true);

    // 重定向到 Liuma 登录
    const params = new URLSearchParams({
      provider,
      redirectURI: REDIRECT_URI,
      appId: 'openclaw-h5'
    });

    window.location.href = `${LIUMA_URL}/api/auth/signin?${params}`;
  };

  return (
    <div className="login-page h-full flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">OpenClaw</h1>
          <p className="text-sm text-gray-600">移动控制中心</p>
        </div>

        {/* 登录按钮 */}
        <div className="space-y-3">
          <button
            onClick={() => handleLogin('google')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border rounded-lg px-4 py-3 hover:bg-gray-50"
          >
            <GoogleIcon className="w-5 h-5" />
            使用 Google 登录
          </button>

          <button
            onClick={() => handleLogin('github')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border rounded-lg px-4 py-3 hover:bg-gray-50"
          >
            <GithubIcon className="w-5 h-5" />
            使用 GitHub 登录
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-center text-sm text-gray-600">
            正在跳转到登录页面...
          </p>
        )}
      </div>
    </div>
  );
}
```

#### 步骤 2: 创建回调页面

```typescript
// app-h5/pages/auth/callback/page.tsx（新建）

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Liuma 会设置 cookie 并重定向回来
        // 我们需要验证会话是否有效

        const response = await fetch('/api/auth/session');

        if (response.ok) {
          const session = await response.json();

          if (session.user) {
            setStatus('success');

            // 保存用户信息到 localStorage
            localStorage.setItem('user', JSON.stringify(session.user));

            // 重定向到聊天页面
            setTimeout(() => {
              navigate('/chat', { replace: true });
            }, 500);
          } else {
            setStatus('error');
          }
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Callback error:', error);
        setStatus('error');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="callback-page h-full flex items-center justify-center">
      {status === 'loading' && (
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在登录...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          <div className="text-green-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold">登录成功！</p>
          <p className="text-gray-600 text-sm mt-2">正在跳转...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold">登录失败</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回登录
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 步骤 3: 创建会话管理服务

```typescript
// app-h5/services/auth/session.ts（新建）

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface Session {
  user: User;
  token: string;
}

/**
 * 会话管理服务
 */
class SessionService {
  private session: Session | null = null;
  private listeners: Set<(session: Session | null) => void> = new Set();

  /**
   * 获取当前会话
   */
  async getSession(): Promise<Session | null> {
    // 优先从内存读取
    if (this.session) {
      return this.session;
    }

    // 从 localStorage 读取
    const stored = localStorage.getItem('session');
    if (stored) {
      try {
        this.session = JSON.parse(stored);
        return this.session;
      } catch {
        return null;
      }
    }

    // 从服务器验证
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        this.session = data;
        localStorage.setItem('session', JSON.stringify(data));
        return data;
      }
    } catch {
      // 忽略错误
    }

    return null;
  }

  /**
   * 登录
   */
  async login(provider: 'google' | 'github' = 'google'): Promise<void> {
    const LIUMA_URL = import.meta.env.VITE_LIUMA_URL || 'https://auth.liuma.app';
    const REDIRECT_URI = `${window.location.origin}/auth/callback`;

    const params = new URLSearchParams({
      provider,
      redirectURI: REDIRECT_URI,
      appId: 'openclaw-h5'
    });

    window.location.href = `${LIUMA_URL}/api/auth/signin?${params}`;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      // 调用 Liuma 登出 API
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // 忽略错误
    }

    // 清除本地会话
    this.session = null;
    localStorage.removeItem('session');
    localStorage.removeItem('user');

    // 通知监听器
    this.notifyListeners(null);

    // 重定向到登录页
    window.location.href = '/login';
  }

  /**
   * 获取用户信息
   */
  getUser(): User | null {
    return this.session?.user || null;
  }

  /**
   * 获取 Token（用于 API 调用）
   */
  async getToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.token || null;
  }

  /**
   * 监听会话变化
   */
  subscribe(callback: (session: Session | null) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(session: Session | null) {
    this.listeners.forEach(callback => callback(session));
  }
}

export const sessionService = new SessionService();
```

#### 步骤 4: 创建 API 代理

由于 app-h5 是 Vite 项目，我们需要创建一个代理来处理跨域和 cookie 转发：

```typescript
// app-h5/services/api/proxy.ts（新建）

const API_BASE = import.meta.env.VITE_TENANT_MANAGER_URL || 'http://localhost:3000';

/**
 * API 请求封装（自动携带认证）
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await sessionService.getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
}

/**
 * 获取实例列表
 */
export async function getInstances(): Promise<Instance[]> {
  const response = await apiRequest('/instances');
  if (!response.ok) {
    throw new Error('Failed to fetch instances');
  }
  return response.json();
}

/**
 * 创建实例
 */
export async function createInstance(data: CreateInstanceInput): Promise<Instance> {
  const response = await apiRequest('/instances', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create instance');
  }
  return response.json();
}

// ... 其他 API 方法
```

#### 步骤 5: 添加 Vite 代理配置

```typescript
// app-h5/vite.config.ts

export default defineConfig({
  plugins: [react()],
  server: {
    port: 18790,
    proxy: {
      // 代理 Liuma API（用于会话验证）
      '/api/auth': {
        target: process.env.VITE_LIUMA_URL || 'https://auth.liuma.app',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 转发 cookie
            proxyReq.setHeader('cookie', proxyReq.headers.cookie);
          });
        },
      },

      // 代理 tenant-manager API（可选，用于开发）
      '/api/instances': {
        target: process.env.VITE_TENANT_MANAGER_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

#### 步骤 6: 环境变量

```bash
# app-h5/.env

# Liuma 配置
VITE_LIUMA_URL=https://auth.liuma.app
VITE_APP_ID=openclaw-h5

# tenant-manager 配置
VITE_TENANT_MANAGER_URL=https://tenant-manager.openclaw.app
```

---

## 四、路由保护

### 4.1 创建路由守卫

```typescript
// app-h5/hooks/useAuthGuard.ts（新建）

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionService } from '../services/auth/session';

export function useAuthGuard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await sessionService.getSession();

        if (session) {
          setAuthenticated(true);
          setLoading(false);
        } else {
          setLoading(false);
          // 未登录，重定向到登录页
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setLoading(false);
        navigate('/login', { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  return { loading, authenticated };
}
```

### 4.2 在页面中使用

```typescript
// app-h5/pages/chat/page.tsx

import { useAuthGuard } from '../../hooks/useAuthGuard';

export default function ChatPage() {
  const { loading, authenticated } = useAuthGuard();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!authenticated) {
    return null; // 会自动重定向到登录页
  }

  // 已登录，显示聊天页面
  return (
    <div>
      <h1>Chat</h1>
      {/* ... */}
    </div>
  );
}
```

---

## 五、借鉴 Liuma 移动端 UI

### 5.1 移动端导航栏

参考 Liuma 的 `MobileTabBar` 组件，为 app-h5 添加底部导航：

```typescript
// app-h5/components/MobileTabBar.tsx（新建）

import { Link } from 'react-router-dom';
import { MessageSquare, Settings } from 'lucide-react';

export function MobileTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
      <div className="flex items-center justify-around h-16">
        <Link
          to="/chat"
          className="flex flex-col items-center justify-center flex-1"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs mt-1">聊天</span>
        </Link>

        <Link
          to="/settings"
          className="flex flex-col items-center justify-center flex-1"
        >
          <Settings className="w-6 h-6" />
          <span className="text-xs mt-1">设置</span>
        </Link>
      </div>
    </nav>
  );
}
```

### 5.2 登录按钮样式

参考 Liuma 的 `sign-in.tsx` 组件：

```typescript
// 使用与 Liuma 一致的按钮样式

<button className="flex items-center justify-center gap-3 border rounded-lg px-4 py-3 hover:bg-gray-50">
  <GoogleIcon className="size-4 fill-foreground" />
  Google
</button>
```

---

## 六、完整集成流程

### 6.1 开发步骤

**Week 1: 基础集成**

1. ✅ 创建登录页面
2. ✅ 创建回调页面
3. ✅ 实现会话服务
4. ✅ 配置 Vite 代理
5. ✅ 添加路由守卫

**Week 2: tenant-manager 集成**

1. ✅ tenant-manager 添加 Liuma token 验证
2. ✅ 创建 instances API 服务
3. ✅ 实现完整 CRUD
4. ✅ 测试认证流程

**Week 3: UI 完善**

1. ✅ 参考 Liuma 移动端 UI
2. ✅ 添加底部导航
3. ✅ 优化移动端体验
4. ✅ 测试与优化

---

## 七、关键代码对比

### Liuma vs app-h5

| 功能 | Liuma (Next.js) | app-h5 (Vite + React) | 实现方式 |
|------|-----------------|----------------------|----------|
| **登录触发** | `authClient.signIn.social()` | `window.location.href = ...` | 直接重定向 |
| **会话获取** | `auth.api.getSession()` | `fetch('/api/auth/session')` | API 调用 |
| **会话存储** | Cookie（自动） | localStorage + 内存 | 手动管理 |
| **Token 管理** | Cookie（自动） | localStorage + 内存 | 手动管理 |
| **路由保护** | Server Components | `useAuthGuard` Hook | 客户端守卫 |

---

## 八、优势与注意事项

### 优势

✅ **不依赖 Better Auth SDK**
- Better Auth 主要为 Next.js 优化
- 直接使用 API 更简单

✅ **完全控制**
- 完全控制认证流程
- 易于调试和定制

✅ **与现有架构一致**
- app-h5 是 Vite 项目
- 不需要引入 Next.js 依赖

### 注意事项

⚠️ **跨域处理**
- 需要配置 Vite 代理
- Liuma 需要允许跨域

⚠️ **Cookie 转发**
- 代理需要正确转发 cookie
- 测试时注意 cookie 域

⚠️ **会话刷新**
- 需要定期刷新会话
- 处理 token 过期

---

## 九、测试清单

### 本地开发

```bash
# 1. 启动 Liuma
cd /home/ubuntu/proj/liuma
pnpm dev

# 2. 启动 tenant-manager
cd /home/ubuntu/proj/openclaw/multi-tenant/tenant-manager
pnpm start

# 3. 启动 app-h5
cd /home/ubuntu/proj/openclaw/src/canvas-host/app-h5
pnpm dev
```

### 测试流程

1. 访问 `http://localhost:18790/chat`
2. 自动重定向到 `/login`
3. 点击"Google 登录"
4. 完成 OAuth 授权
5. 重定向回 `/chat`
6. 显示聊天页面
7. 测试 CRUD 功能

---

## 十、文件清单

### 需要新建的文件

```
app-h5/
├── pages/
│   ├── login/
│   │   └── page.tsx          # 登录页面
│   └── auth/
│       └── callback/
│           └── page.tsx      # 回调页面
├── services/
│   ├── auth/
│   │   └── session.ts       # 会话服务
│   └── api/
│       └── proxy.ts         # API 封装
├── hooks/
│   └── useAuthGuard.ts      # 路由守卫
└── vite.config.ts           # 更新代理配置
```

### 需要修改的文件

```
app-h5/
├── pages/chat/page.tsx      # 添加路由保护
├── App.tsx                   # 添加路由和导航栏
└── .env                      # 添加环境变量
```

---

## 十一、总结

### 核心思路

1. **不使用 Better Auth SDK**
   - 直接调用 Liuma API
   - 更简单直接

2. **手动管理会话**
   - localStorage + 内存
   - 完全控制

3. **Vite 代理**
   - 解决跨域问题
   - 转发 cookie

4. **参考 Liuma UI**
   - 登录按钮样式
   - 移动端布局
   - 用户体验一致

### 与 Liuma 的关系

```
Liuma (认证中心)
  ↓ 提供 API
app-h5 (客户端)
  ↓ 调用 API
显示聊天界面
```

app-h5 不需要复制 Liuma 的认证代码，只需要：
1. 调用 Liuma API 进行认证
2. 调用 tenant-manager API 进行实例管理
3. 显示聊天和控制界面
