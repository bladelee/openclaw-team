# OpenClaw 多租户平台部署方案

> 本文档详细说明了 OpenClaw 多租户平台的各种部署方案，包括独立部署、Next.js 合并部署，以及类似 Vercel 的自托管方案。

## 目录

- [架构概览](#架构概览)
- [方案 1: 独立部署](#方案-1-独立部署)
- [方案 2: Next.js 合并部署](#方案-2-nextjs-合并部署)
- [方案 3: 一键自托管部署](#方案-3-一键自托管部署)
- [方案对比](#方案对比)
- [生产环境最佳实践](#生产环境最佳实践)

---

## 架构概览

### 当前系统组成

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐         ┌─────────────────────┐       │
│  │   app-h5 (移动端)   │         │  Frontend (PC 端)   │       │
│  │   React + Vite      │         │    Next.js          │       │
│  │   Port: 18795       │         │    Port: 3002       │       │
│  └─────────────────────┘         └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↓               ↓
┌─────────────────────────────────────────────────────────────────┐
│                         后端层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐         ┌─────────────────────┐       │
│  │  Liuma Auth Center  │         │  tenant-manager     │       │
│  │  认证中心            │         │  业务后端            │       │
│  │  Port: 3005         │         │  Port: 3000         │       │
│  └─────────────────────┘         └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                            ↓               ↓
┌─────────────────────────────────────────────────────────────────┐
│                         数据层                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐         ┌─────────────────────┐       │
│  │    PostgreSQL       │         │       Redis         │       │
│  │  用户/租户数据        │         │   缓存/队列          │       │
│  │  Port: 5432         │         │   Port: 6379        │       │
│  └─────────────────────┘         └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 认证流程

#### 内嵌式邮箱密码登录
```
用户 → app-h5 → Liuma Auth SDK → Auth Center API
       (本地)     (内嵌式)           (直接调用)
```

#### OAuth 第三方登录
```
用户 → app-h5 → 重定向到 Auth Center → OAuth Provider
      (跳转)     (Google/GitHub)        (授权)
        ↓                                    ↓
      回调到 app-h5/auth/callback ← Auth Center
```

---

## 方案 1: 独立部署

### 方案概述

**定义**: 前端和后端分别独立部署，互不依赖，通过 Nginx 反向代理统一入口。

### 架构图

```
┌───────────────────────────────────────────────────────────────────┐
│                         用户浏览器                                  │
│                    访问 https://app.openclaw.com                   │
└───────────────────────────────────────────────────────────────────┘
                                  ↓
┌───────────────────────────────────────────────────────────────────┐
│                        Nginx (单入口)                              │
│                                                                       │
│  路由规则:                                                           │
│  • /                    → 前端静态文件                             │
│  • /api/*               → tenant-manager:3000                     │
│  • /api/auth/*          → auth-center:3005                        │
│  • /auth/callback       → OAuth 回调处理                           │
└───────────────────────────────────────────────────────────────────┘
         ↓                    ↓                        ↓
┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│ app-h5 静态   │     │ tenant-      │      │  auth-center │
│ 文件服务      │     │ manager      │      │              │
│              │     │ :3000        │      │  :3005       │
└──────────────┘     └──────────────┘      └──────────────┘
```

### 部署步骤

#### 1. 构建前端

```bash
# 构建 app-h5 移动端
pnpm run app:h5:build
# 输出: dist/app-h5/

# 构建 PC 前端
cd multi-tenant/frontend
pnpm run build
# 输出: .next/
```

#### 2. 使用 Docker Compose 一键部署

```bash
cd /home/ubuntu/proj/openclaw/multi-tenant

# 配置环境变量
cp .env.production .env
vim .env  # 填写生产环境配置

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看运行状态
docker-compose -f docker-compose.prod.yml ps
```

#### 3. Nginx 配置

```nginx
# /etc/nginx/sites-available/openclaw
upstream auth_center {
    server localhost:3005;
}

upstream tenant_manager {
    server localhost:3000;
}

upstream frontend_h5 {
    server localhost:3001;  # 如果使用独立静态服务
}

server {
    listen 80;
    server_name app.openclaw.com;

    # 前端静态文件
    location / {
        root /var/www/app-h5;
        try_files $uri $uri/ /index.html;
    }

    # 业务 API
    location /api/ {
        proxy_pass http://tenant_manager/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 认证 API
    location /api/auth/ {
        proxy_pass http://auth_center/api/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # OAuth 回调
    location /auth/callback {
        root /var/www/app-h5;
        try_files $uri $uri/ /index.html;
    }
}
```

### 优点

- ✅ 前后端完全解耦，独立开发和部署
- ✅ 可以独立扩展（前端用 CDN，后端用负载均衡）
- ✅ 技术栈灵活，前端可以随时替换
- ✅ 静态资源可以充分利用 CDN 缓存

### 缺点

- ⚠️ 需要处理 CORS 跨域问题
- ⚠️ 需要配置 Nginx（有一定学习成本）
- ⚠️ 前端需要知道后端地址（环境变量配置）

### 适用场景

- 前后端由不同团队开发
- 需要独立扩展和优化
- 想要快速上线，不想重构代码

---

## 方案 2: Next.js 合并部署

### 方案概述

**定义**: 将 app-h5 的代码迁移到现有的 Next.js 项目中，统一管理 PC 端和移动端。

### 迁移前后对比

#### 迁移前（独立部署）

```
├── multi-tenant/frontend/    ← Next.js (PC 端)
│   └── src/app/
│       ├── login/            ← PC 登录页
│       └── dashboard/        ← PC 仪表板
│
└── src/canvas-host/app-h5/   ← React + Vite (移动端)
    ├── App.tsx
    ├── src/pages/
    │   ├── login/           ← 移动端登录页
    │   ├── register/        ← 移动端注册页
    │   └── instances/       ← 移动端实例列表
    └── vite.app-h5.config.ts
```

#### 迁移后（统一管理）

```
└── multi-tenant/frontend/    ← Next.js (统一入口)
    └── src/app/
        ├── (pc)/             ← 路由组: PC 端
        │   ├── login/
        │   │   └── page.tsx
        │   └── dashboard/
        │       └── page.tsx
        │
        └── (mobile)/         ← 路由组: 移动端
            ├── layout.tsx    ← 移动端特定布局
            ├── login/
            │   └── page.tsx  ← 从 app-h5 迁移
            ├── register/
            │   └── page.tsx  ← 从 app-h5 迁移
            └── instances/
                └── page.tsx  ← 从 app-h5 迁移
```

### 迁移步骤

#### 步骤 1: 创建移动端路由组

```typescript
// multi-tenant/frontend/src/app/(mobile)/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="OpenClaw 移动控制中心" />
      </head>
      <body className="mobile">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

#### 步骤 2: 迁移登录页面

```typescript
// multi-tenant/frontend/src/app/(mobile)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';  // 改用 Next.js Router
import { signInWithEmailAndPassword } from '@liuma/auth-sdk';

export default function MobileLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await signInWithEmailAndPassword(email, password);
      router.push('/mobile/instances');  // 使用 Next.js 路由
    } catch (err: any) {
      const errorMessage = err?.message || err?.error || '登录失败，请检查邮箱和密码';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* UI 代码基本保持不变 */}
      </div>
    </div>
  );
}
```

#### 步骤 3: 迁移其他页面

按照相同步骤迁移：
- `register/` → `/mobile/register/page.tsx`
- `forgot-password/` → `/mobile/forgot-password/page.tsx`
- `instances/` → `/mobile/instances/page.tsx`

#### 步骤 4: 根据设备自动跳转（可选）

```typescript
// multi-tenant/frontend/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const isMobile = /iPhone|iPad|Android|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      router.push('/mobile/login');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">跳转中...</p>
      </div>
    </div>
  );
}
```

### 代码迁移对照表

| React + Vite (app-h5) | Next.js (迁移后) |
|----------------------|-----------------|
| `import { useNavigate } from "react-router-dom"` | `import { useRouter } from "next/navigation"` |
| `const navigate = useNavigate()` | `const router = useRouter()` |
| `navigate("/path")` | `router.push("/path")` |
| `import { Link } from "react-router-dom"` | `import Link from "next/link"` |
| `<Link to="/path">` | `<Link href="/path">` |
| `export function Component()` | `'use client'; export default function Component()` |
| `App.tsx` 路由配置 | `app/` 目录文件系统路由 |

### 优点

- ✅ 统一管理 PC 和移动端代码
- ✅ 可以共享认证逻辑、组件、工具函数
- ✅ 类型安全（端到端 TypeScript）
- ✅ 可以使用 Next.js API Routes 做 BFF 层
- ✅ 支持 SSR/SSG（如果需要 SEO）
- ✅ 维护成本低，只需要一个项目

### 缺点

- ⚠️ 需要迁移代码（主要是复制粘贴 + 调整）
- ⚠️ 需要团队熟悉 Next.js
- ⚠️ PC 和移动端路由混在一起（可以通过路由组解决）

### 适用场景

- 需要统一管理 PC 和移动端
- 需要共享代码和逻辑
- 准备长期维护项目
- 团队熟悉 Next.js

---

## 方案 3: 一键自托管部署

### 方案概述

如果你觉得 Nginx 配置复杂，可以使用以下**类似 Vercel 但可以自托管**的平台：

---

### 🎯 推荐方案对比：Coolify vs Dokploy

针对你的场景（**大量小应用 + 统一认证入口**），我们重点对比 Coolify 和 Dokploy：

#### 快速决策表

| 场景需求 | Coolify | Dokploy | 推荐 |
|---------|---------|---------|------|
| **大量小应用管理** | 280+ 模板，一键部署 | 模板少，需手动配置 | ✅ **Coolify** |
| **统一认证入口** | 单一域名单点登录 | 支持多域名 | ✅ **Coolify** |
| **团队协作** | 基础权限管理 | 高级 RBAC | ✅ **Dokploy** |
| **多服务器扩展** | 实验性功能 | 原生支持 | ✅ **Dokploy** |
| **快速上手** | 更简单，文档丰富 | 稍复杂 | ✅ **Coolify** |
| **自动 HTTPS** | 开箱即用 | 需手动配置 | ✅ **Coolify** |
| **监控和日志** | 基础监控 | 实时详细监控 | ✅ **Dokploy** |

#### 详细对比

| 对比维度 | Coolify | Dokploy |
|---------|---------|---------|
| **GitHub Stars** | ~50,000+ | ~24,000+ |
| **开发语言** | PHP | TypeScript |
| **成熟度** | 更成熟 | 较新 |
| **核心定位** | 全功能 PaaS | Docker 原生工作流 |
| **UI 设计** | 功能丰富，菜单清晰 | 更简洁现代 |
| **部署模板** | **280+ 一键模板** | 较少 |
| **自动 SSL** | ✅ 自动配置 | ⚠️ 需手动设置 |
| **多服务器** | ⚠️ 实验性功能 | ✅ 原生稳定支持 |
| **水平扩展** | ❌ 仅 Docker Swarm | ✅ Traefik 负载均衡 |
| **Git 集成** | GitHub, GitLab | GitHub, GitLab, **Bitbucket**, **Gitea** |
| **实时监控** | 容器级别 | ✅ CPU/内存/存储/网络全监控 |
| **团队权限** | 基础共享 | ✅ 高级 RBAC |
| **API 文档** | 有 | ✅ Swagger/OpenAPI |
| **一键应用** | Supabase, Plausible, n8n 等 | 较少 |
| **Cloudflare Tunnel** | ✅ | ❌ |
| **Preview 部署** | ✅ | ❌ |
| **资源占用** | ~9% CPU, 41% RAM | ~9% CPU, 44% RAM |
| **最低配置** | 2核, 2GB RAM, 30GB 存储 | 2核, 2GB RAM, 30GB 存储 |

#### 针对你的场景分析

**你的需求**:
1. ✅ 大量 PC 端和移动端小应用
2. ✅ 统一认证入口（Liuma Auth Center）
3. ✅ 快速发布和迭代
4. ✅ 多用户/团队协作

**推荐：Coolify** ⭐⭐⭐⭐⭐

**理由**:

| 需求 | Coolify 优势 |
|------|-------------|
| **大量小应用** | 280+ 一键模板，可以快速部署常见服务（数据库、缓存、监控等） |
| **统一认证** | 单一域名单点登录，所有应用使用同一个域名和 SSL 证书 |
| **快速发布** | Git Push 自动部署，无需手动配置 Nginx |
| **团队协作** | 虽然权限管理不如 Dokploy，但对于中小团队足够 |

**Dokploy 更适合的场景**:
- 需要多服务器部署和负载均衡
- 需要更细粒度的团队权限控制（RBAC）
- 需要更详细的实时监控
- 使用 Bitbucket 或 Gitea 作为 Git 仓库

---

### 方案 A: Coolify ⭐⭐⭐⭐⭐ 强烈推荐

#### 特点

- ✅ 开源 Vercel 替代品（50,000+ GitHub Stars）
- ✅ 一键部署 Docker 应用
- ✅ **280+ 应用模板**（PostgreSQL, Redis, MySQL, MongoDB 等）
- ✅ 自动 HTTPS (Let's Encrypt)
- ✅ 自动 CI/CD (连接 Git 仓库)
- ✅ 可视化管理面板
- ✅ 内置监控和日志
- ✅ 单一域名单点登录

#### 安装

```bash
# 方法 1: 使用官方一键安装脚本
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 方法 2: Docker Compose
git clone https://github.com/coollabsio/coolify.git
cd coolify
./install.sh

# 访问: http://your-server-ip:3000
```

#### 配置 OpenClaw

**1. 部署认证中心（Auth Center）**

在 Coolify 面板中：
- 创建新项目 → 选择 "Docker Compose"
- 连接 Git 仓库或直接输入配置
- 配置环境变量
- 点击 "Deploy"

**2. 部署业务后端（tenant-manager）**

- 创建新项目 → 选择 "Dockerfile"
- 连接 Git 仓库
- 配置环境变量（数据库连接、认证中心地址等）
- 点击 "Deploy"

**3. 部署前端应用（PC + H5）**

- 创建新项目 → 选择 "Nixpacks" (自动检测框架)
- 连接 Git 仓库
- 构建命令会自动识别
- 点击 "Deploy"

**4. 配置统一域名**

Coolify 会自动处理：
- `auth.openclaw.com` → 认证中心
- `api.openclaw.com` → 业务后端
- `app.openclaw.com` → PC 前端
- `h5.openclaw.com` → 移动端

所有应用自动使用同一个 SSL 证书。

#### 架构

```
Git 仓库
   ↓ (Push 代码)
Coolify 自动检测
   ↓
拉取代码 → 构建镜像 → 部署容器 → 配置域名 → 自动 HTTPS
   ↓
访问: https://your-app.openclaw.com
```

#### 管理大量小应用

**方法 1: 使用项目组**

```
OpenClaw 组织
├── 认证服务
│   ├── auth-center (生产)
│   └── auth-center (开发)
├── 业务服务
│   ├── tenant-manager (生产)
│   └── tenant-manager (开发)
├── PC 应用
│   ├── frontend-pc (生产)
│   ├── frontend-pc (预发布)
│   └── frontend-pc (开发)
└── 移动应用
    ├── app-h5 (生产)
    ├── app-h5 (预发布)
    └── app-h5 (开发)
```

**方法 2: 使用环境变量**

每个项目可以配置多套环境：
- Production (生产)
- Staging (预发布)
- Development (开发)

**方法 3: 使用一键模板**

一键部署常用服务：
- PostgreSQL 数据库
- Redis 缓存
- MongoDB 文档存储
- MinIO 对象存储
- Grafana 监控
- 等等...

---

### 方案 B: Dokploy ⭐⭐⭐⭐ 适合高级用户

#### 特点

- ✅ 开源 PaaS 平台（24,000+ GitHub Stars）
- ✅ 更简洁现代的 UI
- ✅ Docker 原生工作流
- ✅ 支持多种部署方式（Nixpacks, Heroku Buildpacks, Dockerfile）
- ✅ **更好的实时监控**（CPU、内存、存储、网络）
- ✅ **原生多服务器支持**（水平扩展）
- ✅ **高级 RBAC 权限管理**
- ✅ **更多 Git 平台**（GitHub, GitLab, Bitbucket, Gitea）
- ✅ Traefik 原生集成
- ✅ API 文档完善（Swagger/OpenAPI）

#### 安装

```bash
# 一键安装脚本
curl -sSL https://dokploy.com/install.sh | sh

# 访问: http://your-server-ip:3000
```

#### 优势对比 Coolify

| 功能 | Dokploy | Coolify |
|------|---------|---------|
| **多服务器部署** | ✅ 原生支持 | ⚠️ 实验性 |
| **水平扩展** | ✅ Traefik 负载均衡 | ❌ |
| **权限管理** | ✅ 高级 RBAC | ⚠️ 基础 |
| **实时监控** | ✅ 详细仪表板 | ⚠️ 基础 |
| **Git 平台** | Bitbucket, Gitea | 仅 GitHub/GitLab |
| **应用模板** | ⚠️ 较少 | ✅ 280+ |
| **自动 SSL** | ⚠️ 需手动配置 | ✅ 开箱即用 |
| **学习曲线** | ⚠️ 稍陡 | ✅ 更简单 |

#### 适合你的情况？

**选择 Dokploy 如果**:
- ✅ 需要多服务器部署
- ✅ 需要水平扩展
- ✅ 团队成员多，需要细粒度权限控制
- ✅ 使用 Bitbucket 或 Gitea
- ✅ 需要详细的实时监控
- ✅ 有 Docker 运维经验

**不选 Dokploy 如果**:
- ❌ 主要是单服务器部署
- ❌ 想要快速上线，不想研究太多配置
- ❌ 需要大量一键部署的模板
- ❌ 团队小，权限管理要求不高

---

### 方案 C: CapRover ⭐⭐⭐ 轻量级选择

#### 特点

- 轻量级 PaaS 平台
- 支持 Docker
- 自动 HTTPS
- 域名管理
- 资源占用少

#### 部署命令

```bash
docker run -p 80:80 -p 443:443 -p 3000:3000 \
  -v /var/lib/captain:/var/lib/captain \
  caprover/caprover
```

---

### 方案 D: Zeabur ⭐⭐⭐⭐ 国内可用（非自托管）

#### 特点

- 国内访问速度快
- 类似 Vercel 的体验
- 支持多种框架
- 全球 CDN
- 有免费额度

#### 网站与价格

**网站**: https://zeabur.com
**价格**: 免费额度 + 按量付费

**注意**: Zeabur 不是自托管方案，数据托管在 Zeabur 平台。

---

### 方案 E: 其他方案

#### Porter

- Kubernetes 管理
- 企业级功能
- 支持多云部署
- 学习成本高

#### Kamal

- 轻量级部署工具
- 适合小型应用
- 需要更多手动配置

---

### 综合推荐：针对你的场景

#### 场景特征

1. **大量小应用**: PC 端 + 移动端多个应用
2. **统一认证**: Liuma Auth Center 作为统一认证入口
3. **快速迭代**: 频繁发布和更新
4. **团队协作**: 多开发者/多团队

#### 推荐方案排序

| 排名 | 方案 | 适用理由 |
|------|------|---------|
| 🥇 **1st** | **Coolify** | 大量模板、单一域名、自动 SSL、快速部署 |
| 🥈 **2nd** | **Dokploy** | 如果需要多服务器、高级权限、详细监控 |
| 🥉 **3rd** | **Zeabur** | 如果不在意自托管，想要最快速度 |
| 4 | CapRover | 轻量级需求 |
| 5 | 手动 Nginx | 完全定制需求 |

#### 最终建议

**使用 Coolify**，因为：

1. ✅ **统一认证**: 所有应用使用同一个域名 (`*.openclaw.com`)，SSO 更简单
2. ✅ **大量应用**: 280+ 一键模板，快速部署数据库、缓存等辅助服务
3. ✅ **快速发布**: Git Push 自动部署，无需手动配置
4. ✅ **自动 HTTPS**: 所有应用自动配置 SSL，无需手动管理证书
5. ✅ **简单易用**: 学习成本低，团队快速上手
6. ✅ **成熟稳定**: 50,000+ Stars，社区活跃，文档丰富

**如果未来需要多服务器部署**，可以迁移到 Dokploy（两者都支持 Docker Compose 配置）。

---

### 详细配置示例：Coolify 部署 OpenClaw

#### 1. 安装 Coolify

```bash
# 1. 安装依赖
curl -fsSL https://get.docker.com | sh
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 2. 等待安装完成，访问管理面板
# http://your-server-ip:3000

# 3. 初始化设置（设置管理员密码、域名等）
```

#### 2. 部署 tenant-manager

```yaml
# 在 Coolify 中创建新项目
# 类型: Docker Compose

version: '3.8'
services:
  tenant-manager:
    image: openclaw/tenant-manager:latest
    environment:
      - DATABASE_URL=postgresql://...
      - AUTH_CENTER_URL=http://auth-center:3005
    ports:
      - "3000:3000"
```

#### 3. 部署 app-h5

```bash
# 在 Coolify 中:
# 1. 连接 Git 仓库
# 2. 选择分支: main
# 3. 构建命令: pnpm run app:h5:build
# 4. 输出目录: dist/app-h5
# 5. 环境变量: VITE_AUTH_CENTER_URL=https://auth.yourdomain.com
```

#### 4. 自动 HTTPS

```bash
# Coolify 会自动:
# 1. 申请 Let's Encrypt 证书
# 2. 配置 Nginx 反向代理
# 3. 设置域名和 SSL

# 你只需要:
# 1. 在 DNS 设置 A 记录指向服务器 IP
# 2. 在 Coolify 面板添加域名
```

### Coolify vs 其他方案

| 特性 | Coolify | CapRover | Zeabur | Vercel |
|------|---------|----------|---------|---------|
| 自托管 | ✅ | ✅ | ❌ | ❌ |
| 免费开源 | ✅ | ✅ | ❌ | ❌ |
| 自动 HTTPS | ✅ | ✅ | ✅ | ✅ |
| Git 集成 | ✅ | ✅ | ✅ | ✅ |
| Docker 支持 | ✅ | ✅ | ✅ | ✅ |
| 配置复杂度 | ⭐ 低 | ⭐⭐ 中 | ⭐ 低 | ⭐ 低 |
| 国内可用 | ✅ | ✅ | ✅ | ⚠️ 慢 |
| 学习成本 | 低 | 低 | 低 | 最低 |

---

## 方案对比

### 部署方案对比表（更新）

| 对比项 | 独立部署 (Nginx) | Next.js 合并 (Nginx) | Coolify 自托管 | **Dokploy 自托管** | Vercel 托管 |
|--------|----------------|---------------------|---------------|------------------|-------------|
| **项目数量** | 2个 | 1个 | 1-2个 | 1-2个 | 1-2个 |
| **部署命令** | docker-compose up | docker-compose up | 面板一键 | 面板一键 | git push |
| **需要迁移代码** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **代码复用** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **维护成本** | 高 | 低 | 低 | 低 | 最低 |
| **灵活性** | 高 | 中 | 中 | 高 | 低 |
| **需要配置 Nginx** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **自动 HTTPS** | ⚠️ 手动配置 | ⚠️ 手动配置 | ✅ 自动 | ⚠️ 需手动 | ✅ 自动 |
| **Git 集成** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **CI/CD** | ⚠️ 需要自己配 | ⚠️ 需要自己配 | ✅ 内置 | ✅ 内置 | ✅ 内置 |
| **多服务器** | ⚠️ 需手动配置 | ⚠️ 需手动配置 | ⚠️ 实验性 | ✅ 原生支持 | ❌ |
| **一键模板** | ❌ | ❌ | ✅ 280+ | ⚠️ 较少 | ✅ 有 |
| **权限管理** | ❌ | ❌ | ⚠️ 基础 | ✅ 高级 RBAC | ✅ 有 |
| **实时监控** | ⚠️ 需自己配置 | ⚠️ 需自己配置 | ⚠️ 基础 | ✅ 详细 | ✅ 详细 |
| **适合场景** | 完全定制 | 统一管理 | 快速自托管 | **多服务器/高级权限** | 快速上线 |
| **学习成本** | 高 | 中 | 低 | 中 | 最低 |

### Coolify vs Dokploy 详细对比（针对大量小应用场景）

| 对比维度 | Coolify | Dokploy | 推荐（你的场景） |
|---------|---------|---------|----------------|
| **大量小应用** | 280+ 一键模板 | 模板少，需手动 | ✅ **Coolify** |
| **统一认证** | 单一域名 SSO | 多域名支持 | ✅ **Coolify** |
| **快速迭代** | Git Push 自动部署 | Git Push 自动部署 | 🤝 平手 |
| **团队协作** | 基础权限 | 高级 RBAC | ✅ **Dokploy** |
| **单服务器** | ✅ 优化好 | ✅ 支持 | 🤝 平手 |
| **多服务器** | ⚠️ 实验性 | ✅ 原生稳定 | ✅ **Dokploy** |
| **自动 SSL** | ✅ 开箱即用 | ⚠️ 需手动 | ✅ **Coolify** |
| **部署模板** | 丰富（DB/缓存等） | 较少 | ✅ **Coolify** |
| **监控面板** | 基础 | 详细实时 | ✅ **Dokploy** |
| **上手难度** | 简单 | 稍复杂 | ✅ **Coolify** |
| **社区活跃** | 50K+ Stars | 24K+ Stars | ✅ **Coolify** |
| **文档质量** | 丰富 | 较少 | ✅ **Coolify** |
| **Git 平台** | GitHub, GitLab | +Bitbucket, Gitea | ✅ **Dokploy** |

### 架构对比

#### 独立部署 + Nginx
```
开发者 → Git Push → 手动构建 → Docker Compose → Nginx 配置 → 上线
         (需要手动操作每一步)
```

#### Next.js 合并 + Nginx
```
开发者 → 迁移代码 → Git Push → 手动构建 → Docker Compose → Nginx 配置 → 上线
         (一次性迁移，后续手动部署)
```

#### Coolify 自托管
```
开发者 → Git Push → Coolify 自动构建 → 自动部署 + HTTPS → 上线
         (完全自动化，单一服务器，大量模板)
```

#### Dokploy 自托管
```
开发者 → Git Push → Dokploy 自动构建 → 自动部署 + (手动HTTPS) → 上线
         (完全自动化，支持多服务器，高级权限)
```

#### Vercel 托管
```
开发者 → Git Push → Vercel 自动构建 → 自动部署 + CDN + HTTPS → 上线
         (完全自动化，但不可自托管)
```

---

## 生产环境最佳实践

### 推荐方案选择

#### 小型项目 / 快速验证
**选择**: Vercel + Railway
- 前端部署到 Vercel
- 后端部署到 Railway（支持 Docker）
- 成本: 约 $20/月

#### 中型项目 / 需要数据控制
**选择**: **Coolify 自托管** ⭐ 推荐
- 一键部署所有服务
- 自动 HTTPS + CI/CD
- 280+ 应用模板
- 成本: 服务器费用（约 $5-20/月）

#### 大型项目 / 企业级
**选择**: **Dokploy 自托管** ⭐ 推荐
- 多服务器部署
- 高级权限管理（RBAC）
- 水平扩展
- 成本: 多台服务器费用

#### 完全定制 / 特殊需求
**选择**: 独立部署 + Kubernetes
- 完全控制和定制
- 高可用和弹性扩展
- 成本: 根据规模

### 🎯 针对你的场景：大量 PC/移动小应用 + 统一认证

#### 场景分析

```
需求特征:
├── 大量小应用 (PC + 移动)
├── 统一认证入口 (Liuma Auth)
├── 快速发布/迭代
└── 多用户/团队协作
```

#### 推荐架构：Coolify 单域名 + 项目组

```
openclaw.com (统一域名)
├── auth.openclaw.com        (认证中心 - 单点登录)
├── api.openclaw.com         (业务后端)
├── pc.openclaw.com          (PC 前端)
├── h5.openclaw.com          (移动端 H5)
│
├── app1.openclaw.com        (小应用 1)
├── app2.openclaw.com        (小应用 2)
├── app3.openclaw.com        (小应用 3)
├── ...
│
└── services.openclaw.com
    ├── postgres.services.openclaw.com    (数据库)
    ├── redis.services.openclaw.com       (缓存)
    └── monitoring.services.openclaw.com  (监控)
```

#### 部署步骤（Coolify）

**1. 安装 Coolify**

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**2. 配置统一域名**

在 DNS 设置:
```
*.openclaw.com    A    你的服务器IP
```

Coolify 会自动为所有子域名申请 SSL 证书。

**3. 部署核心服务**

使用 Coolify 的一键模板:

| 服务 | 域名 | 模板 |
|------|------|------|
| PostgreSQL | `postgres.openclaw.com` | 一键模板 |
| Redis | `redis.openclaw.com` | 一键模板 |
| Auth Center | `auth.openclaw.com` | Git 部署 |
| tenant-manager | `api.openclaw.com` | Git 部署 |
| PC Frontend | `pc.openclaw.com` | Git 部署 |
| H5 App | `h5.openclaw.com` | Git 部署 |

**4. 配置统一认证**

所有应用使用同一个认证中心:

```typescript
// 所有应用的前端代码
const AUTH_CENTER_URL = 'https://auth.openclaw.com';
const APP_ID = 'openclaw-pc'; // 或 'openclaw-h5', 'app1', 'app2'...

// 初始化 Liuma Auth
const auth = new LiumaAuth({
  authCenterUrl: AUTH_CENTER_URL,
  appId: APP_ID,
  redirectUri: `${window.location.origin}/auth/callback`,
});
```

**5. 管理大量小应用**

使用 Coolify 的项目组功能:

```
OpenClaw Workspace
├── 📁 Core Services (核心服务)
│   ├── auth-center (认证中心)
│   ├── tenant-manager (业务后端)
│   └── databases (数据库组)
│
├── 📁 Frontend Apps (前端应用)
│   ├── frontend-pc (PC 前端)
│   ├── app-h5 (移动端)
│   ├── app-1 (小应用 1)
│   ├── app-2 (小应用 2)
│   └── ...
│
└── 📁 Development (开发环境)
    ├── auth-center-dev
    ├── tenant-manager-dev
    └── ...
```

**6. 环境管理**

每个应用可以配置多套环境:

```
app-h5:
  - Production (生产) → https://h5.openclaw.com
  - Staging (预发布) → https://h5-staging.openclaw.com
  - Development (开发) → https://h5-dev.openclaw.com
```

**7. 团队协作**

- 创建团队成员账号
- 分配应用访问权限
- 查看部署日志和状态

#### 优势总结

| 特性 | Coolify 实现 |
|------|-------------|
| **统一认证** | 所有应用使用 `auth.openclaw.com` |
| **统一域名** | 所有应用使用 `*.openclaw.com` |
| **统一 SSL** | 自动申请和续期通配符证书 |
| **快速部署** | Git Push 自动部署 |
| **一键模板** | 数据库、缓存、监控等快速部署 |
| **团队管理** | 多用户协作，权限分离 |

#### 如果选择 Dokploy？

**适合迁移到 Dokploy 的时机**:
- ✅ 需要多服务器部署（应用数量 > 50）
- ✅ 需要水平扩展（单个应用高并发）
- ✅ 团队成员 > 10 人，需要细粒度权限
- ✅ 需要更详细的监控和告警

**迁移步骤**:
1. 导出 Coolify 的 Docker Compose 配置
2. 在 Dokploy 中创建项目
3. 使用相同的配置部署
4. 切换 DNS 指向 Dokploy 服务器

### 安全配置

#### 1. 环境变量管理

```bash
# 生产环境 .env 文件
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your-super-secret-key-min-32-chars
AUTH_CENTER_URL=https://auth.yourdomain.com
```

#### 2. CORS 配置

```typescript
// tenant-manager/src/index.ts
app.use(cors({
  origin: [
    'https://app.yourdomain.com',
    'https://www.yourdomain.com',
  ],
  credentials: true,
}));
```

#### 3. 速率限制

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制每个 IP 100 个请求
});

app.use('/api/', limiter);
```

#### 4. 安全头

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
```

### 监控和日志

#### 1. 健康检查

```typescript
// tenant-manager/src/routes/health.ts
app.get('/api/health', async (req, res) => {
  try {
    // 检查数据库连接
    await db.query('SELECT 1');

    // 检查 Redis
    await redis.ping();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message,
    });
  }
});
```

#### 2. 日志管理

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// 使用
logger.info({ user: '123' }, 'User logged in');
logger.error({ error: err.message }, 'Database connection failed');
```

### 备份策略

#### 1. 数据库备份

```bash
# 每日自动备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"

docker exec postgres pg_dump -U user dbname > $BACKUP_DIR/backup_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

#### 2. Docker 卷备份

```bash
# 备份所有数据卷
docker run --rm \
  -v openclaw_postgres_data:/data \
  -v /backups:/backup \
  alpine tar czf /backup/postgres_$(date +%Y%m%d).tar.gz /data
```

### 性能优化

#### 1. CDN 配置

```nginx
# Nginx 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

#### 2. Gzip 压缩

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript
           application/x-javascript application/xml+rss
           application/json application/javascript;
```

#### 3. 数据库连接池

```typescript
// tenant-manager/src/db/index.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## 故障排查

### 常见问题

#### 1. CORS 错误

**症状**: 浏览器控制台出现跨域错误

**解决**:
```typescript
// 确保后端 CORS 配置正确
app.use(cors({
  origin: your-frontend-url,
  credentials: true,
}));
```

#### 2. OAuth 回调失败

**症状**: OAuth 登录后回调到 404 页面

**解决**:
```nginx
# 确保路由配置正确
location /auth/callback {
    try_files $uri $uri/ /index.html;
}
```

#### 3. 环境变量未生效

**症状**: 前端无法连接后端 API

**解决**:
```bash
# 检查环境变量
docker-compose config

# 重新构建
docker-compose up -d --build
```

#### 4. 数据库连接失败

**症状**: 服务启动失败，日志显示数据库连接错误

**解决**:
```bash
# 检查数据库是否运行
docker ps | grep postgres

# 检查网络连接
docker network inspect openclaw-network

# 测试连接
docker exec -it tenant-manager ping postgres
```

---

## 总结

### 快速决策指南

**如果你的情况是...**

- "我想快速上线，不想折腾配置" → **Coolify 自托管**
- "我有服务器，想要完全控制" → **独立部署 + Docker Compose**
- "我想要统一管理 PC 和移动端" → **Next.js 合并 + Coolify**
- "我不关心自托管，只想最快速度" → **Vercel + Railway**
- "我是企业用户，需要高可用" → **Kubernetes + Helm**

### 最终推荐

对于大多数项目，推荐使用 **Coolify 自托管**:

1. ✅ 开源免费
2. ✅ 类似 Vercel 的体验
3. ✅ 完全控制和数据所有权
4. ✅ 自动 HTTPS + CI/CD
5. ✅ 配置简单，学习成本低

---

## 相关资源

### 官方文档

- [Coolify 官网](https://coolify.io)
- [Coolify GitHub](https://github.com/coollabsio/coolify)
- [Dokploy 官网](https://dokploy.com)
- [Dokploy GitHub](https://github.com/Dokploy/dokploy)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Nginx 反向代理配置](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

### 对比文章和教程

- [Self-Hosted Deployment Tools Compared: Coolify, Dokploy, Kamal...](https://dev.to/ameistad/self-hosted-deployment-tools-compared-coolify-dokploy-kamal-dokku-and-haloy-2npd)
- [10 Vercel Alternatives for Deploying Apps in 2026](https://www.digitalocean.com/resources/articles/vercel-alternatives)
- [Dokploy和Coolify全方位对比 - 美国主机侦探](https://www.idcspy.com/142411.html)
- [Dokploy：化繁为简的开源 PaaS 平台](https://nexmoe.com/posts/open-source-pass-dokploy.html)
- [一篇文章带你了解一款强大的开源自托管平台---Dokploy](https://juejin.cn/post/7488519033958498338)
- [从0到1部署Coolify：5分钟搭建你的自托管PaaS平台](https://blog.csdn.net/gitblog_00977/article/details/15235150646)

### 视频教程

- [Coolify Introduction Video](https://www.youtube.com/watch?v=your-video-id)
- [Dokploy Tutorial](https://www.youtube.com/watch?v=your-video-id)

### 社区资源

- [Coolify Discord](https://discord.gg/coolify)
- [Dokploy Discord](https://discord.gg/dokploy)
- [Coolify Documentation](https://coolify.io/docs)
- [Dokploy Documentation](https://dokploy.com/docs)

---

**文档版本**: 1.1
**更新日期**: 2025-02-27
**维护者**: OpenClaw Team

---

## 附录：Dokploy vs Coolify 完整功能对比

### 部署方式对比

| 部署方式 | Coolify | Dokploy |
|---------|---------|---------|
| **Docker Compose** | ✅ 原生支持 | ✅ 原生支持 |
| **Dockerfile** | ✅ 支持 | ✅ 支持 |
| **Nixpacks** | ✅ 默认使用 | ✅ 支持 |
| **Heroku Buildpacks** | ❌ | ✅ 支持 |
| **Git 部署** | ✅ | ✅ |
| **Tarball 部署** | ❌ | ✅ |

### 数据库支持对比

| 数据库 | Coolify | Dokploy |
|--------|---------|---------|
| **PostgreSQL** | ✅ 一键模板 | ✅ 支持 |
| **MySQL** | ✅ 一键模板 | ✅ 支持 |
| **MongoDB** | ✅ 一键模板 | ✅ 支持 |
| **Redis** | ✅ 一键模板 | ✅ 支持 |
| **Dragonfly** | ✅ 支持 | ❌ |
| **ClickHouse** | ✅ 支持 | ❌ |
| **MariaDB** | ✅ 一键模板 | ✅ 支持 |

### 高级功能对比

| 功能 | Coolify | Dokploy |
|------|---------|---------|
| **Cloudflare Tunnel** | ✅ | ❌ |
| **Preview Deployments** | ✅ | ❌ |
| **Custom Templates** | ❌ | ✅ |
| **Multi-Cluster** | ❌ | ✅ |
| **Service Discovery** | ⚠️ 基础 | ✅ 高级 |
| **Load Balancing** | ⚠️ 实验性 | ✅ Traefik |
| **Terminal Access** | ✅ | ✅ |
| **File Manager** | ✅ | ✅ |
| **Log Aggregation** | ✅ | ✅ |
| **Metrics/Analytics** | ✅ Grafana | ✅ 内置详细 |

### 团队协作对比

| 功能 | Coolify | Dokploy |
|------|---------|---------|
| **团队成员管理** | ✅ | ✅ |
| **基于角色的访问控制 (RBAC)** | ⚠️ 基础 | ✅ 高级 |
| **团队权限** | 读/写 | 所有者/管理员/开发者/查看者 |
| **项目共享** | ✅ | ✅ |
| **审计日志** | ⚠️ 基础 | ✅ 详细 |

### 安全对比

| 功能 | Coolify | Dokploy |
|------|---------|---------|
| **Let's Encrypt SSL** | ✅ 自动 | ✅ 手动配置 |
| **自定义 SSL** | ✅ | ✅ |
| **双因素认证 (2FA)** | ✅ | ✅ |
| **OAuth 集成** | ✅ GitHub | ✅ 多平台 |
| **安全审计** | ⚠️ 曾发现 7 个 CVE | ✅ 定期更新 |

### 性能对比

| 指标 | Coolify | Dokploy |
|------|---------|---------|
| **CPU 占用（空闲）** | ~9% | ~9% |
| **内存占用（空闲，2GB 服务器）** | ~41% | ~44% |
| **部署速度** | 快 | 快 |
| **容器启动时间** | 正常 | 正常 |
| **扩展能力** | 垂直扩展 | 水平 + 垂直扩展 |

### Git 集成对比

| 平台 | Coolify | Dokploy |
|------|---------|---------|
| **GitHub** | ✅ | ✅ |
| **GitLab** | ✅ | ✅ |
| **Bitbucket** | ❌ | ✅ |
| **Gitea** | ❌ | ✅ |
| **Git 钩子** | ✅ | ✅ |
| **自动部署** | ✅ Push 触发 | ✅ Push 触发 |

### API 和自动化对比

| 功能 | Coolify | Dokploy |
|------|---------|---------|
| **REST API** | ✅ | ✅ |
| **API 文档** | ✅ 基础 | ✅ Swagger/OpenAPI |
| **Webhooks** | ✅ | ✅ |
| **CLI 工具** | ❌ | ❌ |
| **Terraform Provider** | ❌ | ❌ |

### 备份和恢复对比

| 功能 | Coolify | Dokploy |
|------|---------|---------|
| **自动备份** | ✅ 内置 | ✅ S3 兼容 |
| **手动备份** | ✅ | ✅ |
| **备份调度** | ✅ | ✅ |
| **恢复功能** | ✅ | ✅ |
| **备份到 S3** | ✅ | ✅ |
| **备份到本地** | ✅ | ✅ |

### 总结建议

**选择 Coolify** 如果你需要:
- ✅ 最快的上手速度
- ✅ 最多的一键部署模板
- ✅ 自动 HTTPS 配置
- ✅ 单服务器部署
- ✅ 成熟稳定的平台

**选择 Dokploy** 如果你需要:
- ✅ 多服务器部署
- ✅ 水平扩展和负载均衡
- ✅ 高级团队权限管理
- ✅ 更详细的监控
- ✅ 更多 Git 平台支持
- ✅ 更现代的技术栈（TypeScript）
