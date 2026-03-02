# OpenClaw 后端认证服务器配置指南

## 概述

OpenClaw 包含两个前端应用和一个后端服务，每个都有独立的配置文件。本指南明确说明如何配置后端认证服务器地址。

---

## 架构组件

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │  PC 前端     │      │ 移动端 H5    │               │
│  │  (Next.js)   │      │  (React/Vite) │               │
│  │  Port: 3002  │      │  Port: 18792  │               │
│  └──────┬───────┘      └──────┬───────┘               │
│         │                     │                         │
│         └──────────┬──────────┘                         │
│                    │                                    │
│                    ▼                                    │
│         ┌──────────────────┐                           │
│         │  后端 API 服务   │                           │
│         │  (tenant-manager)│                           │
│         │  Port: 3000      │                           │
│         └──────────────────┘                           │
│                    │                                    │
│                    ▼                                    │
│         ┌──────────────────┐                           │
│         │  PostgreSQL      │                           │
│         │  Port: 5432      │                           │
│         └──────────────────┘                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 配置文件说明

### 1. PC 前端配置

**配置文件位置**: `/home/ubuntu/proj/openclaw/multi-tenant/frontend/.env.local`

```bash
# ==================== 后端 API 配置 ====================
# 后端 API 的基础地址（包含 /api 路径）
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# ==================== 应用基础配置 ====================
# 当前应用的前端地址（用于 OAuth 回调）
NEXT_PUBLIC_APP_URL=http://localhost:3002

# ==================== 后端基础地址 ====================
# 后端服务器地址（不包含 /api，用于 OAuth 重定向）
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# ==================== Liuma 认证中心配置 ====================
# Liuma 认证中心地址（第三方 OAuth 登录）
NEXT_PUBLIC_LIUMA_URL=https://auth.liuma.app

# 在 Liuma 注册的应用 ID
NEXT_PUBLIC_APP_ID=openclaw-pc
```

**说明**:
- `NEXT_PUBLIC_API_URL`: 用于所有 API 请求
- `NEXT_PUBLIC_BACKEND_URL`: 用于 OAuth 回跳转
- `NEXT_PUBLIC_APP_URL`: 前端自身地址

---

### 2. 移动端 H5 配置

**配置文件位置**: `/home/ubuntu/proj/openclaw/src/canvas-host/app-h5/.env`

```bash
# ==================== Liuma 认证中心配置 ====================
# Liuma 认证中心地址
VITE_AUTH_CENTER_URL=https://auth.liuma.app

# 在 Liuma 注册的应用 ID
VITE_APP_ID=openclaw-h5

# ==================== 后端 API 配置 ====================
# 租户管理后端 API 地址
VITE_TENANT_MANAGER_URL=http://localhost:3000
```

**说明**:
- `VITE_AUTH_CENTER_URL`: Liuma 认证中心地址
- `VITE_APP_ID`: H5 应用的 Liuma ID
- `VITE_TENANT_MANAGER_URL`: 后端 API 地址

---

### 3. 后端服务配置

**配置文件位置**: `/home/ubuntu/proj/openclaw/multi-tenant/tenant-manager/.env`

```bash
# ==================== 数据库配置 ====================
DATABASE_URL=postgresql://openclaw:password@localhost:5432/openclaw

# ==================== JWT 配置 ====================
JWT_SECRET=your-secret-key-here

# ==================== Liuma Bearer Token 认证 ====================
# 启用 Liuma Bearer Token 认证
LIUMA_AUTH_ENABLED=true

# Liuma 认证中心地址（后端验证 token）
LIUMA_AUTH_CENTER_URL=https://auth.liuma.app

# 在 Liuma 注册的应用 ID
LIUMA_APP_ID=openclaw-backend
```

**说明**:
- 后端服务会验证从 Liuma 返回的 Bearer Token
- 支持多种认证方式：JWT、Liuma Bearer Token、Shared Secret

---

## 环境变量对照表

| 用途 | PC 前端 | 移动端 H5 | 后端服务 |
|------|---------|-----------|----------|
| **后端 API 地址** | `NEXT_PUBLIC_API_URL`<br>=`http://localhost:3000/api` | `VITE_TENANT_MANAGER_URL`<br>=`http://localhost:3000` | - |
| **应用自身地址** | `NEXT_PUBLIC_APP_URL`<br>=`http://localhost:3002` | (自动检测) | - |
| **OAuth 回调地址** | `NEXT_PUBLIC_BACKEND_URL`<br>=`http://localhost:3000` | - | - |
| **Liuma 认证中心** | `NEXT_PUBLIC_LIUMA_URL`<br>=`https://auth.liuma.app` | `VITE_AUTH_CENTER_URL`<br>=`https://auth.liuma.app` | `LIUMA_AUTH_CENTER_URL`<br>=`https://auth.liuma.app` |
| **Liuma 应用 ID** | `NEXT_PUBLIC_APP_ID`<br>=`openclaw-pc` | `VITE_APP_ID`<br>=`openclaw-h5` | `LIUMA_APP_ID`<br>=`openclaw-backend` |

---

## 生产环境配置

### PC 前端生产配置

**文件**: `multi-tenant/frontend/.env.production`

```bash
# 生产环境后端地址
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com
NEXT_PUBLIC_LIUMA_URL=https://auth.liuma.app
NEXT_PUBLIC_APP_ID=openclaw-pc
```

### 移动端 H5 生产配置

**文件**: `src/canvas-host/app-h5/.env.production`

```bash
# 生产环境配置
VITE_AUTH_CENTER_URL=https://auth.liuma.app
VITE_APP_ID=openclaw-h5
VITE_TENANT_MANAGER_URL=https://api.your-domain.com
```

### 后端服务生产配置

**文件**: `multi-tenant/tenant-manager/.env.production`

```bash
DATABASE_URL=postgresql://user:password@postgres:5432/openclaw
JWT_SECRET=your-production-secret
LIUMA_AUTH_ENABLED=true
LIUMA_AUTH_CENTER_URL=https://auth.liuma.app
LIUMA_APP_ID=openclaw-backend
```

---

## 端口分配（开发环境）

| 服务 | 端口 | 地址 |
|------|------|------|
| **PC 前端** | 3002 | http://localhost:3002 |
| **移动端 H5** | 18792 | http://localhost:18792 |
| **后端 API** | 3000 | http://localhost:3000 |
| **PostgreSQL** | 5432 | localhost:5432 |

---

## 常见问题

### Q1: 修改配置后如何生效？

**PC 前端**: 需要重启开发服务器
```bash
cd multi-tenant/frontend
# 停止当前服务器 (Ctrl+C)
npm run dev
```

**移动端 H5**: Vite 支持热更新，部分修改会自动生效，建议重启
```bash
# 停止当前服务器
npm run app:h5:dev
```

**后端服务**: 需要重启
```bash
cd multi-tenant/tenant-manager
# 停止当前服务器
npm run dev
```

### Q2: 如何验证配置是否正确？

**方法1**: 检查环境变量
```bash
# PC 前端
cd multi-tenant/frontend
cat .env.local | grep API_URL

# 移动端 H5
cd src/canvas-host/app-h5
cat .env | grep TENANT_MANAGER_URL
```

**方法2**: 测试 API 连接
```bash
# 测试后端健康检查
curl http://localhost:3000/api/health

# 测试前端页面
curl http://localhost:3002
curl http://localhost:18792
```

### Q3: OAuth 登录失败怎么办？

1. **检查 Liuma 应用配置**
   - 确认在 https://auth.liuma.app 注册了应用
   - 确认回调 URL 配置正确

2. **检查回调 URL 配置**
   - PC 端: `https://your-domain.com/auth/callback`
   - 移动端: `https://h5.your-domain.com/auth/callback`

3. **检查后端日志**
   ```bash
   # 查看后端日志
   tail -f /tmp/tenant-manager.log
   ```

---

## Docker 生产部署配置

生产环境使用 Docker Compose 部署，配置文件：

**文件**: `multi-tenant/docker-compose.prod.yml`
**环境配置**: `multi-tenant/.env.production`

详见: [生产环境部署指南](./production-deployment.md)

---

## 总结

### 关键配置点

1. **PC 前端配置**: `multi-tenant/frontend/.env.local`
   - API 地址: `NEXT_PUBLIC_API_URL`
   - 后端地址: `NEXT_PUBLIC_BACKEND_URL`

2. **移动端 H5 配置**: `src/canvas-host/app-h5/.env`
   - 后端地址: `VITE_TENANT_MANAGER_URL`
   - Liuma 地址: `VITE_AUTH_CENTER_URL`

3. **后端服务配置**: `multi-tenant/tenant-manager/.env`
   - 数据库: `DATABASE_URL`
   - Liuma: `LIUMA_AUTH_CENTER_URL`

### 快速配置检查清单

- [ ] PC 前端 `.env.local` 已配置
- [ ] 移动端 H5 `.env` 已配置
- [ ] 后端服务 `.env` 已配置
- [ ] PostgreSQL 已启动
- [ ] 后端服务已启动 (port 3000)
- [ ] PC 前端已启动 (port 3002)
- [ ] 移动端 H5 已启动 (port 18792)
- [ ] 可以访问 http://localhost:3002
- [ ] 可以访问 http://localhost:18792
- [ ] 后端健康检查正常: `curl http://localhost:3000/api/health`
