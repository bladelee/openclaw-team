# OpenClaw 多场景部署认证方案与架构分析

## 第一部分：Agent 和 Gateway 运行架构分析

### 核心问题解答

#### 1. Agent 和 Gateway 是分开运行的吗？

**答案：不是完全分开的进程，而是嵌入式架构**

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway 进程                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         WebSocket Server (ws://localhost:18789)     │   │
│  │  - 处理客户端连接                                    │   │
│  │  - 认证和授权                                        │   │
│  │  - 消息路由                                          │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │         Gateway Methods 层                          │   │
│  │  - chat.send, chat.history, chat.abort              │   │
│  │  - sessions.*, agents.*, channels.*                │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│  ┌────────────────────▼────────────────────────────────┐   │
│  │         Embedded Agent (pi-embedded-runner)         │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  pi-ai SDK (npm 包)                         │   │   │
│  │  │  - Claude API 调用                          │   │   │
│  │  │  - 消息处理                                  │   │   │
│  │  │  - 工具执行                                  │   │   │
│  │  │  - 上下文管理                                │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────┘   │
│                         ▲                                 │
│                         │                                 │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │         Host Process (Node.js)                      │   │
│  │  - 文件系统访问                                      │   │
│  │  - 子进程执行                                         │   │
│  │  - 环境变量访问                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**关键点**：
- Gateway 和 Agent **运行在同一进程**中
- Agent 是通过 `pi-ai` SDK **嵌入式集成**的
- 不是独立的 Python 进程或容器

---

#### 2. Agent 运行在沙盒中吗？

**答案：默认不在沙盒中，但支持隔离配置**

##### 默认模式（Host 直接运行）

```typescript
// 默认情况下，Agent 直接在 Host 进程中运行

// src/agents/pi-embedded-runner/run.ts

const resolvedWorkspace = resolveUserPath(params.workspaceDir);
// 直接访问文件系统
const prevCwd = process.cwd();  // 当前工作目录

// 工具执行直接使用 Node.js spawn
import { spawn } from "node:child_process";
spawn(command, args, {
  cwd: process.cwd(),  // 直接在 Host 环境
  env: process.env,     // 直接访问环境变量
});
```

**默认行为**：
- ✅ Agent 可以直接访问文件系统
- ✅ Agent 可以执行 Shell 命令
- ✅ Agent 可以访问环境变量
- ⚠️ **安全风险**：Agent 可以执行任意命令

##### 隔离模式（可选）

**方式 1: 工作区隔离**
```yaml
# ~/.openclaw/config.yml

agents:
  defaults:
    workspaceRoot: "~/openclaw-workspaces"

  # 或针对特定 Agent
  isolated:
    workspace: "~/openclaw-isolated"
    workspaceRoot: "/tmp/isolated-sandboxes"
```

**方式 2: Profile 隔离**
```bash
# 使用独立的 profile
openclaw --profile isolated
```

**限制**：
- ❌ **不是真正的沙盒**：仍然在 Host 进程中运行
- ❌ **无法限制系统调用**：可以绕过限制访问资源
- ⚠️ **仅工作区隔离**：文件系统路径隔离，不是进程隔离

##### 真正的沙盒方案（需要额外配置）

**Docker 隔离**（推荐）：
```bash
# 在 Docker 容器中运行 Gateway
docker run -d \
  -v openclaw-data:/data \
  -p 18789:18789 \
  --openclaw/gateway
```

**Firecracker/gVisor**（高级）：
- 需要额外配置
- 微虚拟机级别的隔离
- 性能开销较大

---

#### 3. 一个 Gateway 可以支持多用户、不同 Agent 吗？

**答案：是的，完全支持**

##### 多用户支持

```
┌────────────────────────────────────────────────────────────┐
│                    Gateway Server                           │
│  WebSocket: ws://gateway.example.com:18789                 │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   用户 A    │  │   用户 B    │  │   用户 C    │       │
│  │  sessionKey: │  │  sessionKey: │  │  sessionKey: │       │
│  │  "user-a"    │  │  "user-b"    │  │  "user-c"    │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          │                                 │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │              Session Manager                         │  │
│  │  - 每个用户独立会话                                   │  │
│  │  - 独立消息历史                                       │  │
│  │  - 独立 Agent 配置（可选）                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │   Agent A     │  │   Agent B     │  │   Agent C     │  │
│  │  (assistant)  │  │  (coder)      │  │  (analyst)    │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**实现方式**：

**方式 1: 使用不同的 sessionKey**
```javascript
// 用户 A
const clientA = new GatewayClient({ url: 'ws://gateway:18789' });
await clientA.request('chat.send', {
  sessionKey: 'user-a',  // 用户 A 的会话
  message: 'Hello',
});

// 用户 B
const clientB = new GatewayClient({ url: 'ws://gateway:18789' });
await clientB.request('chat.send', {
  sessionKey: 'user-b',  // 用户 B 的会话
  message: 'Hi',
});
```

**方式 2: 使用 Agent 作用域**
```javascript
// 用户 A 使用 assistant Agent
await clientA.request('chat.send', {
  sessionKey: 'agent:assistant:user-a',
  message: 'Help me write code',
});

// 用户 B 使用 coder Agent
await clientB.request('chat.send', {
  sessionKey: 'agent:coder:user-b',
  message: 'Review this PR',
});
```

**会话配置** (`~/.openclaw/sessions.json`):
```json
{
  "entries": {
    "user-a": {
      "sessionId": "sess-a",
      "agentId": "assistant",
      "updatedAt": 1736123456789
    },
    "user-b": {
      "sessionId": "sess-b",
      "agentId": "coder",
      "updatedAt": 1736123456790
    },
    "agent:assistant:user-a": {
      "sessionId": "sess-assistant-a",
      "agentId": "assistant",
      "chatType": "direct"
    },
    "agent:coder:user-b": {
      "sessionId": "sess-coder-b",
      "agentId": "coder",
      "chatType": "direct"
    }
  }
}
```

##### 多 Agent 支持

**配置多个 Agent**:
```yaml
# ~/.openclaw/config.yml

agents:
  defaults:
    model: claude-sonnet-4-5-20250514
    maxConcurrent: 3

  list:
    assistant:
      description: "通用助手"
      model: claude-sonnet-4-5-20250514
      instructions: "You are a helpful assistant."

    coder:
      description: "编程助手"
      model: claude-sonnet-4-5-20250514
      instructions: "You are a coding expert."
      workspace: "~/projects"

    analyst:
      description: "数据分析"
      model: claude-3-7-sonnet-20250219
      instructions: "You analyze data."
```

**动态切换 Agent**:
```javascript
// 使用 assistant
await client.request('chat.send', {
  sessionKey: 'agent:assistant:user-a',
  message: 'Summarize this article',
});

// 同一用户切换到 coder
await client.request('chat.send', {
  sessionKey: 'agent:coder:user-a',
  message: 'Write a function to parse JSON',
});
```

##### 并发控制

```typescript
// src/agents/pi-embedded-runner/run.ts

// 全局并发控制
const globalLane = resolveGlobalLane(params.lane);
enqueueCommandInLane(globalLane, task, opts);

// 会话级并发控制
const sessionLane = resolveSessionLane(params.sessionKey);
enqueueCommandInLane(sessionLane, task, opts);
```

**配置**:
```yaml
agents:
  defaults:
    maxConcurrent: 3          # 全局最大并发
    subagents:
      maxConcurrent: 2        # 子 Agent 最大并发
```

---

### 架构总结

| 特性 | 实现方式 | 备注 |
|------|---------|------|
| **Gateway-Agent 关系** | 嵌入式（同一进程） | 通过 pi-ai SDK 集成 |
| **Agent 沙盒** | 默认无沙盒 | 可配置工作区隔离 |
| **多用户支持** | 完全支持 | 通过 sessionKey 区分 |
| **多 Agent 支持** | 完全支持 | 可配置多个 Agent |
| **并发控制** | 支持 | 全局和会话级队列 |
| **隔离级别** | 进程级 | Docker 可实现容器级隔离 |

---

## 第二部分：多场景部署认证方案

### 场景概述

```
┌─────────────────────────────────────────────────────────────┐
│                      公网负载均衡                           │
│              https://openclaw.example.com                   │
└────────────────┬──────────────────────┬────────────────────┘
                 │                      │
                 │                      │
        ┌────────▼────────┐   ┌────────▼────────┐
        │  云端 Docker      │   │  本地硬件盒子    │
        │  Gateway 实例    │   │  Gateway 实例   │
        │  (多副本)        │   │  (单实例)        │
        └─────────────────┘   └─────────────────┘
                 │                      │
                 │                      │
        ┌────────▼──────────────────────▼────────┐
        │                                      │
        │       Web 客户端                    │
        │  - 桌面浏览器                      │
        │  - H5 移动端                       │
        │                                      │
        └──────────────────────────────────────┘
```

### 方案概览

| 方案 | 复杂度 | 安全性 | 成本 | 推荐度 |
|------|--------|--------|------|--------|
| 1. 共享 Token | 低 | 低 | 低 | ⭐⭐ 开发/测试 |
| 2. 设备签名认证 | 中 | 高 | 中 | ⭐⭐⭐⭐⭐ 生产推荐 |
| 3. OAuth 2.0 + Proxy | 高 | 最高 | 高 | ⭐⭐⭐⭐ 企业级 |
| 4. Tailscale VPN | 低 | 高 | 低 | ⭐⭐⭐⭐ 内网/边缘 |
| 5. mTLS 双向认证 | 高 | 最高 | 高 | ⭐⭐⭐ 高安全 |

---

### 方案 1: 共享 Token（快速开始）

#### 架构

```
云端 Docker                   本地盒子
    │                            │
    │  shared-token             │  shared-token
    │  ┌──────────────┐          │  ┌──────────────┐
    │  │ Gateway 1    │          │  │ Gateway      │
    │  └──────────────┘          │  └──────────────┘
    │  ┌──────────────┐          │
    │  │ Gateway 2    │          │
    │  └──────────────┘          │
    │                            │
    └────────────┬───────────────┘
                 │
        ┌────────▼────────┐
        │  负载均衡器      │
        │  (同一 Token)    │
        └────────────────┘
                 │
        ┌────────▼────────┐
        │  Web/H5 客户端  │
        │  - 使用 Token    │
        └─────────────────┘
```

#### 配置

**云端 Docker**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  openclaw-gateway-1:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_TOKEN=${SHARED_TOKEN}
      - OPENCLAW_GATEWAY_MODE=token
    volumes:
      - openclaw-data-1:/data
    restart: unless-stopped

  openclaw-gateway-2:
    image: openclaw/gateway:latest
    ports:
      - "18790:18789"
    environment:
      - OPENCLAW_GATEWAY_TOKEN=${SHARED_TOKEN}
      - OPENCLAW_GATEWAY_MODE=token
    volumes:
      - openclaw-data-2:/data
    restart: unless-stopped

  # 负载均衡器
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - openclaw-gateway-1
      - openclaw-gateway-2
```

**本地盒子**:
```bash
# ~/.openclaw/config.yml

gateway:
  auth:
    mode: token
    token: ${SHARED_TOKEN}  # 与云端相同
```

**生成共享 Token**:
```bash
# 生成随机 Token
SHARED_TOKEN=$(openssl rand -hex 32)

# 保存到 .env
echo "SHARED_TOKEN=$SHARED_TOKEN" > .env

# 云端部署
docker-compose up -d

# 本地配置
openclaw config set gateway.auth.token "$SHARED_TOKEN"
```

#### 客户端使用

```javascript
// H5 客户端
const client = new GatewayBrowserClient({
  url: 'wss://openclaw.example.com',
  token: 'shared-token-here',  // 所有实例使用相同 Token
});
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 实现简单 | ✗ 安全风险高（Token 泄露） |
| ✓ 无需密钥管理 | ✗ 无法区分客户端 |
| ✓ 易于扩展 | ✗ 无法撤销单个客户端 |
| ✓ 跨实例共享 | ✗ 审计困难 |

#### 适用场景

- 快速原型验证
- 内网环境（可信网络）
- 单用户或少用户场景

---

### 方案 2: 设备签名认证（推荐生产）

#### 架构

```
云端 Docker                   本地盒子
    │                            │
    │  设备认证系统             │  设备认证系统
    │  ┌──────────────┐          │  ┌──────────────┐
    │  │ Gateway 1    │◄────┐   │  │ Gateway      │◄──┐
    │  └──────────────┘    │   │  └──────────────┘   │
    │  ┌──────────────┐    │   │                      │
    │  │ Gateway 2    │◄──┐ │   │                      │
    │  └──────────────┘   │ │   │                      │
    │                      │ │   │                      │
    │              ┌───────┘ │   │                      │
    │              │ 验证签名 │   │                      │
    │              └─────────┘   │                      │
    │                            │
    └────────────┬───────────────┘
                 │
        ┌────────▼────────┐
        │  设备注册表      │
        │  (Redis/DB)      │
        └────────────────┘
```

#### 配置

**云端 Gateway（统一认证服务）**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  openclaw-gateway-1:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=token
      - OPENCLAW_REDIS_HOST=redis
    volumes:
      - openclaw-data-1:/data
    depends_on:
      - redis
    restart: unless-stopped

  openclaw-gateway-2:
    image: openclaw/gateway:latest
    ports:
      - "18790:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=token
      - OPENCLAW_REDIS_HOST=redis
    volumes:
      - openclaw-data-2:/data
    depends_on:
      - redis
    restart: unless-stopped

  # 设备注册服务（可选，用于管理）
  device-registry:
    image: openclaw/device-registry:latest
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - DATABASE_URL=postgres://...
    depends_on:
      - redis
```

**客户端首次配对**:

```javascript
// 首次连接：需要共享 Token 进行设备注册

async function registerDevice() {
  // 1. 生成设备身份
  const identity = await generateDeviceIdentity();

  // 2. 使用共享 Token 连接
  const client = new GatewayClient({
    url: 'wss://openclaw.example.com',
    token: SHARED_TOKEN,  // 一次性注册 Token
  });

  // 3. 发送设备注册请求
  const result = await client.request('device.register', {
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    deviceInfo: {
      name: 'My Device',
      type: 'mobile',
    },
  });

  // 4. 保存设备 Token
  localStorage.setItem('deviceToken', result.deviceToken);
  localStorage.setItem('devicePrivateKey', identity.privateKey);

  return result;
}

// 后续连接：使用设备签名
async function connectWithDeviceAuth() {
  const identity = {
    deviceId: localStorage.getItem('deviceId'),
    privateKey: localStorage.getItem('devicePrivateKey'),
  };

  const client = new GatewayClient({
    url: 'wss://openclaw.example.com',
    deviceIdentity: identity,
    deviceToken: localStorage.getItem('deviceToken'),
  });

  await client.connect();
}
```

**Gateway 配置修改**（支持设备注册表）:

需要扩展 Gateway 以支持设备注册表查询：

```typescript
// src/gateway/device-registry.ts

interface DeviceRecord {
  deviceId: string;
  publicKey: string;
  deviceToken?: string;
  registeredAt: number;
  lastSeenAt: number;
  status: 'active' | 'revoked' | 'expired';
}

async function verifyDeviceToken(params: {
  deviceId: string;
  deviceToken: string;
}): Promise<boolean> {
  // 从 Redis/DB 查询设备记录
  const record = await redis.get(`device:${params.deviceId}`);

  if (!record) {
    return false;
  }

  const device = JSON.parse(record) as DeviceRecord;

  // 检查 Token 是否匹配
  if (device.deviceToken !== params.deviceToken) {
    return false;
  }

  // 检查状态
  if (device.status !== 'active') {
    return false;
  }

  // 更新最后活跃时间
  device.lastSeenAt = Date.now();
  await redis.setex(
    `device:${params.deviceId}`,
    30 * 24 * 60 * 60,  // 30 天过期
    JSON.stringify(device)
  );

  return true;
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 每设备独立认证 | ✗ 需要注册表服务 |
| ✓ 可撤销单个设备 | ✗ 首次配对需要共享 Token |
| ✓ 审计日志完整 | ✗ 实现复杂度中等 |
| ✓ 适合多用户 | ✗ 需要管理设备私钥 |

#### 适用场景

- 生产环境
- 多用户场景
- 需要设备管理的场景
- 需要审计和合规的场景

---

### 方案 3: OAuth 2.0 + 反向代理（企业级）

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
│                  (访问 https://app.example.com)             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │  OAuth 2.0 提供商     │
                 │  (Auth0/Okta/GitHub)  │
                 └──────────┬────────────┘
                            │
                            ▼
                 ┌───────────────────────┐
                 │  反向代理            │
                 │  - 验证 OAuth Token   │
                 │  - 提取用户信息       │
                 │  - 添加用户头         │
                 └──────────┬────────────┘
                            │
                ┌───────────┴──────────┐
                │                      │
        ┌───────▼──────┐     ┌───────▼──────┐
        │  云端 Docker  │     │  本地盒子     │
        │  Gateway 1    │     │  Gateway      │
        │              │     │  (VPN 隧道)   │
        └──────────────┘     └──────────────┘
```

#### 配置

**OAuth 2.0 提供者配置**（以 Auth0 为例）:

```javascript
// auth0-config.js

export const authConfig = {
  domain: 'your-tenant.auth0.com',
  clientId: 'your-client-id',
  audience: 'https://openclaw.example.com',
};

export async function login() {
  const domain = authConfig.domain;
  const clientId = authConfig.clientId;
  const redirectUri = window.location.origin + '/callback';

  // 重定向到 Auth0
  const scope = 'openid profile email';
  const response = 'code';

  window.location.href = `
    https://${domain}/authorize?
      response_type=${response}&
      client_id=${clientId}&
      redirect_uri=${encodeURIComponent(redirectUri)}&
      scope=${encodeURIComponent(scope)}&
      audience=${encodeURIComponent(authConfig.audience)}
  `;
}

export async function handleCallback() {
  const code = new URLSearchParams(window.location.search).get('code');

  // 交换 code for token
  const tokenResponse = await fetch(`https://${authConfig.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: authConfig.clientId,
      client_secret: 'your-client-secret',
      code,
      redirect_uri: window.location.origin + '/callback',
    }),
  });

  const tokens = await tokenResponse.json();
  localStorage.setItem('access_token', tokens.access_token);

  return tokens;
}
```

**Nginx 反向代理配置**:

```nginx
# nginx.conf

# OAuth 2.0 验证
auth_request /auth-validator;
auth_request_set $user_id $upstream_http_x_user_id;
auth_request_set $user_email $upstream_http_x_user_email;

# 上游服务器（云端和本地）
upstream openclaw_cloud {
    server 10.0.1.10:18789;
    server 10.0.1.11:18789;
}

upstream openclaw_local {
    server 10.0.2.20:18789;  # VPN 隧道
}

# WebSocket 升级
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name openclaw.example.com;

    ssl_certificate /etc/letsencrypt/live/openclaw.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.example.com/privkey.pem;

    # 根据用户路由到不同的后端
    location /ws {
        # 添加用户信息头
        proxy_set_header X-User-Id $user_id;
        proxy_set_header X-User-Email $user_email;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # 根据用户选择后端（可以在 Lua 中实现）
        proxy_pass http://openclaw_cloud;
    }
}
```

**认证验证服务**:

```javascript
// auth-validator.js

const express = require('express');
const jwt = require('express-jwt');
const { auth } = require('express-openid-connect');

const app = express();

// Auth0 中间件
app.use(auth({
  authRequired: true,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: `https://${process.env.AUTH00}/auth0_ISSUER_BASE_URL`,
}));

// 用户信息端点
app.get('/auth-validator', (req, res) => {
  // 验证 Token 并返回用户信息
  res.setHeader('X-User-Id', req.oid.sub);
  res.setHeader('X-User-Email', req.oid.email);
  res.status(200).end();
});

app.listen(3001);
```

#### 客户端使用

```javascript
// 使用 OAuth Token 获取临时 Gateway Token

async function connectGateway() {
  const accessToken = localStorage.getItem('access_token');

  // 1. 从 OAuth Token 交换 Gateway Token
  const response = await fetch('https://openclaw.example.com/api/token', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const { gatewayToken, deviceToken } = await response.json();

  // 2. 使用获取的 Token 连接 Gateway
  const client = new GatewayClient({
    url: 'wss://openclaw.example.com/ws',
    token: gatewayToken,
    deviceToken,
  });

  await client.connect();
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 标准化认证 | ✗ 架构复杂 |
| ✓ 集中用户管理 | ✗ 需要OAuth提供商 |
| ✓ 可集成 SSO | ✗ 运维成本高 |
| ✓ 细粒度权限控制 | ✗ 延迟较高 |
| ✓ 安全审计 | ✗ 学习曲线陡 |

#### 适用场景

- 大型企业
- 需要SSO集成
- 多系统统一认证
- 需要细粒度权限控制

---

### 方案 4: Tailscale VPN（边缘/内网）

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Tailscale VPN                         │
│               (虚拟私有网络 overlay)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  云端服务器   │  │  本地盒子     │  │  用户设备     │     │
│  │  100.x.x.1   │  │  100.x.x.2   │  │  100.x.x.3   │     │
│  │  Gateway     │  │  Gateway     │  │  客户端       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ✅ 所有节点在同一虚拟网络中                               │
│  ✅ 内置 mTLS 和访问控制                                   │
│  ✅ 无需公网 IP                                            │
└──────────────────────────────────────────────────────────────┘
```

#### 配置

**云端服务器**:
```bash
# 1. 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. 连接到你的 Tailscale 网络
sudo tailscale up --authkey=<your-tailscale-auth-key>

# 3. 记录 Tailscale IP
tailscale ip -4
# 输出: 100.x.y.z
```

**本地盒子**:
```bash
# 1. 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. 连接到同一网络
sudo tailscale up --authkey=<your-tailscale-auth-key>

# 3. 配置 Gateway
openclaw config set gateway.tailscale true
openclaw config set gateway.auth.allowTailscale true

# 4. 启动 Gateway
openclaw gateway run --bind 0.0.0.0 --port 18789
```

**Gateway 配置**:
```yaml
# ~/.openclaw/config.yml

gateway:
  # 启用 Tailscale 认证
  auth:
    allowTailscale: true
    # 或使用 Tailscale 作为唯一认证方式
    mode: tailscale

  # 绑定所有接口（Tailscale 会处理安全）
  bind:
    - 0.0.0.0:18789
```

**客户端使用**:
```javascript
// 用户设备也加入 Tailscale 网络

// 1. 安装 Tailscale 并连接
// https://tailscale.com/download

// 2. 连接到 Gateway（使用 Tailscale IP）
const client = new GatewayClient({
  url: 'ws://100.x.y.z:18789',  // Tailscale IP
  // 无需 Token！Tailscale 提供身份验证
});
```

**ACL 配置**（控制访问）:
```json
// Tailscale ACL policy
{
  "tagOwners": {
    "tag:openclaw-user": ["group:openclaw-users"],
    "tag:openclaw-admin": ["group:openclaw-admins"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["group:openclaw-users"],
      "dst": ["tag:openclaw-gateway"]
    },
    {
      "action": "accept",
      "src": ["group:openclaw-admins"],
      "dst": ["tag:openclaw-gateway:*"],
      "srcPort": ["18789"]
    }
  ]
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 零配置认证 | ✗ 需要安装 Tailscale |
| ✓ 内置 mTLS | ✗ 用户设备需安装客户端 |
| ✓ 自动密钥轮换 | ✗ 依赖 Tailscale 服务 |
| ✓ 细粒度 ACL | ✗ 网络 overlays 有性能损耗 |
| ✓ 支持 NAT 穿透 | ✗ 免费版有节点限制 |
| ✓ 无需公网 IP | - |

#### 适用场景

- 边缘计算/物联网
- 家庭实验室
- 内网环境
- 无公网 IP 场景

---

### 方案 5: mTLS 双向认证（高安全）

#### 架构

```
┌─────────────────────────────────────────────────────────────┐
│                       PKI 基础设施                          │
│  - CA 根证书                                                │
│  - 证书签发服务                                             │
│  - 证书吊销列表 (CRL/OCSP)                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐     ┌───────▼────────┐
        │  Gateway       │     │  客户端        │
        │  服务器证书    │     │  客户端证书    │
        └───────┬────────┘     └───────┬────────┘
                │                         │
                └────────────┬────────────┘
                             │
                    mTLS 连接
                (双向证书验证)
```

#### 配置

**生成证书**:
```bash
# 1. 创建 CA
openssl genrsa -out ca-key.pem 4096
openssl req -new -x509 -days 3650 -key ca-key.pem -out ca-cert.pem

# 2. 签发 Gateway 证书
openssl genrsa -out gateway-key.pem 4096
openssl req -new -key gateway-key.pem -out gateway-csr.pem
openssl x509 -req -days 365 -in gateway-csr.pem \
  -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \
  -out gateway-cert.pem

# 3. 签发客户端证书
openssl genrsa -out client-key.pem 4096
openssl req -new -key client-key.pem -out client-csr.pem
openssl x509 -req -days 365 -in client-csr.pem \
  -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial \
  -out client-cert.pem
```

**Gateway 配置**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  openclaw-gateway:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=mtls
    volumes:
      - ./certs:/certs:ro
      - openclaw-data:/data
    restart: unless-stopped
```

```yaml
# ~/.openclaw/config.yml

gateway:
  auth:
    mode: mtls
  mtls:
      caCert: /certs/ca-cert.pem
      cert: /certs/gateway-cert.pem
      key: /certs/gateway-key.pem
      clientAuth: require
```

**客户端使用**:
```javascript
const fs = require('fs');
const WebSocket = require('ws');

const ws = new WebSocket('wss://openclaw.example.com', {
  cert: fs.readFileSync('./client-cert.pem'),
  key: fs.readFileSync('./client-key.pem'),
  ca: fs.readFileSync('./ca-cert.pem'),
});
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 最高安全性 | ✗ 运维复杂度极高 |
| ✓ 细粒度控制 | ✗ 证书管理成本高 |
| ✓ 标准化协议 | ✗ 证书轮换复杂 |
| ✓ 适合合规场景 | ✗ 学习成本高 |

#### 适用场景

- 金融/医疗等高安全要求
- 需要满足合规要求
- 有专业运维团队

---

## 方案对比总结

### 选择指南

```
开始
  │
  ├─ 快速原型/测试？
  │   └─→ 方案 1: 共享 Token
  │
  ├─ 生产环境/多用户？
  │   └─→ 方案 2: 设备签名认证 ⭐
  │
  ├─ 企业级/SSO？
  │   └─→ 方案 3: OAuth 2.0
  │
  ├─ 边缘/内网/无公网IP？
  │   └─→ 方案 4: Tailscale VPN ⭐
  │
  └─ 高安全/合规要求？
      └─→ 方案 5: mTLS
```

### 推荐组合

**中小型团队（10-100 用户）**:
- 云端: 方案 2（设备签名认证）
- 本地盒子: 方案 4（Tailscale VPN）
- 负载均衡: Nginx + 基于用户 ID 的路由

**大型企业（100+ 用户）**:
- 云端: 方案 3（OAuth 2.0）
- 本地盒子: 方案 4（Tailscale VPN）
- 负载均衡: API Gateway + OAuth

**边缘/物联网**:
- 所有节点: 方案 4（Tailscale VPN）
- 配合: 方案 2（设备签名认证）作为备用

---

## 第三部分：实施清单

### 云端 Docker 部署

- [ ] 配置 Docker Compose
- [ ] 设置环境变量（Token/Redis）
- [ ] 配置负载均衡（Nginx/HAProxy）
- [ ] 设置 SSL 证书（Let's Encrypt）
- [ ] 配置日志收集
- [ ] 设置监控告警

### 本地硬件盒子

- [ ] 安装 OpenClaw CLI
- [ ] 配置认证方式
- [ ] 配置 Tailscale VPN（可选）
- [ ] 设置防火墙规则
- [ ] 配置自动更新
- [ ] 设置远程访问（VPN）

### Web/H5 客户端

- [ ] 实现设备认证逻辑
- [ ] 实现 Token 管理（存储/刷新）
- [ ] 实现重连机制
- [ ] 实现错误处理
- [ ] 实现 UI 指示（连接状态/错误）

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
