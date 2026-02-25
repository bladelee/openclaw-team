# OpenClaw 多租户系统 - 需求确认与实现范围

> 日期: 2026-02-06
> 基于: 用户已存在 SSO + Web 界面 + 手动 Worker 管理

---

## 已存在的系统组件

### 你已有的 ✅

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| **SSO 服务器** | Casdoor / NextAuth (Better-Auth) | OAuth 2.0 授权服务器 |
| **用户登录界面** | Next.js Web 应用 | 登录、注册功能 |
| **用户管理** | 现有用户系统 | 一个用户 = 一个租户 |
| **团队功能** | 现有系统 | 用户可以创建团队 |
| **Worker 主机** | 手动管理 | 服务器少，手动添加即可 |

---

## 需要实现的核心功能

### 1. 租户管理 API 与现有 SSO 对接 ⭐

#### 功能说明

将现有 SSO 系统的用户信息与租户系统关联，实现：

```
用户在现有 SSO 登录
        ↓
现有 Web 应用调用租户 API
        ↓
创建/获取用户的租户容器
        ↓
返回租户访问地址
        ↓
用户通过子域名访问自己的 OpenClaw
```

#### 需要实现的 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tenants` | POST | 创建当前用户的租户 |
| `/api/tenants/me` | GET | 获取当前用户的租户状态 |
| `/api/tenants/me` | DELETE | 删除当前用户的租户 |
| `/api/tenants/me` | POST | 重启当前用户的租户 |
| `/api/tenants/me/logs` | GET | 获取租户日志 |
| `/api/internal/route` | GET | 内部路由查询（Nginx 调用） |
| `/api/health` | GET | 健康检查 |
| `/api/hosts` | GET | 获取主机状态 |

#### 认证方式

**选项 A: 共享 Secret（推荐）**

```typescript
// 在你的 SSO 服务器和租户管理 API 之间共享密钥
// 租户 API 验证来自 SSO 的 JWT token

// 你的 SSO 服务器调用租户 API 时：
POST http://tenant-manager:3000/api/tenants
Headers:
  X-User-ID: user-123
  X-User-Email: user@example.com
  X-Shared-Secret: SHARED_SECRET_KEY
```

**选项 B: Token 验证**

```typescript
// 验证 SSO 颁发的 JWT token
// 需要配置 SSO 的 JWT 密钥或公钥

POST http://tenant-manager:3000/api/tenants
Headers:
  Authorization: Bearer SSO_JWT_TOKEN
```

#### 需要确认的信息

1. **你的 SSO 服务器技术栈**
   - [ ] Casdoor
   - [ ] NextAuth.js
   - [ ] Better-Auth
   - [ ] 其他: _____

2. **SSO 服务器的部署地址**
   - URL: ___________

3. **可以接受的认证方式**
   - [ ] 共享 Secret（最简单）
   - [ ] JWT Token 验证（需要密钥配置）
   - [ ] OAuth 2.0 客户端凭证（最复杂）

---

### 2. Web 前端集成（现有界面调用 API）⭐

#### 功能说明

在你现有的 Web 应用中添加 "我的 OpenClaw" 功能入口：

```
现有 Web 应用
├── 用户仪表板
│   ├── 用户信息
│   ├── 我的设置
│   └── 我的 OpenClaw  ← 添加这个菜单
│       ├── 创建实例
│       ├── 我的实例
│       └── 实例管理
```

#### 需要集成的功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| **创建实例** | 调用 POST /api/tenants | P0 |
| **查看实例** | 调用 GET /api/tenants/me | P0 |
| **删除实例** | 调用 DELETE /api/tenants/me | P1 |
| **查看日志** | 调用 GET /api/tenants/me/logs | P1 |
| **重启实例** | 调用 POST /api/tenants/me/restart | P2 |

#### 前端 API 调用示例

```typescript
// 在你的现有 Web 应用中集成

// 1. 创建租户实例
async function createTenant(plan: 'basic' | 'pro' | 'enterprise') {
  const response = await fetch('http://tenant-manager:3000/api/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 使用你的 SSO 认证
      'X-User-ID': currentUserId,
      'X-User-Email': currentUserEmail,
      'X-Shared-Secret': process.env.SHARED_SECRET_KEY,
    },
    body: JSON.stringify({
      email: currentUserEmail,
      plan,
    }),
  });

  return response.json();
}

// 2. 获取租户状态
async function getMyTenant() {
  const response = await fetch('http://tenant-manager:3000/api/tenants/me', {
    method: 'GET',
    headers: {
      'X-User-ID': currentUserId,
      'X-Shared-Secret': process.env.SHARED_SECRET_KEY,
    },
  });

  return response.json();
}
```

---

### 3. 租户子域名路由 ⭐

#### 功能说明

用户通过子域名访问自己的 OpenClaw 实例：

```
https://tenant-user123.openclaw.app/  →  Portainer 上的容器
https://tenant-company456.openclaw.app/  →  不同容器
```

#### 已实现

✅ Nginx 动态路由配置已实现
✅ 内部路由 API (`/api/internal/route`) 已实现

#### 需要配置的 DNS

```bash
# 通配符域名配置
*.openclaw.app A 记录 → 你的服务器 IP

# 或使用 CNAME
*.openclaw.app CNAME → your-server.com
```

#### 需要确认

1. **域名**: 是否有 `openclaw.app` 域名？
2. **DNS 管理**: 是否可以配置通配符子域名？
3. **SSL 证书**: 是否需要通配符 SSL 证书？

---

## 不需要实现的功能 ❌

基于你的约束，以下功能不需要实现：

- ❌ **OAuth 2. 授权服务器**（已有 Casdoor/NextAuth）
- ❌ **用户登录界面**（已有 Web 应用）
- ❌ **Worker 自动注册**（手动管理即可）
- ❌ **硬件盒子配网**（不需要）
- ❌ **设备预注册**（不需要）
- ❌ **QR 码配网**（不需要）

---

## 实现确认清单

### P0 - 必须实现

- [ ] **租户管理 API 认证集成**
  - [ ] 与你的 SSO 集成（共享 Secret 或 JWT）
  - [ ] 用户 ID/邮箱 映射

- [ ] **Web 前端 API 客户端**
  - [ ] 创建租户函数
  - [ ] 获取租户状态函数
  - [ ] 在现有仪表板添加 "我的 OpenClaw" 入口

- [ ] **子域名 DNS 配置**
  - [ ] 通配符 A 记录或 CNAME
  - [ ] SSL 证书（Let's Encrypt 或手动）

### P1 - 重要功能

- [ ] 租户删除功能集成
- [ ] 租户日志查看界面
- [ ] 租户状态监控

### P2 - 可选功能

- [ ] 租户重启功能
- [ ] 多租户/团队支持（创建多个实例）
- [ ] 资源使用统计

---

## 需要你提供的信息

为了正确实现集成，请确认：

### 1. 认证方式

**选择一：共享 Secret（推荐，最简单）**

```typescript
// 你的 SSO 服务器添加密钥
SHARED_SECRET_KEY=your-secret-key-here

// 调用租户 API 时携带
headers: {
  'X-User-ID': 'user-123',
  'X-User-Email': 'user@example.com',
  'X-Shared-Secret': SHARED_SECRET_KEY,
}
```

**选择二：JWT Token 验证**

```typescript
// 租户管理 API 验证你的 SSO 签发的 JWT
// 需要提供：
- JWT 密钥（或公钥）
- Token 签名算法（RS256/HS256）
```

### 2. 你的 SSO 系统信息

- SSO 服务器 URL: ___________
- JWT 密钥路径或环境变量: ___________

### 3. 域名和证书

- 是否已有 `openclaw.app` 域名？: [ ] 是 [ ] 否
- 如有，是否已配置通配符子域名？: [ ] 是 [ ] 否
- 是否有 SSL 证书？: [ ] 是 [ ] 否

### 4. 部署环境

- 租户管理服务部署位置: [ ] 同服务器 [ ] 独立服务器
- 是否需要跨域调用？: [ ] 是 [ ] 否

---

## 简化后的实现范围

基于你的约束，需要实现的功能大幅简化：

### 核心工作（2-3 天）

1. **API 认证中间件**
   - 根据你的 SSO 系统选择认证方式
   - 1-2 小时工作量

2. **前端集成**
   - 在你的 Web 应用中添加 API �用
   - 显示租户创建/管理界面
   - 4-6 小时工作量

3. **DNS 配置**
   - 配置通配符子域名
   - 获取 SSL 证书
   - 1-2 小时工作量

**总计：约 1-2 天完成**

---

## 确认问题

请回答以下问题，我将据此实现最终功能：

1. **SSO 认证方式选择**
   - [ ] 共享 Secret（推荐）
   - [ ] JWT Token 验证
   - [ ] 其他方式：__________

2. **是否已有 openclaw.app 域名？**
   - [ ] 是，已配置
   - [ ] 否，需要申请
   - [ ] 使用其他域名：__________

3. **Web 应用技术栈**
   - 框架：[ ] Next.js [ ] React [ ] Vue [ ] 其他
   - 部署：[ ] Vercel [ ] Netlify [ ] 自托管服务器

4. **部署架构**
   - [ ] 所有服务在同一服务器
   - [ ] 租户管理服务在独立服务器
   - [ ] 其他：__________

5. **优先级**
   - [ ] 优先实现 API 认证
   - [ ] 优先实现前端集成
   - [ ] 同时进行

请确认后，我将立即开始实现。
