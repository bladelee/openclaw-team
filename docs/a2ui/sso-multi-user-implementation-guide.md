# OpenClaw 多用户云端 SSO 方案：完整实施指南

## 目录

1. [架构设计](#1-架构设计)
2. [数据库设计](#2-数据库设计)
3. [OpenClow 改造方案](#3-openclow-改造方案)
4. [服务层实现](#4-服务层实现)
5. [部署方案](#5-部署方案)
6. [实施步骤](#6-实施步骤)

---

## 1. 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        用户层                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ Web 浏览器    │  │ H5 移动端     │  │ 桌面客户端   │                      │
│  │ (React SPA)   │  │ (Vue/React)   │  │ (Electron)    │                      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                      │
│       │                │                │                              │
└───────┴────────────────┴────────────────┴──────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SSO/OAuth 2.0 层                           │
│  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │           OAuth 2.0 提供商 (Auth0/Okta/GitHub)            │ │ │
│  │           └─ 验证用户身份 (user_id, email)                 │ │ │
│  └───────────────────────┬───────────────────────────────────────┘ │ │
│                           │                                         │ │
│  ┌───────────────────────▼──────────────────────────────────────┐ │ │
│  │            API Gateway + 中间件层                           │ │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │ │
│  │  │     SSO 认证中间件                                      │ │ │ │
│  │  │     ├─ 验证 OAuth Token                                  │ │ │ │
│  │  │     ├─ 提取 user_id                                     │ │ │ │
│  │  │     └─ 生成动态 Gateway 密码                             │ │ │ │
│  │  └────────────────────────┬───────────────────────────────┘ │ │ │
│  │                          │                                         │ │
│  │  ┌──────────────────────▼───────────────────────────────┐ │ │ │
│  │  │       用户环境管理器                                  │ │ │ │
│  │  │  ├─ 为用户分配独立工作区                             │ │ │ │
│  │  │  ├─ 配置用户专属 API Token（可选）                    │ │ │ │
│  │  │  ├─ 设置用户配额                                       │ │ │ │
│  │  │  └─ 记录 Token 使用                                     │ │ │ │
│  │  └──────────────────────┬───────────────────────────────┘ │ │ │
│  │                          │                                         │ │
│  │  ┌──────────────────────▼───────────────────────────────┐ │ │ │
│  │  │       连接路由器                                        │ │ │ │
│  │  │  └─ 路由到用户专属 Gateway 实例                   │ │ │ │
│  │  │    ├─ 云端：负载均衡                                   │ │ │ │
│  │  │    └─ 本地：Tailscale 隧道                          │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  │                          │                                         │ │
│  │  ┌──────────────────────▼───────────────────────────────┐ │ │ │
│  │  │       计费服务                                        │ │ │ │
│  │  │  ├─ 实时追踪 Token 使用                               │ │ │ │
│  │  │  ├─ 计算用户成本                                       │ │ │ │
│  │  │  └─ 检查配额超限                                       │ │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
└───────────────────────────────────────────────────────────────────────┘
                             │
            ┌────────────────┴──────────────┐
            │                                 │
    ┌───────▼────────┐           ┌──────▼────────┐
    │  云端 Gateway 集群 │           │  本地 Gateway  │
    │  (负载均衡)       │           │  (Tailscale)   │
    │  ┌────────────┐   │           │  ┌────────────┐ │
    │  │Gateway #1   │   │           │  │Gateway A    │ │
    │  │Gateway #2   │   │           │  │Gateway B    │ │
    │  │Gateway #3   │   │           │  └────────────┘ │
    │  └────────────┘   │           │                  │
    │  每个实例：         │           │                  │
    │  ├─ 100-200 并发  │           │  单用户专属      │
    │  ├─ 10-20GB 内存    │           │  5-10GB 内存    │
    │  └─ 独立工作区隔离  │           │  用户数据隔离     │
    └─────────────────────┘           └───────────────────┘
```

### 数据流

#### 1. 用户登录流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. 用户访问系统                                               │
│     ├─ 浏览器打开 https://app.example.com                      │
│     └─ 触发 OAuth 2.0 登录                                        │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. OAuth 2.0 认证                                             │
│     ├─ 重定向到 OAuth 提供商                                      │
│     ├─ 用户登录（Google/GitHub 等）                               │
│     └─ 回调到应用，携带 access_token                              │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. 应用获取用户信息                                             │
│     ├─ 调用 GET /api/user/info                                   │
│     ├─ Header: Authorization: Bearer {access_token}               │
│     └─ 返回 {user_id, email, name, ...}                        │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. 首次访问 OpenClaw，初始化用户环境                            │
│     ├─ 调用 POST /api/openclaw/initialize                      │
│     ├─ 创建用户工作区：/data/openclaw-users/{user_id}/           │
│     ├─ 可选：为用户分配 API Token                                   │
│     ├─ 可选：启用沙盒（Docker）                                  │
│     └─ 返回 {workspaceDir, profile, apiKey}                       │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. OpenClaw 使用流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  5. 用户点击 "Chat" 功能                                         │
│     ├─ 前端调用 GET /api/openclaw/credentials                     │
│     ├─ 返回 Gateway URL 和 Password                                 │
│     └─ 返回用户专属 workspaceDir                                   │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. 前端连接到 Gateway                                         │
│     ├─ WebSocket connect to ws://gateway.example.com              │
│     ├─ 发送 connect 请求：                                      │
│     │   {                                                    │
│     │     "method": "connect",                              │
│     │     "params": {                                       │
│     │       "auth": { "password": "{用户专属密码}" },          │
│     │       "client": { "id": "webchat-ui", ... },             │
│     │       "role": "operator",                               │
│     │       "sessionKey": "user:{user_id}",                    │
│     │       "scopes": ["operator.read", "operator.write"]        │
│     │     }                                                    │
│     │   }                                                    │
│     └─ Gateway 验证密码 → 连接成功                                │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3. Chat 消息发送流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  7. 用户发送消息                                                 │
│     ├─ 前端调用 chat.send                                       │
│     │   {                                                    │
│     │     "sessionKey": "user:user_alice",                        │
│     │     "message": "Hello, how are you?",                   │
│     │     "workspaceDir": "/data/openclaw-users/user_alice"     │
│     │   }                                                    │
│     ├─ API Gateway 不修改消息，直接转发到 Gateway              │
│     └─ Gateway 接收请求                                          │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. Gateway 处理消息（关键改造点）                              │
│     ├─ 提取 workspaceDir：从 params 中获取                       │
│     │   workspaceDir = "/data/openclaw-users/user_alice"            │
│     │                                                              │
│     ├─ 提取 sessionKey：从 params 中获取                          │
│     │   sessionKey = "user:user_alice"                           │
│     │                                                              │
│     ├─ 构建用户专属的 authProfileId：                             │
│     │   authProfileId = "user-user_alice-anthropic"               │
│     │                                                              │
│     ├─ 设置沙盒环境：resolveSandboxContext()                      │
│     │   ├─ 基于 sessionKey 创建隔离的沙盒                         │
│     │   ├─ 沙盒工作区：/data/openclaw-users/user_alice/sandbox-workspace │
│     │   └─ 工具访问隔离                                          │
│     │                                                              │
│     └─ 调用 runEmbeddedPiAgent():                                │
│         ├─ 传入 workspaceDir（用户专属）                              │
│         ├─ 传入 authProfileId（用户专属 Token）                      │
│         └─ 开始 Agent 执行                                         │
└──────────────────────┬─────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│  9. Agent 执行并记录使用                                           │
│     ├─ 调用 LLM API（使用用户 API Token）                          │
│     ├─ 完成后记录 Token 使用                                     │
│     ├─ 更新配额使用                                             │
│     └─ 返回响应给用户                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 数据库设计

### 核心表结构

```sql
-- =====================================================
-- OAuth 用户表
-- =====================================================
CREATE TABLE oauth_users (
  user_id VARCHAR(255) PRIMARY KEY COMMENT 'OAuth sub (唯一用户标识)',
  email VARCHAR(255) UNIQUE NOT NULL COMMENT '用户邮箱',
  name VARCHAR(255) COMMENT '用户姓名',
  provider VARCHAR(50) COMMENT 'OAuth 提供商 (auth0, okta, github)',
  provider_user_id VARCHAR(255) COMMENT 'OAuth 提供商的用户 ID',
  avatar_url VARCHAR(512) COMMENT '用户头像 URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  last_login_at TIMESTAMP COMMENT '最后登录时间',
  INDEX idx_email (email),
  INDEX idx_provider_user_id (provider_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth用户表';

-- =====================================================
-- 用户 OpenClaw 环境表
-- =====================================================
CREATE TABLE user_openclaw_environments (
  user_id VARCHAR(255) PRIMARY KEY COMMENT '用户 ID',
  workspace_dir VARCHAR(512) NOT NULL COMMENT '工作区目录',
  profile_name VARCHAR(255) NOT NULL COMMENT 'Profile 名称',
  auth_profile_id VARCHAR(255) COMMENT 'Auth Profile ID',
  api_key_id VARCHAR(255) COMMENT 'API Key ID (可选)',
  api_key_encrypted TEXT COMMENT '加密的 API Key (可选)',
  has_sandbox BOOLEAN DEFAULT FALSE COMMENT '是否启用沙盒',
  sandbox_enabled BOOLEAN DEFAULT FALSE COMMENT '沙盒是否启用',
  quota_tokens_per_day BIGINT DEFAULT 100000 COMMENT '每日 Token 配额',
  quota_cost_per_month DECIMAL(10, 2) DEFAULT 100.00 COMMENT '每月成本配额（美元）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP COMMENT '最后使用时间',
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_profile_name (profile_name),
  INDEX idx_api_key_id (api_key_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户OpenClaw环境';

-- =====================================================
-- Token 使用记录表（计费核心）
-- =====================================================
CREATE TABLE token_usage_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL COMMENT '用户 ID',
  session_key VARCHAR(255) NOT NULL COMMENT 'Session Key',
  request_id VARCHAR(255) NOT NULL COMMENT '请求 ID（UUID）',
  provider VARCHAR(50) NOT NULL COMMENT '提供商 (anthropic)',
  model VARCHAR(100) NOT NULL COMMENT '模型名称',
  tokens_input INT DEFAULT 0 COMMENT '输入 Token 数',
  tokens_output INT DEFAULT 0 COMMENT '输出 Token 数',
  tokens_total INT DEFAULT 0 COMMENT '总 Token 数',
  cost_usd DECIMAL(10, 6) DEFAULT 0.000000 COMMENT '成本（美元）',
  metadata JSON COMMENT '元数据（错误信息、重试次数等）',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '使用时间',

  INDEX idx_user_id (user_id),
  INDEX idx_session_key (session_key),
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_request_id (request_id),
  INDEX idx_provider_model (provider, model),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Token使用记录';

-- =====================================================
-- 用户配额表
-- =====================================================
CREATE TABLE user_quotas (
  user_id VARCHAR(255) PRIMARY KEY,
  quota_type ENUM('daily_tokens', 'monthly_cost', 'api_calls') NOT NULL COMMENT '配额类型',
  limit_value BIGINT NOT NULL COMMENT '限额',
  current_value BIGINT DEFAULT 0 COMMENT '当前使用量',
  reset_date DATE COMMENT '重置日期',
  last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后检查时间',
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, quota_type),
  INDEX idx_reset_date (reset_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户配额';

-- =====================================================
-- 配额告警表
-- =====================================================
CREATE TABLE quota_alerts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  alert_type ENUM('daily_tokens_80', 'daily_tokens_90', 'daily_tokens_100', 'monthly_cost_80', 'monthly_cost_100') NOT NULL,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by VARCHAR(255) COMMENT '解决人',
  resolution_note TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_acknowledged (acknowledged),
  INDEX idx_resolved_at (resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配额告警';

-- =====================================================
-- 用户环境快照（用于监控）
-- =====================================================
CREATE TABLE user_environment_snapshots (
  snapshot_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  snapshot_type ENUM('workspace_files', 'api_keys', 'quota_status', 'sandbox_status') NOT NULL,
  snapshot_data JSON NOT NULL COMMENT '快照数据',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_type (user_id, snapshot_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户环境快照';
```

### 关键索引说明

```sql
-- 1. Token 使用查询优化
-- 用户今日使用统计
SELECT user_id, SUM(tokens_total), SUM(cost_usd)
FROM token_usage_logs
WHERE user_id = ? AND DATE(timestamp) = CURDATE()
GROUP BY user_id;

-- 2. 实时配额检查
-- 用户当前配额使用情况
SELECT
  user_id,
  current_day_tokens,
  max_tokens_per_day,
  (current_day_tokens / max_tokens_per_day) * 100 as usage_percentage
FROM user_quotas
WHERE quota_type = 'daily_tokens'
  AND user_id = ?;

-- 3. 高频查询优化：复合索引
-- 按用户和时间的复合查询
SELECT user_id, SUM(tokens_total)
FROM token_usage_logs
WHERE user_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY user_id;
```

---

## 3. OpenClow 改造方案

### 改造点 1：chat.send 接收参数扩展

**文件**：`src/gateway/server-methods/chat.ts`

**当前代码**：
```typescript
export async function chatSendHandler(
  context: GatewayRequestContext,
  params: ChatSendParams,
): Promise<ChatSendResult> {
  // ...
}
```

**需要改造**：

```typescript
export interface ChatSendParams {
  sessionId: string;
  sessionKey?: string;
  message: string;
  workspaceDir?: string;  // ← 新增：支持动态工作区
  agentId?: string;
  authProfileId?: string;  // ← 新增：支持用户专属 Auth Profile
  // ... 其他字段
}

export async function chatSendHandler(
  context: GatewayRequestContext,
  params: ChatSendParams,
): Promise<ChatSendResult> {
  const { sessionKey, workspaceDir, authProfileId } = params;

  // 为每个用户注入专属配置
  const userSpecificParams = {
    ...params,
    // 动态工作区（如果未提供）
    workspaceDir: workspaceDir || await resolveUserWorkspaceDir(sessionKey),
    // 动态 Auth Profile（如果未提供）
    authProfileId: authProfileId || await resolveUserAuthProfileId(sessionKey),
  };

  // 调用原有逻辑
  return await chatSendCore(context, userSpecificParams);
}
```

### 改造点 2：用户专属工作区解析

**新增文件**：`src/gateway/server-methods/user-workspace.ts`

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserPath } from "../../../utils.js";

const USER_WORKSPACES_ROOT = "/data/openclaw-users";

/**
 * 解析用户专属工作区目录
 */
export async function resolveUserWorkspaceDir(
  sessionKey: string | undefined
): Promise<string> {
  if (!sessionKey) {
    // 没有 sessionKey，使用默认工作区
    return path.join(process.env.HOME || '.', 'openclaw', 'workspace');
  }

  // 从 sessionKey 提取用户 ID
  // sessionKey 格式: "user:{userId}"
  const userId = extractUserIdFromSessionKey(sessionKey);

  // 构建用户工作区路径
  const userWorkspaceDir = path.join(USER_WORKSPACES_ROOT, userId);

  // 确保工作区存在
  await ensureUserWorkspace(userWorkspaceDir);

  return userWorkspaceDir;
}

/**
 * 从 sessionKey 提取用户 ID
 */
function extractUserIdFromSessionKey(sessionKey: string): string {
  // 支持多种 sessionKey 格式：
  // - "user:user_alice"
  // - "user_alice"
  // - "agent:assistant:user_alice"

  const parts = sessionKey.split(':');
  const lastPart = parts[parts.length - 1];

  if (parts.length === 2 && parts[0] === 'user') {
    // 格式："user:user_alice"
    return lastPart;
  }

  // 其他格式直接使用
  return lastPart;
}

/**
 * 确保用户工作区存在
 */
async function ensureUserWorkspace(workspaceDir: string): Promise<void> {
  try {
    // 检查目录是否存在
    await fs.access(workspaceDir);
  } catch {
    // 目录不存在，创建用户工作区
    await fs.mkdir(workspaceDir, { recursive: true });

    // 创建子目录
    const subdirs = [
      'workspace',     // Agent 工作区
      'sessions',      // Session 文件
      '.openclaw',     // OpenClaw 配置
      'sandbox-workspace', // 沙盒工作区（可选）
    ];

    for (const subdir of subdirs) {
      await fs.mkdir(path.join(workspaceDir, subdir), { recursive: true });
    }

    // 创建基本配置文件
    await createDefaultConfig(workspaceDir);

    console.log(`[UserWorkspace] Created user workspace: ${workspaceDir}`);
  }
}

/**
 * 创建默认配置文件
 */
async function createDefaultConfig(workspaceDir: string): Promise<void> {
  // IDENTITY.md
  await fs.writeFile(
    path.join(workspaceDir, 'workspace', 'IDENTITY.md'),
    `You are a helpful AI assistant.`
  );

  // AGENTS.md
  await fs.writeFile(
    path.join(workspaceDir, 'workspace', 'AGENTS.md'),
    `# Available Agents

## assistant
A helpful AI assistant.

## coder
An expert coding assistant.
`
  );
}
```

### 改造点 3：用户专属 API Token 解析

**新增文件**：`src/gateway/server-methods/user-api-key.ts`

```typescript
import { loadConfig } from "../../../config/config.js";
import { resolveAuthProfileOrder } from "../model-auth.js";

/**
 * 解析用户专属的 Auth Profile ID
 */
export async function resolveUserAuthProfileId(
  sessionKey: string | undefined
): Promise<string | undefined> {
  if (!sessionKey) {
    return undefined;
  }

  const userId = extractUserIdFromSessionKey(sessionKey);
  const profileId = `user-${userId}-anthropic`;

  // 检查用户是否有专属的 API Key
  const hasUserApiKey = await checkUserApiKey(userId);

  if (hasUserApiKey) {
    return profileId;
  }

  return undefined; // 使用默认 Profile
}

/**
 * 从 sessionKey 提取用户 ID
 */
function extractUserIdFromSessionKey(sessionKey: string): string {
  const parts = sessionKey.split(':');
  const lastPart = parts[parts.length - 1];

  if (parts.length === 2 && parts[0] === 'user') {
    return lastPart;
  }

  return lastPart;
}

/**
 * 检查用户是否有专属 API Key
 */
async function checkUserApiKey(userId: string): Promise<boolean> {
  // 查询数据库
  const result = await db.query(`
    SELECT api_key_id
    FROM user_openclaw_environments
    WHERE user_id = ? AND api_key_id IS NOT NULL
  `, [userId]);

  return result.length > 0;
}
```

### 改造点 4：Token 使用记录集成

**文件**：`src/gateway/server-methods/chat.ts` 中的 `chatSendCore` 函数

**需要改造**：

```typescript
import { recordTokenUsage } from "./usage-tracking";

async function chatSendCore(
  context: GatewayRequestContext,
  params: ChatSendParams,
): Promise<ChatSendResult> {
  const { sessionKey, workspaceDir, authProfileId, ...restParams } = params;

  // 创建唯一的请求 ID
  const requestId = crypto.randomUUID();

  // 记录开始时间
  const startTime = Date.now();

  try {
    // 调用 Agent（原有逻辑）
    const result = await runEmbeddedPiAgent({
      ...restParams,
      sessionId: extractSessionId(params.sessionId),
      sessionKey: sessionKey,
      workspaceDir: workspaceDir,
      authProfileId: authProfileId,
      runId: requestId,
      // ... 其他参数
    });

    // Agent 执行成功，记录 Token 使用
    if (result.usage) {
      await recordTokenUsage({
        userId: extractUserIdFromSessionKey(sessionKey),
        sessionKey: sessionKey,
        requestId,
        usage: result.usage,
      });
    }

    return result;
  } catch (error) {
    // 即使失败也记录（可能仍然消耗了 Token）
    const endTime = Date.now();

    if (error instanceof UsageError) {
      // 这是配额超限错误，记录使用情况
      await recordTokenUsage({
        userId: extractUserIdFromSessionKey(sessionKey),
        sessionKey: sessionKey,
        requestId,
        usage: error.usage || {
          provider: 'unknown',
          model: 'unknown',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        error: error.message,
      });

      throw error;
    }

    throw error;
  }
}
```

**新增文件**：`src/gateway/server-methods/usage-tracking.ts`

```typescript
import { db } from "../../../infra/db.js";
import crypto from "node:crypto";

export interface TokenUsageRecord {
  userId: string;
  sessionKey: string;
  requestId: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
  error?: string;
}

/**
 * 记录 Token 使用
 */
export async function recordTokenUsage(params: {
  userId: string;
  sessionKey: string;
  requestId: string;
  usage?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: string;
}): Promise<void> {
  const { userId, sessionKey, requestId, usage, error } = params;

  const provider = usage?.provider || 'unknown';
  const model = usage?.model || 'unknown';
  const tokensInput = usage?.inputTokens || 0;
  const tokensOutput = usage?.outputTokens || 0;
  const tokensTotal = usage?.totalTokens || 0;
  const costUsd = calculateCost(provider, model, tokensInput, tokensOutput);

  // 插入使用记录
  await db.query(`
    INSERT INTO token_usage_logs
    (user_id, session_key, request_id, provider, model, tokens_input, tokens_output, tokens_total, cost_usd, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    sessionKey,
    requestId,
    provider,
    model,
    tokensInput,
    tokensOutput,
    tokensTotal,
    costUsd,
    error ? JSON.stringify({ error }) : null,
  ]);

  console.log(`[UsageTracking] Recorded: user=${userId}, tokens=${tokensTotal}, cost=$${costUsd.toFixed(6)}`);
}

/**
 * 计算 Token 成本
 */
function calculateCost(
  provider: string,
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  // Claude 定价（2025年）
  const pricing = {
    'anthropic': {
      'claude-sonnet-4-5-20250514': {
        input: 3.0 / 1_000_000,  // $3 per million
        output: 15.0 / 1_000_000, // $15 per million
      },
      'claude-3-7-sonnet-20250219': {
        input: 0.6 / 1_000_000,
        output: 3.0 / 1_000_000,
      },
    },
  };

  const providerPricing = pricing[provider] || {};
  const modelPricing = providerPricing[model] || providerPricing['claude-sonnet-4-5-20250514'];

  const inputCost = tokensInput * (modelPricing.input || 0);
  const outputCost = tokensOutput * (modelPricing.output || 0);

  return inputCost + outputCost;
}

/**
 * UsageError 类（配额超限错误）
 */
export class UsageError extends Error {
  constructor(
    public code: 'DAILY_TOKENS_EXCEEDED' | 'MONTHLY_COST_EXCEEDED',
    message: string,
    public usage?: {
      tokensUsed?: number;
      quota?: number;
      costUsed?: number;
      quotaCost?: number;
    }
  ) {
    super(message);
    this.name = 'UsageError';
  }
}
```

### 改造点 5：配额检查中间件

**新增文件**：`src/gateway/middleware/quota-check.ts`

```typescript
import { recordTokenUsage, UsageError } from "../server-methods/usage-tracking";

/**
 * 配额检查装饰器
 */
export function withQuotaCheck(
  handler: (context: GatewayRequestContext, params: any) => Promise<any>
) {
  return async (
    context: GatewayRequestContext,
    params: any
  ): Promise<any> => {
    const { sessionKey } = params;

    // 提取用户 ID
    const userId = extractUserIdFromSessionKey(sessionKey);

    // 检查配额
    await checkQuota(userId);

    // 继续执行
    return await handler(context, params);
  };
}

/**
 * 检查用户配额
 */
async function checkQuota(userId: string): Promise<void> {
  // 检查每日 Token 配额
  await checkDailyTokenQuota(userId);

  // 检查每月成本配额
  await checkMonthlyCostQuota(userId);
}

/**
 * 检查每日 Token 配额
 */
async function checkDailyTokenQuota(userId: string): Promise<void> {
  const result = await db.query(`
    SELECT
      max_tokens_per_day as limit,
      current_value as used
    FROM user_quotas
    WHERE user_id = ? AND quota_type = 'daily_tokens'
  `, [userId]);

  if (result.length === 0) {
    return; // 没有配置配额，跳过检查
  }

  const { limit, used } = result[0];

  if (used >= limit) {
    const quotaError = new UsageError(
      'DAILY_TOKENS_EXCEEDED',
      `Daily token limit exceeded (${used} / ${limit} tokens). Please upgrade your plan or try again tomorrow.`,
      { tokensUsed: used, quota: limit }
    );

    // 记录配额告警
    await recordQuotaAlert(userId, 'daily_tokens_100');

    throw quotaError;
  }
}

/**
 * 检查每月成本配额
 */
async function checkMonthlyCostQuota(userId: string): Promise<void> {
  const result = await db.query(`
    SELECT
      max_cost_per_month as limit,
      current_value as used
    FROM user_quotas
    WHERE user_id = ? AND quota_type = 'monthly_cost'
  `, [userId]);

  if (result.length === 0) {
    return;
  }

  const { limit, used } = result[0];

  if (used >= limit) {
    const quotaError = new UsageError(
      'MONTHLY_COST_EXCEEDED',
      `Monthly cost limit exceeded ($${used.toFixed(2)} / $${limit.toFixed(2)}). Please upgrade your plan.`,
      { costUsed: used, quotaCost: limit }
    );

    // 记录配额告警
    await recordQuotaAlert(userId, 'monthly_cost_100');

    throw quotaError;
  }
}
```

---

## 4. 服务层实现

### 用户环境管理服务

```typescript
// src/services/user-environment.ts

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export class UserEnvironmentManager {
  /**
   * 初始化用户 OpenClaw 环境
   */
  async initializeUserEnvironment(userId: string, options: {
    enableSandbox?: boolean;
    assignApiKey?: boolean;
    quotaTokensPerDay?: number;
    quotaCostPerMonth?: number;
  }): Promise<{
    workspaceDir: string;
    profileName: string;
    authProfileId?: string;
    apiKeyId?: string;
  }> {
    const workspaceDir = path.join('/data/openclaw-users', userId);
    const profileName = `user-${userId}`;

    // 1. 创建工作区
    await this.createUserWorkspace(workspaceDir);

    // 2. 创建 Profile 配置
    await this.createProfileConfig(workspaceDir, profileName);

    // 3. 创建沙盒工作区（可选）
    if (options.enableSandbox) {
      await this.createSandboxWorkspace(workspaceDir);
    }

    // 4. 分配 API Key（可选）
    let authProfileId: string | undefined;
    let apiKeyId: string | undefined;

    if (options.assignApiKey) {
      const apiKeyInfo = await this.assignUserApiKey(userId);
      authProfileId = apiKeyInfo.profileId;
      apiKeyId = apiKeyInfo.keyId;

      // 创建 auth profile
      await this.createUserAuthProfile(
        workspaceDir,
        profileId,
        apiKeyInfo.apiKey,
        apiKeyInfo.provider
      );
    } else {
      // 不分配专属 API Key，使用默认的
      authProfileId = undefined;
    }

    // 5. 设置用户配额
    if (options.quotaTokensPerDay || options.quotaCostPerMonth) {
      await this.setUserQuota(userId, {
        tokensPerDay: options.quotaTokensPerDay,
        costPerMonth: options.quotaCostPerMonth,
      });
    }

    // 6. 保存到数据库
    await this.saveUserEnvironment(userId, {
      workspaceDir,
      profileName,
      authProfileId,
      apiKeyId,
      hasSandbox: options.enableSandbox || false,
      quotaTokensPerDay: options.quotaTokensPerDay,
      quotaCostPerMonth: options.quotaCostPerMonth,
    });

    return {
      workspaceDir,
      profileName,
      authProfileId,
      apiKeyId,
    };
  }

  /**
   * 创建用户工作区
   */
  private async createUserWorkspace(workspaceDir: string): Promise<void> {
    const subdirs = [
      'workspace',
      'sessions',
      '.openclaw',
      'sandbox-workspace',
    ];

    for (const subdir of subdirs) {
      await fs.mkdir(path.join(workspaceDir, subdir), { recursive: true });
    }

    // 创建基本文件
    await fs.writeFile(
      path.join(workspaceDir, 'workspace', 'IDENTITY.md'),
      `You are a helpful AI assistant.`
    );

    await fs.writeFile(
      path.join(workspaceDir, 'workspace', 'AGENTS.md'),
      `# Available Agents

## assistant
A helpful AI assistant.

## coder
An expert coding assistant.
`
    );
  }

  /**
   * 创建 Profile 配置
   */
  private async createProfileConfig(
    workspaceDir: string,
    profileName: string
  ): Promise<void> {
    const openclawDir = path.join(workspaceDir, '.openclaw');

    // 创建 Profile 配置文件
    const profileConfig = {
      agents: {
        defaults: {
          workspaceDir: path.join(workspaceDir, 'workspace'),
          model: 'claude-sonnet-4-5-20250514',
          provider: 'anthropic',
        },
        profiles: {
          [profileName]: {
            provider: 'anthropic',
            workspaceDir: path.join(workspaceDir, 'workspace'),
          },
        },
      },
      sandbox: {
        enabled: false, // 默认不启用沙盒
      },
    };

    const configFile = path.join(openclawDir, 'profiles', `${profileName}.yml`);
    await fs.mkdir(path.dirname(configFile), { recursive: true });
    await fs.writeFile(configFile, YAML.stringify(profileConfig));

    console.log(`[UserEnvironment] Created profile: ${profileName}`);
  }

  /**
   * 创建沙盒工作区
   */
  private async createSandboxWorkspace(workspaceDir: string): Promise<void> {
    const sandboxWorkspace = path.join(workspaceDir, 'sandbox-workspace');
    await fs.mkdir(sandboxWorkspace, { recursive: true });
  }

  /**
   * 分配用户 API Key
   */
  private async assignUserApiKey(userId: string): Promise<{
    profileId: string;
    keyId: string;
    apiKey: string;
    provider: string;
  }> {
    // 为用户生成专属的 API Key（或使用主密钥派生）
    const profileId = `user-${userId}-anthropic`;
    const keyId = `key-${userId}-${crypto.randomUUID().slice(0, 8)}`;
    const provider = 'anthropic';

    // 检查是否已经有 API Key
    const existing = await db.query(`
      SELECT api_key_encrypted
      FROM user_openclaw_environments
      WHERE user_id = ? AND provider = ?
    `, [userId, provider]);

    let apiKey: string;

    if (existing.length > 0 && existing[0].api_key_encrypted) {
      // 解密并返回
      apiKey = decryptApiKey(existing[0].api_key_encrypted);
    } else {
      // 生成新的 API Key（这里简化为使用主密钥）
      apiKey = process.env.ANTHROPIC_API_KEY!;

      // 加密存储
      const encrypted = encryptApiKey(apiKey);

      await db.query(`
        UPDATE user_openclaw_environments
        SET api_key_id = ?, api_key_encrypted = ?
        WHERE user_id = ?
      `, [keyId, encrypted, userId]);
    }

    return {
      profileId,
      keyId,
      apiKey,
      provider,
    };
  }

  /**
   * 创建用户 Auth Profile
   */
  private async createUserAuthProfile(
    workspaceDir: string,
    profileId: string,
    apiKey: string,
    provider: string
  ): Promise<void> {
    const profilesDir = path.join(workspaceDir, '.openclaw', 'profiles');

    await fs.mkdir(profilesDir, { recursive: true });

    const profileFile = path.join(profilesDir, `${profileId}.json`);
    await fs.writeFile(profileFile, JSON.stringify({
      provider,
      apiKey,
      createdAt: Date.now(),
    }, null, 2));
  }

  /**
   * 设置用户配额
   */
  private async setUserQuota(userId: string, quota: {
    tokensPerDay?: number;
    costPerMonth?: number;
  }): Promise<void> {
    if (quota.tokensPerDay) {
      await db.query(`
        INSERT INTO user_quotas (user_id, quota_type, limit_value)
        VALUES (?, 'daily_tokens', ?)
        ON DUPLICATE KEY UPDATE
          limit_value = VALUES(limit_value)
      `, [userId, quota.tokensPerDay]);
    }

    if (quota.costPerMonth) {
      await db.query(`
        INSERT INTO user_quotas (user_id, quota_type, limit_value)
        VALUES (?, 'monthly_cost', ?)
        ON DUPLICATE KEY UPDATE
          limit_value = VALUES(limit_value)
      `, [userId, quota.costPerMonth]);
    }
  }

  /**
   * 保存用户环境信息
   */
  private async saveUserEnvironment(
    userId: string,
    env: {
      workspaceDir: string;
      profileName: string;
      authProfileId?: string;
      apiKeyId?: string;
      hasSandbox: boolean;
      quotaTokensPerDay?: number;
      quotaCostPerMonth?: number;
    }
  ): Promise<void> {
    await db.query(`
      INSERT INTO user_openclaw_environments
      (user_id, workspace_dir, profile_name, auth_profile_id, api_key_id, has_sandbox, quota_tokens_per_day, quota_cost_per_month)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        workspace_dir = VALUES(workspace_dir),
        profile_name = VALUES(profile_name),
        auth_profile_id = VALUES(auth_profile_id),
        api_key_id = VALUES(api_key_id),
        has_sandbox = VALUES(has_sandbox),
        quota_tokens_per_day = VALUES(quota_tokens_per_day),
        quota_cost_per_month = VALUES(quota_cost_per_month)
    `, [
      userId,
      env.workspaceDir,
      env.profileName,
      env.authProfileId || null,
      env.apiKeyId || null,
      env.hasSandbox,
      env.quotaTokensPerDay || null,
      env.quotaCostPerMonth || null,
    ]);
  }

  /**
   * 获取用户工作区
   */
  async getUserWorkspace(userId: string): Promise<{
    workspaceDir: string;
    profileName: string;
  }> {
    const result = await db.query(`
      SELECT workspace_dir, profile_name
      FROM user_openclaw_environments
      WHERE user_id = ?
    `, [userId]);

    if (result.length === 0) {
      throw new Error(`User workspace not found for user ${userId}`);
    }

    return {
      workspaceDir: result[0].workspace_dir,
      profileName: result[0].profile_name,
    };
  }
}
```

---

## 5. 部署方案

### Docker Compose 配置（完整）

```yaml
version: '3.8'

x-environment:
  - &postgres-config
    POSTGRES_DB: openclaw
    POSTGRES_USER: openclaw
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  - &redis-config
    REDIS_HOST: redis
  - &gateway-config
    OPENCLAW_LOG_LEVEL: info
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

services:
  # =====================================================
  # PostgreSQL 数据库
  # =====================================================
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: *postgres-config.POSTGRES_DB
      POSTGRES_USER: *postgres-config.POSTGRES_USER
      POSTGRES_PASSWORD: *postgres-config.POSTGRES_PASSWORD
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  # =====================================================
  # Redis 缓存
  # =====================================================
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # =====================================================
  # API Gateway + OAuth 中间件
  # =====================================================
  api-gateway:
    image: your-registry/openclaw-api-gateway:latest
    ports:
      - "3000:3000"
      - "443:443"
    environment:
      # 数据库连接
      DATABASE_URL: postgres://*postgres-config.POSTGRES_USER:*postgres-config.POSTGRES_PASSWORD@postgres:5432/openclaw
      REDIS_URL: redis://redis:6379

      # OAuth 配置
      OAUTH_DOMAIN: ${OAUTH_DOMAIN}
      OAUTH_CLIENT_ID: ${OAUTH_CLIENT_ID}
      OAUTH_CLIENT_SECRET: ${OAUTH_CLIENT_SECRET}
      OAUTH_AUDIENCE: ${OAUTH_AUDIENCE}

      # SSL 证书
      SSL_CERT_PATH: /certs/fullchain.pem
      SSL_KEY_PATH: /certs/privkey.pem

      # 用户工作区根目录
      USER_WORKSPACES_ROOT: /data/openclaw-users

      # Gateway 实例池
      GATEWAY_INSTANCES: gateway-1:19001,gateway-2:19002,gateway-3:19003

      # 是否启用沙盒（可选）
      SANDBOX_ENABLED: "false"

    volumes:
      - ./certs:/certs:ro
      - /data/openclaw-users:/data/openclaw-users
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # =====================================================
  # Gateway 实例 #1
  # =====================================================
  gateway-1:
    image: openclaw/gateway:latest
    ports:
      - "19001:18789"
    environment:
      <<: *gateway-config
      OPENCLAW_MODE: server
      OPENCLAW_SERVER_ID: gateway-1
    volumes:
      - /data/openclaw-gateway-1:/data
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =====================================================
  # Gateway 实例 #2
  # =====================================================
  gateway-2:
    image: openclaw/gateway:latest
    ports:
      - "19002:18789"
    environment:
      <<: *gateway-config
      OPENCLAW_MODE: server
      OPENCLAW_SERVER_ID: gateway-2
    volumes:
      - /data/openclaw-gateway-2:/data
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =====================================================
  # Gateway 实例 #3
  # =====================================================
  gateway-3:
    image: openclaw/gateway:latest
    ports:
      - "19003:18789"
    environment:
      <<: *gateway-config
      OPENCLAW_MODE: server
      OPENCLAW_SERVER_ID: gateway-3
    volumes:
      - /data/openclaw-gateway-3:/data
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # =====================================================
  # Nginx 负载均衡器
  # =====================================================
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/certs:ro
    depends_on:
      - api-gateway
      - gateway-1
      - gateway-2
      - gateway-3
    restart: unless-stopped

  # =====================================================
  # Prometheus 监控
  # =====================================================
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  # =====================================================
  # Grafana 可视化
  # =====================================================
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-datasources.yml:/etc/grafana/provisioning/datasources.yml:ro
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
```

### Nginx 配置

```nginx
# nginx.conf

upstream openclaw_gateways {
    least_conn;  # 最少连接负载均衡

    # Gateway 实例池
    server gateway-1:19001 max_fails=3 fail_timeout=30s;
    server gateway-2:19002 max_fails=3 fail_timeout=30s;
    server gateway-3:19003 max_fails=3 fail_timeout=30s;
}

# WebSocket 升级配置
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 443 ssl http2;
    server_name openclaw.example.com;

    # SSL 证书
    ssl_certificate /certs/fullchain.pem;
    ssl_certificate_key /certs/privkey.pem;

    # API Gateway
    location /api/ {
        proxy_pass http://api-gateway:3000;
        include proxy_params;
    }

    # WebSocket Gateway
    location /ws {
        proxy_pass http://openclaw_gateways;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # 传递用户信息
        proxy_set_header X-User-Id $http_x_user_id;
        proxy_set_header X-Session-Key $http_x_session_key;

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "OK\n";
    }
}
```

---

## 6. 实施步骤

### 阶段 1：基础设施搭建（1-2 天）

#### 1.1 部署数据库和缓存

```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d postgres redis

# 创建数据库表
docker exec -it openclaw-postgres-1 psql -U openclaw openclaw < sql/schema.sql
```

#### 1.2 配置 OAuth 2.0 提供商

以 Auth0 为例：

1. 在 Auth0 Console 创建应用
2. 配置回调 URL: `https://app.example.com/callback`
3. 配置允许的权限：`openid profile email`
4. 获取：Client ID、Client Secret、Audience

#### 1.3 生成 SSL 证书

```bash
# 使用 Let's Encrypt
sudo certbot certonly --standalone -d openclaw.example.com
```

### 阶段 2：API Gateway 开发（3-5 天）

#### 2.1 初始化项目

```bash
npm create api-gateway
cd api-gateway
npm init -y
npm install express express-jws passport passport-oauth2 axios

# 安装依赖
npm install dotenv
```

#### 2.2 实现核心功能

**文件结构**：

```
api-gateway/
├── src/
│   ├── routes/
│   │   ├── auth.ts                    # OAuth 登录路由
│   │   ├── openclaw.ts               # OpenClaw 凭证环境路由
│   │   ├── quota.ts                   # 配额管理路由
│   │   └── usage.ts                   # 使用统计路由
│   ├── services/
│   │   ├── oauth-validator.ts          # OAuth Token 验证
│   │   ├── user-environment.ts        # 用户环境管理
│   │   ├── usage-tracking.ts         # Token 使用追踪
│   │   └── quota-manager.ts           # 配额管理
│   └── index.ts
```

**核心服务实现**：

```typescript
// src/services/oauth-validator.ts

export async function verifyOAuthToken(token: string): Promise<{
  userId: string;
  email: string;
  name: string;
} | null> {
  try {
    // 解析 JWT（如果是 JWT）
    const decoded = jwt.decode(token);
    const userId = decoded.sub;
    const email = decoded.email;

    // 验证 Token 有效性（可选）
    // ...

    return { userId, email, name: decoded.name || '' };
  } catch {
    return null;
  }
}
```

#### 2.3 实现 OpenClaw 适配层

```typescript
// src/routes/openclaw.ts

import express from 'express';
import { verifyOAuthToken } from '../services/oauth-validator';
import { UserEnvironmentManager } from '../services/user-environment';

const router = express.Router();

/**
 * GET /api/openclaw/credentials
 * 获取用户的 Gateway 连接凭证
 */
router.get('/credentials', async (req, res) => {
  try {
    // 1. 验证 OAuth Token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. 获取或创建用户环境
    const envManager = new UserEnvironmentManager();
    const env = await envManager.getUserEnvironment(user.userId);

    // 3. 查询 Gateway 实例（负载均衡）
    const gatewayUrl = await loadBalancedGatewayUrl();

    // 4. 返回凭证
    res.json({
      gatewayUrl,
      password: env.apiKey,  // 从用户环境获取
      workspaceDir: env.workspaceDir,
      profileName: env.profileName,
      hasSandbox: env.hasSandbox,
    });
  } catch (error) {
    console.error('[API] Failed to get credentials:', error);
    res.status(500).json({ error: error.message || 'Internal error' });
  }
});

/**
 * POST /api/openclaw/initialize
 * 初始化用户环境
 */
router.post('/initialize', async (req, res) => {
  try {
    const user = await verifyOAuthToken(req.headers.authorization);

    const envManager = new UserEnvironmentManager();
    const env = await envManager.initializeUserEnvironment(user.userId, {
      enableSandbox: req.body.enableSandbox,
      assignApiKey: req.body.assignApiKey,
      quotaTokensPerDay: req.body.quotaTokensPerDay,
      quotaCostPerMonth: req.body.quotaCostPerMonth,
    });

    res.json({
      success: true,
      workspaceDir: env.workspaceDir,
      profileName: env.profileName,
      hasSandbox: env.hasSandbox,
      authProfileId: env.authProfileId,
    });
  } catch (error) {
    console.error('[API] Failed to initialize environment:', error);
    res.status(500).json({ error: error.message || 'Initialization failed' });
  }
});
```

### 阶段 3：OpenClow Gateway 改造（1-2 周）

#### 3.1 修改 chat.send 处理

**文件**：`src/gateway/server-methods/chat.ts`

```typescript
// 在 chatSendHandler 中添加用户环境解析

export async function chatSendHandler(
  context: GatewayRequestContext,
  params: ChatSendParams
): Promise<ChatSendResult> {
  // ... 现有代码 ...

  const userId = extractUserIdFromSessionKey(params.sessionKey);

  // 动态解析用户工作区
  const userWorkspaceDir = await resolveUserWorkspaceDir(params.sessionKey);

  // 动态解析用户 Auth Profile
  const userAuthProfileId = await resolveUserAuthProfileId(params.sessionKey);

  // 注入到 Agent 参数
  const agentParams = {
    ...params,
    workspaceDir: userWorkspaceDir,  // ← 关键：用户专属工作区
    authProfileId: userAuthProfileId,    // ← 关键：用户专属 Token
    // ... 其他参数
  };

  // 调用原有逻辑
  const result = await chatSendCore(context, agentParams);

  // 记录 Token 使用
  if (result.usage) {
    await recordTokenUsage(userId, params.sessionKey, result.usage);
  }

  return result;
}
```

#### 3.2 实现使用追踪服务

**文件**：`src/gateway/server-methods/usage-tracking.ts`

```typescript
export async function recordTokenUsage(
  userId: string,
  sessionKey: string,
  usage: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }
): Promise<void> {
  const provider = usage.provider || 'unknown';
  const model = usage.model || 'unknown';
  const cost = calculateCost(provider, model, usage.inputTokens || 0, usage.outputTokens || 0);

  await db.query(`
    INSERT INTO token_usage_logs
    (user_id, session_key, provider, model, tokens_input, tokens_output, tokens_total, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    sessionKey,
    provider,
    model,
    usage.inputTokens || 0,
    usage.outputTokens || 0,
    (usage.inputTokens || 0) + (usage.outputTokens || 0),
    cost,
  ]);
}
```

### 阶段 4：集成测试（3-5 天）

#### 4.1 单元测试

```bash
# 启动测试环境
docker-compose up -d

# 运行测试套件
npm test

# 检查测试覆盖率
npm run test:coverage
```

#### 4.2 集成测试

```typescript
// tests/integration/openclaw-multi-user.test.ts

import { describe, expect, beforeAll } from '@jest/globals';

describe('OpenClaw Multi-User Integration', () => {
  let aliceToken, bobToken: string;

  beforeAll(async () => {
    // 创建测试用户和 Token
    const aliceResult = await createTestUser('user-alice');
    aliceToken = aliceResult.token;

    const bobResult = await createTestUser('user-bob');
    bobToken = bobResult.token;

    // 初始化环境
    await initializeUserEnvironment('user-alice');
    await initializeUserEnvironment('user-bob');
  });

  describe('User Isolation', () => {
    it('should isolate user messages', async () => {
      // Alice 发送消息
      const aliceResponse = await chatSend(aliceToken, 'Hello from Alice');

      // Bob 发送消息
      const bobResponse = await chatSend(bobToken, 'Hello from Bob');

      // Alice 获取历史 - 只能看到自己的消息
      const aliceHistory = await getChatHistory(aliceToken);
      expect(aliceHistory).toContain('Alice');
      expect(aliceHistory).not.toContain('Bob');

      // Bob 获取历史 - 只能看到自己的消息
      const bobHistory = await getChatHistory(bobToken);
      expect(bobHistory).toContain('Bob');
      expect(bobHistory).not.toContain('Alice');
    });

    it('should isolate user workspaces', async () => {
      // Alice 写入文件
      await writeFile(aliceToken, 'test.txt', 'Alice data');

      // Bob 读取文件（应该失败）
      const bobFiles = await listFiles(bobToken);
      expect(bobFiles).not.toContain('test.txt');
    });
  });

  describe('Usage Tracking', () => {
    it('should track token usage per user', async () => {
      // Alice 发送 10 条消息
      for (let i = 0; i < 10; i++) {
        await chatSend(aliceToken, `Message ${i}`);
      }

      // 检查 Alice 的使用统计
      const usage = await getUsageStats('user-alice');
      expect(usage.tokensUsed).toBeGreaterThan(0);
      expect(usage.costIncurred).toBeGreaterThan(0);
    });

    it('should enforce daily quota', async () => {
      // 设置 Alice 的配额：1000 tokens/day
      await setQuota('user-alice', 'daily_tokens', 1000);

      // Alice 发送消息（消耗 1100 tokens）
      await expect(async () => {
        await chatSend(aliceToken, 'A very long message...');
      }).rejects.toThrow('Daily token limit exceeded');
    });
  });

  describe('Sandbox Isolation', () => {
    it('should isolate sandboxes per user', async () => {
      // Alice 在沙盒中执行 Python 代码
      await executeCodeInSandbox(aliceToken, `
print("Alice's Python code")
      with open('/alice/data.txt', 'w') as f:
          f.write("Alice data")
      `);

      // Bob 在沙盒中执行 Python 代码
      await executeCodeInSandbox(bobToken, `
print("Bob's Python code")
      with open('/bob/data.txt', 'w') as f:
          f.write("Bob data")
      `);

      // 验证隔离
      const aliceFiles = await listFiles(aliceToken);
      const bobFiles = await listFiles(bobToken);

      expect(aliceFiles).toContain('data.txt');
      expect(bobFiles).not.toContain('Bob data');
    });
  });
});
```

---

## 附录：完整代码示例

### A. 用户环境初始化 API

```typescript
// src/routes/api/openclaw.ts

import express from 'express';
import { verifyOAuthToken } from './oauth-validator';
import { UserEnvironmentManager } from './user-environment';

const router = express.Router();
const envManager = new UserEnvironmentManager();

/**
 * POST /api/openclaw/initialize
 * 初始化用户环境
 */
router.post('/initialize', async (req, res) => {
  try {
    // 1. 验证 OAuth Token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.userId;

    // 2. 解析初始化选项
    const options = {
      enableSandbox: req.body.enableSandbox === true,
      assignApiKey: req.body.assignApiKey === true,
      quotaTokensPerDay: req.body.quotaTokensPerDay,
      quotaCostPerMonth: req.body.quotaCostPerMonth,
    };

    // 3. 初始化用户环境
    const env = await envManager.initializeUserEnvironment(userId, options);

    // 4. 返回环境信息
    res.json({
      success: true,
      workspaceDir: env.workspaceDir,
      profileName: env.profileName,
      hasSandbox: env.hasSandbox,
      authProfileId: env.authProfileId,
      quotaTokensPerDay: options.quotaTokensPerDay,
      quotaCostPerMonth: options.quotaCostPerMonth,
    });
  } catch (error) {
    console.error('[OpenClaw] Initialize failed:', error);
    res.status(500).json({ error: error.message || 'Initialization failed' });
  }
});

/**
 * GET /api/openclaw/status
 * 获取用户状态
 */
router.get('/status', async (req, res) => {
  try {
    const user = await verifyOAuthToken(req.headers.authorization);

    const env = await envManager.getUserEnvironment(user.userId);

    // 获取当前配额使用情况
    const quota = await getQuotaUsage(user.userId);

    res.json({
      status: 'active',
      workspaceDir: env.workspaceDir,
      profileName: env.profileName,
      hasSandbox: env.hasSandbox,
      quota: quota,
    });
  } catch (error) {
    console.error('[OpenClaw] Get status failed:', error);
    res.status(500).json({ error: error.message || 'Status check failed' });
  }
});

export default router;
```

### B. Gateway 配置覆盖

**客户端发送 chat.send 请求**：

```typescript
// H5 客户端
const response = await client.request('chat.send', {
  sessionKey: 'user:user-alice',
  message: 'Hello!',
  // 注意：可以不传 workspaceDir，由 Gateway 自动解析
});
```

**Gateway 自动注入工作区**：

```typescript
// Gateway 内部实现（简化版）
const chatSendHandler = async (context, params) => {
  const sessionKey = params.sessionKey;

  // 从 sessionKey 解析用户 ID
  const userId = sessionKey.replace(/^user:/, '');

  // 动态生成工作区路径
  const workspaceDir = `/data/openclaw-users/${userId}`;

  // 注入到 Agent 参数
  const agentParams = {
    ...params,
    workspaceDir,
    // 也会注入 sessionKey 和 workspaceDir 到配置
  };

  // 调用 Agent
  return await runAgent(agentParams);
};
```

---

## 总结

### 核心改造点总结

| 改造点 | 文件 | 复杂度 | 必要性 |
|-------|------|--------|--------|
| 1. chat.send 参数扩展 | `src/gateway/server-methods/chat.ts` | ⚠️ 低 | ✅ 必须 |
| 2. 用户工作区解析 | `src/gateway/server-methods/user-workspace.ts` | ⚠️ 低 | ✅ 必须 |
| 3. Token 使用记录 | `src/gateway/server-methods/usage-tracking.ts` | ⚠️ 低 | ✅ 必须 |
| 4. 配额检查中间件 | `src/gateway/middleware/quota-check.ts` | ⚠️ 中 | ✅ 推荐 |
| 5. API Gateway 服务 | 新服务 | ⚠️ 高 | ✅ 推荐 |
| 6. 数据库表 | 新建表 | ⚠️ 低 | ✅ 必须 |

### 实施路线图

```
第1周：基础设施 + 数据库
  ├─ 部署 PostgreSQL + Redis
  ├─ 创建数据库表
  ├─ 配置 OAuth 2.0
  └─ 生成 SSL 证书

第2周：API Gateway 开发
  ├─ 实现 OAuth 验证
  ├─ 实现用户环境管理
  ├─ 实现使用追踪
  └─ 编写单元测试

第3周：OpenClow Gateway 改造
  ├─ 修改 chat.send 处理
  ├─ 添加用户工作区解析
  ├─ 添加 Token 记录
  └─ 集成测试

第4周：集成测试 + 部署
  ├─ 集成测试
  ├─ 性能测试
  ├─ 压力测试
  └─ 生产部署

第5周：监控和优化
  ├─ 配置 Prometheus + Grafana
  ├─ 设置告警规则
  └─ 性能调优
```

### 关键收益

✅ **完全隔离**：每个用户独立工作区、消息历史、沙盒
✅ **精确计费**：每个用户独立的 Token 消耗和成本
✅ **灵活配额**：支持每日 Token 限制、每月成本限制
✅ **可扩展**：支持多用户、多实例水平扩展
✅ **生产就绪**：监控、告警、日志完整

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
