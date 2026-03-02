# Liuma 认证与多主机方案总结

> **版本**: v2.0（修正版）
> **日期**: 2025-02-26
> **作者**: Liuma Team
> **状态**: 实施阶段

> **注意**：详细的开发计划请参考 [auth-implementation-plan.md](./auth-implementation-plan.md)

---

## 问题回顾

### 原始需求

1. **集成认证功能**：将 `../liuma` 的 Better Auth 认证系统集成到移动端和 PC 端
2. **多主机配置**：让移动端也像 PC 端一样支持多 OpenClaw 主机配置接入

### 现状分析

| 模块 | 当前状态 | 缺失功能 |
|------|---------|---------|
| **移动端 (app-h5)** | React + Vite，WebSocket 连接 Gateway | ❌ 无认证、❌ 单主机 |
| **PC 端 (multi-tenant)** | Node.js + Portainer，多租户管理 | ✅ JWT 认证、✅ 多主机 |
| **Liuma** | Better Auth + PostgreSQL，完整认证系统 | N/A 独立认证系统 |

---

## 方案对比

### 方案一：独立认证架构

**核心思路**：移动端和 PC 端各自独立集成 Better Auth

```
移动端 H5          PC 端 Web          Liuma
┌─────────┐       ┌─────────┐       ┌─────────┐
│ better  │       │ better  │       │ better  │
│ auth    │       │ auth    │       │ auth    │
│独立DB   │       │独立DB   │       │独立DB   │
└─────────┘       └─────────┘       └─────────┘
```

**评分**：⭐⭐⭐ (3/5)

| 优点 | 缺点 |
|------|------|
| • 解耦独立 | • 用户数据分离 |
| • 灵活部署 | • 无法实现 SSO |
| • 简化开发 | • 重复开发 |
| • 离线支持 | • 配置不同步 |

---

### 方案二：统一认证中心（推荐）

**核心思路**：Liuma 作为统一认证中心，所有客户端通过 API 访问

```
┌─────────────────────────────────────────────────────────────┐
│                 统一认证中心         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Better Auth + PostgreSQL + Host Config API            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ REST API
          ┌───────────────┴───────────────┐
          ▼                               ▼
  ┌─────────────┐                 ┌─────────────┐
  │  移动端 H5   │                 │  PC 端 Web  │
  │  认证客户端  │                 │  认证客户端  │
  └─────────────┘                 └─────────────┘
```

**评分**：⭐⭐⭐⭐⭐ (5/5)

| 优点 | 缺点 |
|------|------|
| • 真正的 SSO | • 需要认证中心在线 |
| • 统一用户数据 | • 额外的网络依赖 |
| • 主机配置同步 | • 需要处理 CORS |
| • 完整的 RBAC | • 需要迁移改造 |
| • 社交登录 | |
| • 易于扩展 | |

---

### 方案三：共享认证库（NPM SDK）

**核心思路**：将认证逻辑封装为 NPM 包，各客户端集成使用

```
┌─────────────────────────────────────────────────────────────┐
│           @liuma/auth-sdk (NPM 包)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  核心认证逻辑 + 平台适配层                             ││
│  │  • Better Auth 配置                                    ││
│  │  • 认证 Hooks                                          ││
│  │  • 主机配置管理                                        ││
│  │  • Web/Mobile 适配器                                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
  ┌─────────────┐                     ┌─────────────┐
  │  移动端 H5   │                     │  PC 端 Web  │
  │  import Auth│                     │  import Auth│
  │  from SDK   │                     │  from SDK   │
  └─────────────┘                     └─────────────┘
```

**评分**：⭐⭐⭐⭐ (4/5)

| 优点 | 缺点 |
|------|------|
| • 代码复用 | • 需要维护 SDK |
| • 独立部署 | • 版本管理复杂 |
| • 灵活存储 | • 仍有网络依赖 |
| • 平台适配 | • 需要后端服务支撑 |

---

## 最佳实践：方案二 + 方案三 结合

### 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              方案二 + 方案三 组合架构（最终推荐）                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │           统一认证中心                    │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │  后端服务              │ │   │
│  │  │  • Better Auth + PostgreSQL                                   │ │   │
│  │  │  • Host Config API (CRUD + 同步)                             │ │   │
│  │  │  • OAuth 2.0 (GitHub/Google/Microsoft)                        │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │  API 端点                                                     │ │   │
│  │  │  POST   /api/auth/signin       - 登录                         │ │   │
│  │  │  POST   /api/auth/signout      - 登出                         │ │   │
│  │  │  GET    /api/auth/session      - 获取会话                     │ │   │
│  │  │  GET    /api/user/hosts        - 获取主机配置                 │ │   │
│  │  │  POST   /api/user/hosts        - 添加主机配置                 │ │   │
│  │  │  PUT    /api/user/hosts/:id    - 更新主机配置                 │ │   │
│  │  │  DELETE /api/user/hosts/:id    - 删除主机配置                 │ │   │
│  │  │  POST   /api/user/hosts/sync   - 同步主机配置                 │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      ▲                                    │
│                                      │ REST API                           │
│           ┌──────────────────────────┴──────────────────────────┐         │
│           │                          │                                          │
│           ▼                          ▼                                          │
│  ┌─────────────┐            ┌─────────────┐                                             │
│  │ 移动端 H5   │            │  PC 端 Web  │                                             │
│  │             │            │             │                                             │
│  │┌───────────┐│            │┌───────────┐│                                             │
│  ││@liuma/    ││            ││@liuma/    ││                                             │
│  ││auth-sdk   ││            ││auth-sdk   ││                                             │
│  ││           ││            ││           ││                                             │
│  ││• IndexedDB││            ││• Cookie    ││                                             │
│  ││• REST API ││            ││• REST API ││                                             │
│  ││• Hooks    ││            ││• Hooks    ││                                             │
│  │└───────────┘│            │└───────────┘│                                             │
│  └─────────────┘            └─────────────┘                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 角色分工

| 层级 | 组件 | 职责 |
|------|------|------|
| **认证中心** | Liuma (后端) | • 统一用户数据库<br>• Better Auth 配置<br>• OAuth 2.0<br>• 主机配置 API |
| **SDK** | @liuma/auth-sdk | • 认证 API 封装<br>• 平台适配<br>• 存储抽象<br>• 同步逻辑 |
| **客户端** | app-h5 / multi-tenant | • UI 展示<br>• 业务逻辑<br>• 集成 SDK |

---

## 实施路线

### 阶段划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           实施时间线（修正版）                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Week 1: API 设计与基础设施                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • OpenAPI 规范设计                                                  │   │
│  │  • 数据库 Schema 扩展（host_configs 表）                             │   │
│  │  • 搭建监控系统（Winston + Prometheus）                              │   │
│  │  • 配置 Monorepo（pnpm workspace）                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Week 2-3: 认证中心后端开发                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 主机配置 CRUD API                                                │   │
│  │  • 健康检查 API                                                      │   │
│  │  • 同步 API                                                          │   │
│  │  • 权限验证中间件                                                    │   │
│  │  • 单元测试 + 集成测试                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Week 4-5: SDK 开发（Web + Mobile H5）                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 核心类和服务（LiumaAuth, AuthService, HostService）             │   │
│  │  • 存储适配器（Web/Mobile）                                          │   │
│  │  • React Hooks                                                       │   │
│  │  • HTTP 客户端（自动 Token 刷新）                                    │   │
│  │  • 单元测试                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Week 6-7: 移动端集成（app-h5）                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 集成 @liuma/auth-sdk（workspace 引用）                           │   │
│  │  • 登录/登出页面                                                     │   │
│  │  • 主机配置管理 UI                                                  │   │
│  │  • 主机切换组件                                                      │   │
│  │  • 离线支持（IndexedDB）                                             │   │
│  │  • 设备测试                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Week 8-9: PC 端集成（multi-tenant）                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 集成 @liuma/auth-sdk（workspace 引用）                           │   │
│  │  • 主机配置管理 UI                                                  │   │
│  │  • 健康状态显示                                                      │   │
│  │  • 功能测试                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Week 10: 测试与部署（含监控实施）                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • 端到端测试                                                        │   │
│  │  • 性能测试                                                          │   │
│  │  • 安全测试                                                          │   │
│  │  • 监控配置                                                          │   │
│  │  • 文档完善                                                          │   │
│  │  • 发布准备（内部发布，暂不发布到 npm）                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**总工作量估算**: 10 周

### 详细任务清单

> **注意**：详细的任务清单和进度跟踪请参考 [auth-implementation-plan.md](./auth-implementation-plan.md) 中的"详细任务清单"章节。

#### 快速概览

| 阶段 | 时间 | 主要产出 |
|------|------|---------|
| **Week 1** | API 设计与基础设施 | OpenAPI 规范、监控系统、Monorepo 配置 |
| **Week 2-3** | 认证中心后端 | 主机配置 API、健康检查 API、同步 API |
| **Week 4-5** | SDK 开发 | @liuma/auth-sdk 核心功能、存储适配器、React Hooks |
| **Week 6-7** | 移动端集成 | 登录页面、主机配置管理 UI、离线支持 |
| **Week 8-9** | PC 端集成 | 主机配置管理 UI、健康状态显示 |
| **Week 10** | 测试与部署 | 端到端测试、性能测试、监控实施 |

#### 关键里程碑

- **Week 1 结束**：API 规范完成、监控系统设计完成
- **Week 3 结束**：后端 API 可用、单元测试通过
- **Week 5 结束**：SDK 开发完成、文档完善
- **Week 7 结束**：移动端集成完成、真机测试通过
- **Week 9 结束**：PC 端集成完成、功能测试通过
- **Week 10 结束**：全面测试通过、监控实施完成、准备上线

---

## 文件结构

### 认证中心 (Liuma 扩展)

```
liuma/
├── src/
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── auth-instance.ts         # Better Auth 配置
│   │   │   └── config.ts                 # 认证配置
│   │   └── db/
│   │       ├── pg/
│   │       │   ├── schema.pg.ts          # 数据库 Schema
│   │       │   └── repositories/
│   │       │       └── host-config.repository.pg.ts  # 主机配置 Repository
│   └── app/
│       └── api/
│           ├── auth/
│           │   ├── signin/route.ts       # 登录
│           │   ├── signout/route.ts      # 登出
│           │   ├── session/route.ts      # 会话
│           │   └── callback/route.ts     # OAuth 回调
│           └── user/
│               └── hosts/
│                   ├── route.ts           # 主机配置 API
│                   ├── sync/route.ts      # 同步 API
│                   └── [id]/
│                       ├── route.ts       # 单个主机 API
│                       └── health/
│                           └── route.ts   # 健康检查
└── drizzle.config.ts
```

### SDK 包

```
@liuma/auth-sdk/
├── src/
│   ├── index.ts                           # 导出入口
│   ├── auth.ts                            # LiumaAuth 主类
│   ├── config.ts                          # 配置
│   ├── types.ts                           # 类型定义
│   ├── platforms/
│   │   ├── detector.ts                    # 平台检测
│   │   ├── web.adapter.ts                 # Web 适配器
│   │   ├── mobile.adapter.ts              # 移动端适配器
│   │   └── factory.ts                     # 工厂
│   ├── storage/
│   │   ├── adapter.ts                      # 存储接口
│   │   └── factory.ts                      # 工厂
│   ├── services/
│   │   ├── auth.service.ts                # 认证服务
│   │   ├── host.service.ts                # 主机服务
│   │   └── sync.service.ts                # 同步服务
│   ├── http/
│   │   └── client.ts                       # HTTP 客户端
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useUser.ts
│   │   ├── useHosts.ts
│   │   └── useSession.ts
│   └── utils/
│       ├── crypto.ts                       # 加密
│       └── logger.ts                       # 日志
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 移动端 (app-h5)

```
src/canvas-host/app-h5/
├── lib/
│   ├── auth.ts                           # SDK 导出
│   └── hosts/
│       ├── remote-sync.ts                 # 远程同步
│       └── local-storage.ts               # 本地存储
├── pages/
│   ├── auth/
│   │   ├── signin/                        # 登录页
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── page.tsx                   # OAuth 回调
│   └── hosts/
│       └── page.tsx                       # 主机配置页
├── components/
│   ├── AuthButton.tsx                     # 登录/登出按钮
│   ├── HostSwitcher.tsx                   # 主机切换组件
│   └── HostList.tsx                       # 主机列表
└── hooks/
    ├── useAuth.ts                         # 从 SDK 导出
    └── useHosts.ts                        # 从 SDK 导出
```

### PC 端 (multi-tenant)

```
multi-tenant/frontend/
├── lib/
│   └── auth.ts                           # SDK 导出
├── app/
│   └── dashboard/
│       └── hosts/
│           └── page.tsx                   # 主机配置页
└── components/
    └── hosts/
        ├── HostList.tsx                   # 主机列表
        ├── AddHostDialog.tsx              # 添加主机对话框
        └── HealthIndicator.tsx            # 健康指示器
```

---

## 环境变量

### 认证中心 (Liuma)

```bash
# .env.production

# Better Auth
BETTER_AUTH_SECRET=your-secret-min-32-chars
BETTER_AUTH_URL=https://auth.liuma.app

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/liuma_auth

# OAuth - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth - Microsoft
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# CORS
ALLOWED_ORIGINS=https://app.openclaw.app,https://mobile.openclaw.app
```

### 移动端 (app-h5)

```bash
# .env.local

# 认证中心地址
NEXT_PUBLIC_AUTH_CENTER_URL=https://auth.liuma.app

# 应用 ID
NEXT_PUBLIC_APP_ID=openclaw-h5

# 是否启用调试
NEXT_PUBLIC_DEBUG=false
```

### PC 端 (multi-tenant)

```bash
# .env.local

# 认证中心地址
AUTH_CENTER_URL=https://auth.liuma.app

# 应用 ID
NEXT_PUBLIC_APP_ID=openclaw-pc
```

---

## 测试场景

### 端到端测试场景

#### 场景 1: 用户注册并登录

```
1. 用户在移动端打开应用
2. 点击"登录"按钮
3. 跳转到认证中心
4. 选择使用 GitHub 登录
5. 授权成功后重定向回应用
6. 查看用户信息显示正确
7. 登出
8. 确认本地存储已清除
```

#### 场景 2: 主机配置管理

```
1. 用户已登录
2. 进入"主机配置"页面
3. 点击"添加主机"
4. 输入主机名称和 URL
5. 点击"验证连接"
6. 验证成功后保存
7. 主机列表显示新主机
8. 设置为默认主机
9. 在应用中切换到新主机
```

#### 场景 3: 跨设备同步

```
1. 用户在 PC 端添加主机配置 A
2. 用户在移动端打开应用
3. 登录（与 PC 端同一账户）
4. 进入"主机配置"页面
5. 点击"同步"按钮
6. 主机配置 A 出现在列表中
7. 在移动端连接主机 A
8. 验证连接成功
```

#### 场景 4: 离线支持

```
1. 用户在移动端已登录
2. 添加多个主机配置
3. 断开网络连接
4. 应用仍可查看本地主机配置
5. 选择主机并连接
6. 连接网后自动同步
7. 验证数据一致性
```

---

## 关键技术点

### 1. CORS 配置

认证中心需要配置 CORS 以允许不同域的客户端访问：

```typescript
// liuma/src/app/api/[...catch]/route.ts
import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth, {
  // 允许的跨域来源
  cors: {
    origin: [
      'https://app.openclaw.app',
      'https://mobile.openclaw.app',
      'https://*.liuma.app',
      'http://localhost:3000',
      'http://localhost:18789',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});
```

### 2. Token 管理

SDK 需要自动管理 Token 的刷新：

```typescript
// src/http/client.ts

export class HTTPClient {
  private async request<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<T> {
    let response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...this.getHeaders(),
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    // Token 过期，自动刷新
    if (response.status === 401) {
      const newToken = await this.authService.refreshToken();
      if (newToken) {
        // 重试请求
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            ...this.getHeaders(),
            Authorization: `Bearer ${newToken}`,
          },
          body: data ? JSON.stringify(data) : undefined,
        });
      }
    }

    return this.handleResponse<T>(response);
  }
}
```

### 3. 同步冲突解决

当多个设备同时修改主机配置时，需要解决冲突：

```typescript
// src/services/sync.service.ts

export class SyncService {
  async sync(): Promise<HostConfig[]> {
    const localHosts = await this.storage.get('hosts', []);
    const remoteHosts = await this.http.get('/api/user/hosts');

    // 使用最后更新时间作为冲突解决策略
    const mergedMap = new Map<string, HostConfig>();

    // 合并策略：updatedAt 优先
    for (const remote of remoteHosts) {
      mergedMap.set(remote.id, remote);
    }

    for (const local of localHosts) {
      const remote = mergedMap.get(local.id);

      if (!remote) {
        // 远程不存在，上传
        const uploaded = await this.http.post('/api/user/hosts', local);
        mergedMap.set(uploaded.id, uploaded);
      } else if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
        // 本地更新，上传并覆盖
        const updated = await this.http.put(`/api/user/hosts/${local.id}`, local);
        mergedMap.set(updated.id, updated);
      }
      // 否则使用远程版本
    }

    return Array.from(mergedMap.values());
  }
}
```

---

## 总结

### 最终推荐

**方案二 + 方案三 结合**是最佳选择：

1. **统一后端**（方案二）
   - Liuma 作为认证中心
   - 统一的用户数据库
   - 完整的 API 端点

2. **SDK 封装**（方案三）
   - 跨平台认证客户端
   - 自动平台适配
   - 统一的 API 接口

3. **优势**
   - 真正的 SSO 体验
   - 主机配置跨设备同步
   - 易于扩展到新平台
   - 代码复用，减少重复开发

### 工作量估算

| 阶段 | 工作量 | 说明 |
|------|--------|------|
| API 设计与基础设施 | 1 周 | OpenAPI 规范、监控系统设计、Monorepo 配置 |
| 认证中心后端 | 2 周 | 主机配置 CRUD API、健康检查 API、同步 API |
| SDK 开发 | 2 周 | 实现核心 SDK、平台适配器（Web + Mobile H5）、Hooks |
| 移动端集成 | 2 周 | 集成 SDK，实现 UI，离线支持 |
| PC 端集成 | 2 周 | 集成 SDK，主机配置管理 UI，健康状态显示 |
| 测试与部署 | 1 周 | 端到端测试、性能优化、监控实施 |
| **总计** | **10 周** | **约 2.5 个月** |

### 后续扩展（未来计划）

完成基础实施后，可以考虑扩展：

1. **原生应用支持**（当前不实施）
   - iOS Keychain 适配器
   - Android EncryptedStorage 适配器
   - React Native 集成

2. **高级功能**（未来可选）
   - 二维码扫描登录
   - 生物识别认证
   - 多因素认证 (MFA)

3. **企业功能**（未来可选）
   - 团队管理
   - 权限继承
   - 审计日志

---

## 附录

### OpenClaw 项目文档

- **[OpenClaw 认证集成设计](./auth-integration-design.md)**：app-h5 和 multi-tenant 的详细集成方案
- **[移动端多端架构设计](./OpenClaw移动端多端架构设计方案.md)**：移动端整体架构设计

### Liuma 项目文档（位于 `../liuma/docs/auth/`）

- **[统一认证中心设计](../../liuma/docs/auth/unified-auth-center-design.md)**：Liuma 后端 API 设计
- **[SDK 技术设计](../../liuma/docs/auth/auth-sdk-design.md)**：@liuma/auth-sdk 架构与通用使用指南
- **[完整实施计划](../../liuma/docs/auth/auth-implementation-plan.md)**：10 周开发计划和任务清单

### 技术参考

- [Better Auth 官方文档](https://www.better-auth.com)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Dexie (IndexedDB)](https://dexie.org)

### 联系方式

如有问题或建议，请联系 Liuma 开发团队。
