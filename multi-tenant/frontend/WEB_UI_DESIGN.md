# OpenClaw 多租户系统 - Web UI 设计文档

> 日期: 2026-02-06
> 目的: 用户验收测试 (UAT) 界面设计
> 技术栈: Next.js 14 + React 18 + shadcn/ui + TypeScript

---

## 目录

1. [技术架构](#技术架构)
2. [页面结构](#页面结构)
3. [组件设计](#组件设计)
4. [数据流](#数据流)
5. [状态管理](#状态管理)
6. [API 集成](#api-集成)
7. [样式系统](#样式系统)

---

## 技术架构

### 技术栈

```json
{
  "框架": "Next.js 14 (App Router)",
  "UI 库": "shadcn/ui + Radix UI",
  "样式": "Tailwind CSS",
  "状态管理": "Zustand + React Query",
  "表单": "React Hook Form + Zod",
  "HTTP": "axios / fetch",
  "图标": "lucide-react",
  "类型": "TypeScript 5"
}
```

### 项目结构

```
multi-tenant/frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 认证路由组
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/              # 仪表板路由组
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── tenants/
│   │   │   │   ├── page.tsx          # 租户列表
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [tenantId]/
│   │   │   │       ├── page.tsx      # 租户详情
│   │   │   │       └── logs/
│   │   │   │           └── page.tsx
│   │   │   ├── hosts/
│   │   │   │   └── page.tsx          # 主机监控
│   │   │   └── layout.tsx
│   │   ├── api/                      # API Routes (可选代理)
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx                  # 首页
│   │
│   ├── components/                   # UI 组件
│   │   ├── ui/                       # shadcn 组件
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   └── ...
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── DevLoginButton.tsx    # 开发环境快捷登录
│   │   ├── tenant/
│   │   │   ├── TenantCard.tsx
│   │   │   ├── TenantStats.tsx
│   │   │   ├── CreateTenantDialog.tsx
│   │   │   ├── TenantActions.tsx
│   │   │   └── TenantLogsViewer.tsx
│   │   ├── host/
│   │   │   ├── HostCard.tsx
│   │   │   ├── HostMetrics.tsx
│   │   │   └── HostStatusBadge.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── shared/
│   │       ├── StatusBadge.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorAlert.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── lib/                          # 工具库
│   │   ├── api/
│   │   │   ├── client.ts             # API 客户端
│   │   │   ├── tenants.ts            # 租户 API
│   │   │   ├── hosts.ts              # 主机 API
│   │   │   └── auth.ts               # 认证 API
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useTenants.ts
│   │   │   └── useHosts.ts
│   │   ├── stores/
│   │   │   └── authStore.ts          # 认证状态
│   │   ├── validators.ts             # Zod schemas
│   │   └── utils.ts
│   │
│   ├── types/
│   │   ├── tenant.ts
│   │   ├── host.ts
│   │   └── auth.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   └── images/
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── components.json                   # shadcn 配置
```

---

## 页面结构

### 1. 首页 (Landing Page)

**路径:** `/`

```tsx
// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Server, Users, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl mb-6">
          OpenClaw <span className="text-blue-600">Cloud</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          私有的 AI 助手云平台。一键创建您的专属 OpenClaw 实例，
          完全隔离，安全可控。
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/login">立即开始</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/docs">查看文档</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Server className="h-8 w-8" />}
            title="一键部署"
            description="自动选择最佳主机，快速创建您的 OpenClaw 实例"
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="完全隔离"
            description="每个租户独立容器运行，资源隔离，数据安全"
          />
          <FeatureCard
            icon={<Users className="h-8 w-8" />}
            title="多租户支持"
            description="支持多个实例同时运行，灵活管理"
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">选择适合您的计划</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard
            name="免费版"
            price="¥0"
            features={['0.5 CPU', '512MB 内存', '1 个沙盒', '1 个会话']}
          />
          <PricingCard
            name="基础版"
            price="¥29/月"
            features={['1 CPU', '1GB 内存', '3 个沙盒', '5 个会话']}
            highlighted
          />
          <PricingCard
            name="专业版"
            price="¥99/月"
            features={['2 CPU', '2GB 内存', '10 个沙盒', '20 个会话']}
          />
        </div>
      </section>
    </div>
  );
}
```

### 2. 登录页面

**路径:** `/login`

```tsx
// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Chrome, Github } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { DevLoginButton } from '@/components/auth/DevLoginButton';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithOAuth, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      await loginWithOAuth(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth 登录失败');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录 OpenClaw</CardTitle>
          <CardDescription>选择登录方式继续</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="oauth" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oauth">OAuth</TabsTrigger>
              <TabsTrigger value="password">密码</TabsTrigger>
            </TabsList>

            {/* OAuth 登录 */}
            <TabsContent value="oauth" className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthLogin('google')}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Chrome className="mr-2 h-4 w-4" />
                )}
                使用 Google 登录
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthLogin('github')}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Github className="mr-2 h-4 w-4" />
                )}
                使用 GitHub 登录
              </Button>

              {/* 开发环境快捷登录 */}
              {process.env.NODE_ENV === 'development' && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    开发环境
                  </p>
                  <DevLoginButton />
                </div>
              )}
            </TabsContent>

            {/* 密码登录 */}
            <TabsContent value="password">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3. 用户仪表板

**路径:** `/dashboard`

```tsx
// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useTenants } from '@/lib/hooks/useTenants';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, RefreshCw, Settings, LogOut } from 'lucide-react';
import { TenantCard } from '@/components/tenant/TenantCard';
import { CreateTenantDialog } from '@/components/tenant/CreateTenantDialog';
import { TenantStats } from '@/components/tenant/TenantStats';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { tenants, isLoading, error, refresh, createTenant } = useTenants();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateTenant = async (data: { email: string; plan: string }) => {
    await createTenant(data);
    setShowCreateDialog(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">OpenClaw Cloud</h1>
            <p className="text-sm text-muted-foreground">
              欢迎, {user?.email || '用户'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => router.push('/hosts')}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <TenantStats tenants={tenants} />

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">我的 OpenClaw 实例</h2>
            <p className="text-muted-foreground">
              {tenants?.length || 0} 个实例运行中
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建新实例
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && tenants?.length === 0 && (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">还没有 OpenClaw 实例</h3>
              <p className="text-muted-foreground mb-4">
                创建您的第一个实例，开始使用 AI 助手
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                创建第一个实例
              </Button>
            </div>
          </Card>
        )}

        {/* Tenant List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants?.map((tenant) => (
            <TenantCard key={tenant.tenantId} tenant={tenant} onRefresh={refresh} />
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>

      {/* Create Tenant Dialog */}
      <CreateTenantDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateTenant}
      />
    </div>
  );
}
```

### 4. 主机监控页面

**路径:** `/hosts`

```tsx
// src/app/(dashboard)/hosts/page.tsx
'use client';

import { useHosts } from '@/lib/hooks/useHosts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HostCard } from '@/components/host/HostCard';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function HostsPage() {
  const router = useRouter();
  const { hosts, isLoading, refresh } = useHosts();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">主机监控</h1>
            <p className="text-sm text-muted-foreground">
              查看 worker 主机状态
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              返回
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Host Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hosts?.map((host) => (
            <HostCard key={host.id} host={host} />
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && hosts?.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">没有可用的主机</p>
          </Card>
        )}
      </main>
    </div>
  );
}
```

---

## 组件设计

### 1. 租户卡片 (TenantCard)

```tsx
// src/components/tenant/TenantCard.tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, Trash2, FileText, Settings } from 'lucide-react';
import { Tenant } from '@/types/tenant';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { TenantLogsDialog } from './TenantLogsDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface TenantCardProps {
  tenant: Tenant;
  onRefresh: () => void;
}

export function TenantCard({ tenant, onRefresh }: TenantCardProps) {
  const [isRestarting, setIsRestarting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const statusConfig = {
    running: { label: '运行中', variant: 'default' as const, color: 'bg-green-500' },
    stopped: { label: '已停止', variant: 'secondary' as const, color: 'bg-gray-500' },
    creating: { label: '创建中', variant: 'outline' as const, color: 'bg-blue-500' },
    error: { label: '错误', variant: 'destructive' as const, color: 'bg-red-500' },
  };

  const status = statusConfig[tenant.status as keyof typeof statusConfig] || statusConfig.stopped;

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      const response = await fetch(`/api/tenants/me/restart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        onRefresh();
      }
    } finally {
      setIsRestarting(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/tenants/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        onRefresh();
      }
    } finally {
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {tenant.tenantId}
                <Badge variant={status.variant}>
                  <span className={`w-2 h-2 rounded-full ${status.color} mr-1`} />
                  {status.label}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                计划: {tenant.plan}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowLogs(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  查看日志
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRestart} disabled={isRestarting}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`} />
                  重启
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 访问地址 */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{tenant.url}</p>
              {tenant.port && (
                <p className="text-xs text-muted-foreground">
                  端口: {tenant.port}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(tenant.url, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          {/* 创建时间 */}
          <div className="text-xs text-muted-foreground">
            创建于 {formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true, locale: zhCN })}
          </div>

          {/* 主机信息 */}
          {tenant.host && (
            <div className="text-xs text-muted-foreground">
              运行于: {tenant.host}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <TenantLogsDialog
        open={showLogs}
        onOpenChange={setShowLogs}
        tenantId={tenant.tenantId}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="删除实例"
        description="确定要删除这个 OpenClaw 实例吗？此操作不可撤销，所有数据将被删除。"
        confirmText="删除"
      />
    </>
  );
}
```

### 2. 创建租户对话框

```tsx
// src/components/tenant/CreateTenantDialog.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: string;
  cpu: string;
  memory: string;
  sandboxes: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: '免费版',
    price: '¥0/月',
    cpu: '0.5 核心',
    memory: '512MB',
    sandboxes: '1 个',
  },
  {
    id: 'basic',
    name: '基础版',
    price: '¥29/月',
    cpu: '1 核心',
    memory: '1GB',
    sandboxes: '3 个',
  },
  {
    id: 'pro',
    name: '专业版',
    price: '¥99/月',
    cpu: '2 核心',
    memory: '2GB',
    sandboxes: '10 个',
  },
  {
    id: 'enterprise',
    name: '企业版',
    price: '联系销售',
    cpu: '4 核心',
    memory: '4GB',
    sandboxes: '无限',
  },
];

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { email: string; plan: string }) => void | Promise<void>;
}

export function CreateTenantDialog({ open, onOpenChange, onSubmit }: CreateTenantDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [isCreating, setIsCreating] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<{ url: string; tenantId: string } | null>(null);

  const handleSubmit = async () => {
    setIsCreating(true);
    try {
      await onSubmit({
        email: 'user@example.com', // 从认证信息获取
        plan: selectedPlan,
      });

      // 模拟创建成功
      setCreatedTenant({
        url: `https://tenant-user-${Date.now()}.openclaw.app`,
        tenantId: `tenant-${Date.now()}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setCreatedTenant(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {!createdTenant ? (
          <>
            <DialogHeader>
              <DialogTitle>创建新的 OpenClaw 实例</DialogTitle>
              <DialogDescription>
                选择适合您需求的计划
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
                <div className="grid md:grid-cols-2 gap-4">
                  {plans.map((plan) => (
                    <div key={plan.id}>
                      <RadioGroupItem
                        value={plan.id}
                        id={plan.id}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={plan.id}
                        className="flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-200 peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50 dark:peer-data-[state=checked]:bg-blue-950"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{plan.name}</span>
                          <span className="text-sm text-muted-foreground">{plan.price}</span>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>CPU: {plan.cpu}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>内存: {plan.memory}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>沙盒: {plan.sandboxes}</span>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建实例'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                实例创建成功
              </DialogTitle>
            </DialogHeader>

            <div className="py-6 text-center space-y-4">
              <p className="text-muted-foreground">
                您的 OpenClaw 实例已准备就绪
              </p>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm font-medium mb-1">访问地址</p>
                <a
                  href={createdTenant.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {createdTenant.url}
                </a>
              </div>

              <Button
                onClick={() => window.open(createdTenant.url, '_blank')}
                className="w-full"
              >
                打开控制台
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleReset}>
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 3. 主机卡片

```tsx
// src/components/host/HostCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Host } from '@/types/host';
import { Activity, Cpu, HardDrive, Server } from 'lucide-react';

interface HostCardProps {
  host: Host;
}

export function HostCard({ host }: HostCardProps) {
  const statusConfig = {
    active: { label: '在线', variant: 'default' as const, color: 'bg-green-500' },
    down: { label: '离线', variant: 'destructive' as const, color: 'bg-red-500' },
    draining: { label: '维护中', variant: 'secondary' as const, color: 'bg-yellow-500' },
  };

  const status = statusConfig[host.status] || statusConfig.down;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {host.name}
          </div>
          <Badge variant={status.variant}>
            <span className={`w-2 h-2 rounded-full ${status.color} mr-1`} />
            {status.label}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 租户数量 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            租户数量
          </div>
          <span className="font-medium">{host.tenantCount}</span>
        </div>

        {/* CPU */}
        {host.stats && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="h-4 w-4" />
                CPU
              </div>
              <span className="font-medium">
                {host.stats.cpuTotal} 核心
              </span>
            </div>
          </div>
        )}

        {/* 内存 */}
        {host.stats && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HardDrive className="h-4 w-4" />
                内存使用
              </div>
              <span className="font-medium">
                {host.stats.memoryUsed} / {host.stats.memoryTotal} GB
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${(host.stats.memoryUsed / host.stats.memoryTotal) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* 类型 */}
        <div className="text-xs text-muted-foreground">
          类型: {host.type === 1 ? 'Docker Standalone' : 'Docker Swarm'}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 数据流

### API 客户端

```tsx
// src/lib/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
});

// 请求拦截器
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期，清除并跳转登录
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
```

### 租户 API

```tsx
// src/lib/api/tenants.ts
import client from './client';
import type { Tenant, CreateTenantInput } from '@/types/tenant';

export const tenantsApi = {
  // 获取当前用户的租户
  getMe: async (): Promise<Tenant> => {
    const response = await client.get('/tenants/me');
    return response.data;
  },

  // 通过 tenant_id 获取租户
  getById: async (tenantId: string): Promise<Tenant> => {
    const response = await client.get(`/tenants/${tenantId}`);
    return response.data;
  },

  // 创建租户
  create: async (input: CreateTenantInput): Promise<Tenant> => {
    const response = await client.post('/tenants', input);
    return response.data;
  },

  // 删除租户
  deleteMe: async (): Promise<void> => {
    await client.delete('/tenants/me');
  },

  // 重启租户
  restartMe: async (): Promise<void> => {
    await client.post('/tenants/me/restart');
  },

  // 获取日志
  getLogs: async (tail = 100): Promise<string> => {
    const response = await client.get(`/tenants/me/logs?tail=${tail}`, {
      responseType: 'text',
    });
    return response.data;
  },

  // 获取统计
  getStats: async () => {
    const response = await client.get('/tenants/stats');
    return response.data;
  },
};
```

### 主机 API

```tsx
// src/lib/api/hosts.ts
import client from './client';
import type { Host } from '@/types/host';

export const hostsApi = {
  // 获取所有主机
  getAll: async (): Promise<Host[]> => {
    const response = await client.get('/hosts');
    return response.data;
  },

  // 获取主机详情
  getById: async (endpointId: number): Promise<Host & { stats: any; tenants: any[] }> => {
    const response = await client.get(`/hosts/${endpointId}`);
    return response.data;
  },
};
```

### 认证 API

```tsx
// src/lib/api/auth.ts
import client from './client';
import type { LoginInput, LoginResponse } from '@/types/auth';

export const authApi = {
  // 登录
  login: async (input: LoginInput): Promise<LoginResponse> => {
    const response = await client.post('/auth/login', input);
    return response.data;
  },

  // 刷新 token
  refresh: async (refreshToken: string): Promise<{ token: string }> => {
    const response = await client.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  // 生成签名（开发环境）
  generateSignature: async (userId: string): Promise<{ signature: string }> => {
    const response = await client.get(`/auth/signature/${userId}`);
    return response.data;
  },

  // SSO 信息
  getSsoInfo: async () => {
    const response = await client.get('/auth/sso-info');
    return response.data;
  },
};
```

---

## 状态管理

### 认证 Store (Zustand)

```tsx
// src/lib/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  userId: string;
  email: string;
  plan?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      clearAuth: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### 认证 Hook

```tsx
// src/lib/hooks/useAuth.ts
import { useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setAuth(
      { userId: response.userId || email.split('@')[0], email },
      response.token
    );
  }, [setAuth]);

  const loginWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    // OAuth 跳转逻辑
    window.location.href = `/api/auth/${provider}`;
  }, []);

  const loginWithDevMode = useCallback(async (userId: string, email: string) => {
    const response = await authApi.generateSignature(userId);
    // 使用签名直接登录
    // ...
  }, []);

  const logout = useCallback(async () => {
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  return {
    user,
    token,
    isAuthenticated,
    login,
    loginWithOAuth,
    loginWithDevMode,
    logout,
  };
}
```

### 租户 Hook (React Query)

```tsx
// src/lib/hooks/useTenants.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuth } from './useAuth';

export function useTenants() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ['tenants', 'me'],
    queryFn: tenantsApi.getMe,
    enabled: isAuthenticated,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: tenantsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: tenantsApi.deleteMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const restartMutation = useMutation({
    mutationFn: tenantsApi.restartMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  return {
    tenants: tenants ? [tenants] : [],
    isLoading,
    error: error?.message,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    createTenant: createMutation.mutateAsync,
    deleteTenant: deleteMutation.mutateAsync,
    restartTenant: restartMutation.mutateAsync,
  };
}
```

---

## 类型定义

```tsx
// src/types/tenant.ts
export interface Tenant {
  tenantId: string;
  userId: string;
  email: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  url: string;
  status: 'running' | 'stopped' | 'creating' | 'error';
  host?: string;
  port?: number;
  createdAt: string;
}

export interface CreateTenantInput {
  userId?: string;
  email: string;
  plan?: Tenant['plan'];
}
```

```tsx
// src/types/host.ts
export interface Host {
  id: number;
  name: string;
  status: 'active' | 'down' | 'draining';
  type: number;
  publicUrl: string;
  tenantCount: number;
  stats?: {
    cpuTotal: number;
    memoryTotal: number;
    memoryUsed: number;
    serverVersion: string;
  };
}
```

```tsx
// src/types/auth.ts
export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  userId: string;
  email: string;
  plan?: string;
}
```

---

## 样式系统

### Tailwind 配置

```js
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### 全局样式

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## 环境变量

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001

# OAuth (可选)
NEXT_PUBLIC_OAUTH_ENABLED=false
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
```

---

## 用户验收测试场景

### 场景 1: 新用户首次使用

1. 访问首页 → 点击"立即开始"
2. 选择登录方式（开发环境用快捷登录）
3. 进入仪表板 → 点击"创建第一个实例"
4. 选择计划 → 确认创建
5. 看到"创建成功" → 获得访问地址
6. 点击"打开控制台" → 新标签页打开实例

### 场景 2: 管理现有实例

1. 登录后查看仪表板
2. 查看实例列表
3. 点击实例卡片上的"查看日志"
4. 点击"重启"按钮
5. 刷新页面查看状态变化

### 场景 3: 监控主机状态

1. 点击顶部设置图标
2. 进入主机监控页面
3. 查看各主机状态、资源使用
4. 查看每个主机的租户数量

### 场景 4: 删除实例

1. 在实例卡片上点击设置图标
2. 选择"删除"
3. 确认删除操作
4. 验证实例已从列表中移除
