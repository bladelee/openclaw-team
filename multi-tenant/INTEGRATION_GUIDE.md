# OpenClaw 多租户系统 - Better-auth + Casdoor 集成方案

> 日期: 2026-02-06
> 技术栈: Next.js + shadcn/ui + Better-auth + Casdoor
> 部署: 自托管

---

## 目录

1. [SSO 方案选择](#sso-方案选择)
2. [Nginx 子域名配置](#nginx-子域名配置)
3. [Better-auth 集成](#better-auth集成)
4. [Casdoor 集成](#casdoor集成)
5. [Next.js API Route 集成](#nextjs-api-route集成)
6. [shadcn/ui 组件](#shadcnui组件)

---

## SSO 方案选择

### 推荐方案：双模式支持

| 方案 | 优势 | 劣势 | 推荐度 |
|------|------|------|--------|
| **Better-auth** | • 原生 Next.js 集成<br>• 类型安全<br>• 自动类型生成 | • 需要配置数据库<br>• 配置相对复杂 | ⭐⭐⭐⭐⭐ |
| **Casdoor** | • 独立 SSO<br>• 统一认证中心<br>• 支持多应用 | • 额外依赖<br>• 网络调用 | ⭐⭐⭐⭐ |

### 推荐策略：混合模式

```
现有系统架构：
┌─────────────────────────────────────────────────────────────┐
│                    你的自托管 Web 应用                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  Better-auth  │    │   Casdoor    │                      │
│  │  (用户登录)    │    │  (管理后台)   │                      │
│  └──────────────┘    └──────────────┘                      │
│         │                    │                               │
│         ▼                    ▼                               │
│  统一用户数据库                                        │
│                                                             │
│  租户管理 API（调用时传递用户信息）                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Nginx 子域名配置

### 完整配置文件

```nginx
# /etc/nginx/conf.d/openclaw-tenants.conf

# upstream 租户管理服务
upstream tenant_manager {
    server 127.0.0.1:3000;
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}

# 租户容器后端（动态）
map $http_host $tenant_backend {
    default "";
}

# 租户子域名服务器
server {
    listen 443 ssl http2;
    server_name *.openclaw.app;

    # SSL 证书（使用 Let's Encrypt 通配符证书）
    ssl_certificate /etc/letsencrypt/live/openclaw.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.app/privkey.pem;

    # SSL 优化
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # 日志
    access_log /var/log/nginx/tenant-access.log tenant;
    error_log /var/log/nginx/tenant-error.log warn;

    # 租户管理 API 路由（仅内网访问）
    location /api/ {
        # 限制只允许内网访问
        allow 127.0.0.1;
        deny all;

        proxy_pass http://tenant_manager;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 租户子域名路由（WebSocket 支持）
    location / {
        # 内部路由查询
        auth_request /api/internal/route;
        auth_request_set $backend_target $upstream_http_x_target;

        if ($backend_target = "") {
            return 502 '{"error":"Tenant not available"}';
            add_header Content-Type application/json;
        }

        # 代理到租户容器
        proxy_pass $backend_target/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-ForwardedFor $proxy_add_x_forwarded_for;
        proxy_set_header X-ForwardedProto $scheme;

        # WebSocket 超时时配置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;

        # 禁用缓冲（WebSocket）
        proxy_buffering off;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name *.openclaw.app;

    location / {
        return 301 https://$host$request_uri;
    }
}
```

---

## Better-auth 集成

### 1. 安装依赖

```bash
cd /path/to/your/nextjs/app
pnpm add better-auth @auth/prisma-adapter
```

### 2. 配置 Better-auth

```typescript
// auth.ts
import NextAuth from "next-auth";
import CasdoorProvider from "next-auth/providers/casdoor";
import { PrismaAdapter } from "@auth/prisma-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CasdoorProvider({
      clientId: process.env.CASDOOR_CLIENT_ID!,
      clientSecret: process.env.CASDOOR_CLIENT_SECRET!,
      issuer: process.env.CASDOOR_ISSUER,
    }),
  ],
  adapter: PrismaAdapter,
  callbacks: {
    async session({ session, user }) {
      session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 天
    updateAge: 24 * 60 * 60, // 24 小时
  },
});

export const { auth, signIn, signOut } = auth;
```

### 3. 服务端获取用户

```typescript
// app/api/auth/[...]/route.ts
import { auth } from "@/auth";
import { NextRequest } from "next-auth";

export const authConfig = {
  providers: [CasdoorProvider],
};

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  });
}
```

---

## Casdoor 集成（管理后台）

### 1. Casdoor 配置

在 Casdoor 管理后台添加应用：

```
应用名称: OpenClaw Tenant Manager
回调地址: https://your-app.com/api/auth/callback
认证方式: JWT
   签名算法: RS256
   有效期: 30 天
权限: user_info
```

### 2. 环境变量

```bash
NEXTAUTH_CASDOOR_CLIENT_ID=your-client-id
NEXTAUTH_CASDOOR_CLIENT_SECRET=your-client-secret
NEXTAUTH_CASDOOR_ISSUER=https://your-casdoor.com
```

---

## 租户管理 API 认证中间件

### 共享密钥认证（推荐）

```typescript
// tenant-manager/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const SHARED_SECRET = process.env.SHARED_SECRET_KEY || 'dev-secret';

function generateHMAC(payload: string): string {
  return crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(payload)
    .digest('hex');
}

function verifyHMAC(payload: string, signature: string): boolean {
  const expected = generateHMAC(payload);
  const timingSafeCompare = crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
  return timingSafeCompare;
}

export function authenticateSSO(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // 从请求头获取用户信息
  const userId = req.headers['x-user-id'] as string;
  const userEmail = req.headers['x-user-email'] as string;
  const userSignature = req.headers['x-user-signature'] as string;

  if (!userId || !userEmail) {
    return res.status(401).json({ error: 'Missing user information' });
  }

  // 验证签名（时间戳验证）
  const receivedParts = userSignature.split(':');
  const timestamp = parseInt(receivedParts[1] || '0', 10);
  const timeDiff = Math.abs(Date.now() - timestamp);

  if (timeDiff > 300000) { // 5 分钟
    return res.status(401).json({ error: 'Signature expired' });
  }

  if (!verifyHMAC(receivedParts[0], userSignature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 附加用户信息到请求
  req.userId = userId;
  req.userEmail = userEmail;

  next();
}
```

---

## Next.js API Route 集成

### API 客户端库

```typescript
// lib/tenant-client.ts
const TENANT_API_URL = process.env.TENANT_API_URL || 'http://localhost:3000';
const SHARED_SECRET = process.env.SHARED_SECRET_KEY![];

function generateSignature(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(payload)
    .digest('hex');
  return `${signature}:${timestamp}`;
}

export async function createTenant(
  userId: string,
  userEmail: string,
  plan: 'basic' | 'pro' | 'enterprise' = 'basic'
): Promise<any> {
  const signature = generateSignature(userId);

  const response = await fetch(`${TENANT_API_URL}/api/tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': userId,
      'X-User-Email': userEmail,
      'X-User-Signature': signature,
    },
    body: JSON.stringify({
      email: userEmail,
      plan,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create tenant: ${error}`);
  }

  return response.json();
}

export async function getMyTenant(userId: string): Promise<any> | null> {
  const signature = generateSignature(userId);

  const response = await fetch(`${TENANT_API_URL}/api/tenants/me`, {
    method: 'GET',
    headers: {
      'X-User-ID': userId,
      'X-User-Signature': signature,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function deleteMyTenant(userId: string): Promise<boolean> {
  const signature = generateSignature(userId);

  const response = await fetch(`${TENANT_API_URL}/api/tenants/me`, {
    method: 'DELETE',
    headers: {
      'X-User-ID': userId,
      'X-User-Signature': signature,
    },
  });

  return response.ok;
}
```

### Server Actions

```typescript
// app/actions/tenants.ts
'use server';

import { z } from 'zod';
import { auth } from "@/auth";
import { createTenant, getMyTenant, deleteMyTenant } from "@/lib/tenant-client";
import { revalidatePath } from "@/lib/revalidate";

const createTenantSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['free', 'basic', 'pro', 'enterprise']).optional().default('basic'),
});

export const createTenantAction = auth.action(
  async ({ session }, formData) => {
    const validated = createTenantSchema.parse(formData);

    const tenant = await createTenant(
      session.user.id,
      session.user.email,
      validated.plan
    );

    revalidatePath('/dashboard/tenants');

    return {
      success: true,
      tenant,
    };
  }
);

const deleteTenantAction = auth.action(
  async ({ session }) => {
    const success = await deleteMyTenant(session.user.id);

    revalidatePath('/dashboard/tenants');

    return { success };
  }
);
```

---

## shadcn/ui 组件

### 1. 创建租户对话框

```typescript
// components/tenants/create-tenant-dialog.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createTenantAction } from "@/app/actions/tenants";

const plans = [
  { value: 'free', label: 'Free (0.5核, 512MB)', description: '适合个人测试' },
  { value: 'basic', label: 'Basic (1核, 1GB)', description: '适合个人使用' },
  { value: 'pro', label: 'Pro (2核, 2GB)', description: '适合团队使用' },
  { value: 'enterprise', label: 'Enterprise (4核, 4GB)', description: '适合企业使用' },
];

export function CreateTenantDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<'free' | 'basic' | 'pro' | 'enterprise'>('basic');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建 OpenClaw 实例</DialogTitle>
        </DialogHeader>

        <form action={createTenantAction}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择计划</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-sm text-muted-foreground">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit">创建实例</Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </Dialog>
);
}
```

### 2. 租户列表组件

```typescript
// components/tenants/tenant-list.tsx
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyTenant, deleteMyTenant } from "@/lib/tenant-client";
import { useSession } from "next-auth/react";

export function TenantList() {
  const { data: session } = useSession();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      loadTenant();
    }
  }, [session]);

  const loadTenant = async () => {
    setLoading(true);
    try {
      const data = await getMyTenant(session.user.id);
      setTenant(data);
    } catch (error) {
      console.error('Failed to load tenant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;

    const confirmed = confirm('确定要删除这个实例吗？');
    if (!confirmed) return;

    const success = await deleteMyTenant(session.user.id);
    if (success) {
      setTenant(null);
    }
  };

  if (!session) {
    return <div>请先登录</div>;
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!tenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>我的 OpenClaw 实例</CardTitle>
          <CardDescription>管理您的 OpenClaw 租户实例</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            您还没有创建 OpenClaw 实例。点击"创建实例"开始使用。
          </p>
        </CardContent>
        <CardFooter>
          <CreateTenantDialog>
            <Button variant="outline">创建实例</Button>
          </CreateTenantDialog>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>我的 OpenClaw 实例</CardTitle>
        <CardDescription>
          管理您的 OpenClaw 租户实例
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">实例地址</p>
          <code className="block w-full p-2 bg-muted rounded text-sm">
            {tenant.url}
          </code>
        </div>

        <div>
          <p className="text-sm font-medium">状态</p>
          <Badge variant={tenant.status === 'running' ? 'success' : 'secondary'}>
            {tenant.status === 'running' ? '运行中' : '已停止'}
          </Badge>
        </div>

        <div>
          <p className="text-sm font-medium">计划</p>
          <Badge variant="outline">{tenant.plan}</Badge>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            创建于: {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={() => window.open(tenant.url, '_blank')}>
          打开控制台
        </Button>

        <Button variant="destructive" onClick={handleDelete}>
          删除实例
        </Button>
      </CardFooter>
    </Card>
  );
}
```

---

## 环境变量配置

```bash
# .env.local

# Better-auth
NEXTAUTH_URL=http://localhost:3000/api/auth
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars

# Casdoor
NEXTAUTH_CASDOOR_CLIENT_ID=your-casdoor-client-id
NEXTAUTH_CASDOOR_CLIENT_SECRET=your-casdoor-client-secret
NEXTAUTH_CASDOOR_ISSUER=https://your-casdoor.com

# 租户管理 API
TENANT_API_URL=http://localhost:3000
SHARED_SECRET_KEY=your-shared-secret-min-32-chars
```

---

## 部署步骤

### 1. 配置环境

```bash
cd multi-tenant
cp .env.example .env
# 编辑 .env 文件
```

### 2. 启动服务

```bash
./scripts/start.sh
```

### 3. 配置 SSL 证书

```bash
# 安装 Certbot
sudo apt update && sudo apt install certbot python3-certbot-nginx

# 获取通配符证书
sudo certbot certonly --nginx -d *.openclaw.app \
  --email your-email@example.com \
  --agree-tos --noninteractive

# 证书保存位置
# /etc/letsencrypt/live/openclaw.app/fullchain.pem
# /etc/letsencrypt/live/openclaw.app/privkey.pem
```

### 4. 配置 Nginx

```bash
# 复制配置
sudo cp nginx.conf /etc/nginx/conf.d/openclaw-tenants.conf

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 5. 配置 DNS

```
类型: A 记录
名称: *.openclaw.app
值: 你的服务器公网 IP
```

---

## 总结

### 推荐实现方案

**Better-auth 用于终端用户**：
- ✅ 与 Next.js 深度集成
- ✅ 类型安全
- ✅ 自动代码生成

**Casdoor 用于管理后台**：
- ✅ 独立认证
- ✅ 支持多应用管理

**API 认证**：
- ✅ 共享密钥认证（最简单）
- ✅ HMAC 签名验证
- ✅ 时间戳防重放

### 工作量

| 任务 | 工作量 | 说明 |
|------|--------|------|
| Nginx 配置 | 1h | 子域名路由 |
| API 认证中间件 | 2h | HMAC 签名 |
| Next.js Server Actions | 2h | API 调用 |
| shadcn/ui 组件 | 4h | 前端界面 |

**总计：约 1 个工作日**
