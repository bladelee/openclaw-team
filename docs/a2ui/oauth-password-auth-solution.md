# OAuth 2.0 + Password 认证方案（完整实施指南）

## 方案概述

### 核心理念

**使用 OAuth 2.0 管理用户身份，使用动态 Password 实现 Gateway 认证**

```
┌─────────────────────────────────────────────────────────────────┐
│  用户浏览器 / H5                                                 │
│                                                                  │
│  1. OAuth 2.0 登录系统                                           │
│     └─ 获取 access_token（证明"你是谁"）                        │
│                                                                  │
│  2. 访问 OpenClaw 功能                                           │
│     └─ 后端验证 OAuth Token                                     │
│     └─ 为用户分配专属 Gateway 密码                               │
│                                                                  │
│  3. 连接到 Gateway                                               │
│     └─ 使用动态密码认证                                          │
│     └─ 每个用户独立密码                                         │
│     └─ 比共享 Token 安全，比设备配对简单                        │
└─────────────────────────────────────────────────────────────────┘
```

### 方案对比

| 特性 | 共享 Token | 设备配对 + deviceToken | **Password + OAuth** ⭐ |
|------|-----------|----------------------|----------------------|
| **安全性** | ❌ 低 | ✅ 中高 | ✅ 中 |
| **实现复杂度** | ✅ 简单 | ⚠️ 中等 | ✅ 简单 |
| **与 OAuth 结合** | ❌ 困难 | ⚠️ 需适配 | ✅ 天然适合 |
| **用户管理** | ❌ 不支持 | ⚠️ 复杂 | ✅ 简单 |
| **设备管理** | ❌ 无 | ✅ 完整 | ❌ 无（不需要） |
| **密码泄露影响** | ❌ 所有用户 | ✅ 单个设备 | ✅ 单个用户 |
| **实施成本** | 低 | 中 | 低 |
| **维护成本** | 低 | 中 | 低 |
| **用户体验** | ⚠️ 需手动输入 | ⚠️ 需配对流程 | ✅ 自动化 |

---

## 架构设计

### 系统架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                              用户层                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │  Web 浏览器     │  │  H5 移动端     │  │  桌面客户端     │         │
│  │  (React SPA)   │  │  (Vue/React)   │  │  (Electron)    │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                │ OAuth 2.0
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          认证层 (API Gateway)                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  OAuth 2.0 中间件                                              │ │
│  │  - 验证 access_token                                           │ │
│  │  - 提取 user_id, email                                         │ │
│  │  - 验证 token 有效期                                           │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                         │
│  ┌────────────────────────▼───────────────────────────────────────┐ │
│  │  Gateway 凭证服务                                              │ │
│  │  - 为用户分配 Gateway 密码                                     │ │
│  │  - 查询/分配 Gateway 实例                                      │ │
│  │  - 密码轮换和管理                                             │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
    ┌───────▼────────┐           ┌─────────▼────────┐
    │  云端容器池     │           │  本地硬件盒池     │
    │  (Cloud Docker) │           │  (Local Boxes)   │
    │                 │           │                  │
    │ ┌─────────────┐ │           │ ┌──────────────┐ │
    │ │ Gateway #1  │ │           │ │ Gateway A     │ │
    │ │ - User A    │ │           │ │ - User X      │ │
    │ │ - User B    │ │           │ │ (Tailscale)   │ │
    │ │ - User C    │ │           │ └──────────────┘ │
    │ └─────────────┘ │           │ ┌──────────────┐ │
    │ ┌─────────────┐ │           │ │ Gateway B     │ │
    │ │ Gateway #2  │ │           │ │ - User Y      │ │
    │ │ - User D    │ │           │ │ (Tailscale)   │ │
    │ │ - User E    │ │           │ └──────────────┘ │
    │ └─────────────┘ │           │                  │
    └─────────────────┘           └──────────────────┘
```

### 认证流程

```
┌─────────────────────────────────────────────────────────────────┐
│  完整认证流程                                                     │
└─────────────────────────────────────────────────────────────────┘

用户                     API Gateway              Gateway 实例
  │                          │                          │
  │  1. OAuth 登录            │                          │
  ├─────────────────────────>│                          │
  │                          │                          │
  │  2. 返回 access_token    │                          │
  │<─────────────────────────┤                          │
  │                          │                          │
  │  3. 访问 OpenClaw        │                          │
  │     (携带 access_token)  │                          │
  ├─────────────────────────>│                          │
  │                          │                          │
  │                          │  4. 验证 OAuth Token    │
  │                          │  5. 提取 user_id        │
  │                          │                          │
  │                          │  6. 查询用户凭证        │
  │                          ├─────────────────────────>│
  │                          │                          │
  │                          │  7. 返回/生成密码      │
  │                          │<─────────────────────────┤
  │                          │                          │
  │  8. 返回 {gatewayUrl,    │                          │
  │          password}       │                          │
  │<─────────────────────────┤                          │
  │                          │                          │
  │  9. WebSocket 连接       │                          │
  │     (auth.password)      │                          │
  ├────────────────────────────────────────────────────>│
  │                          │                          │
  │                          │                          │
  │  10. 连接成功！           │                          │
  │<─────────────────────────────────────────────────────┤
  │                          │                          │
  │  11. 开始 chat.send 等    │                          │
  ├────────────────────────────────────────────────────>│
```

---

## 数据库设计

### 核心表结构

```sql
-- =====================================================
-- 用户 Gateway 凭证表（核心）
-- =====================================================
CREATE TABLE user_gateway_credentials (
  user_id VARCHAR(255) PRIMARY KEY COMMENT 'OAuth user ID (sub)',
  gateway_password VARCHAR(255) NOT NULL COMMENT '动态生成的密码（64字符hex）',
  gateway_url VARCHAR(512) COMMENT 'Gateway 连接地址',
  instance_type ENUM('cloud', 'local') COMMENT '实例类型',
  instance_id VARCHAR(255) COMMENT '实例ID',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  last_used_at TIMESTAMP COMMENT '最后使用时间',
  password_rotated_at TIMESTAMP COMMENT '密码最后轮换时间',
  INDEX idx_user_id (user_id),
  INDEX idx_instance_id (instance_id),
  INDEX idx_instance_type (instance_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户Gateway凭证';

-- =====================================================
-- 云端 Gateway 实例池
-- =====================================================
CREATE TABLE cloud_gateway_instances (
  instance_id VARCHAR(255) PRIMARY KEY COMMENT '实例ID',
  host VARCHAR(255) NOT NULL COMMENT '主机地址',
  port INT NOT NULL COMMENT '端口',
  max_users INT DEFAULT 10 COMMENT '最大用户数',
  current_users INT DEFAULT 0 COMMENT '当前用户数',
  status ENUM('active', 'maintenance', 'offline') DEFAULT 'active' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_current_users (current_users)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='云端Gateway实例池';

-- =====================================================
-- 本地硬件盒实例表
-- =====================================================
CREATE TABLE local_gateway_instances (
  instance_id VARCHAR(255) PRIMARY KEY COMMENT '实例ID',
  user_id VARCHAR(255) UNIQUE NOT NULL COMMENT '所属用户',
  box_name VARCHAR(255) COMMENT '盒子名称',
  tunnel_endpoint VARCHAR(512) COMMENT 'Tailscale/FRP 隧道端点',
  last_heartbeat TIMESTAMP COMMENT '最后心跳时间',
  online BOOLEAN DEFAULT FALSE COMMENT '在线状态',
  firmware_version VARCHAR(50) COMMENT '固件版本',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_online (online)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='本地硬件盒实例';

-- =====================================================
-- OAuth 用户表（如果还没有）
-- =====================================================
CREATE TABLE oauth_users (
  user_id VARCHAR(255) PRIMARY KEY COMMENT 'OAuth sub',
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  provider VARCHAR(50) COMMENT 'auth0, okta, github',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth用户';
```

---

## 后端实现

### 1. 密码生成工具

```typescript
// src/utils/password.ts

import crypto from 'crypto';

/**
 * 生成安全的随机密码
 * @returns 64字符的hex字符串（32字节随机数）
 */
export function generateSecurePassword(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 验证密码格式
 */
export function isValidPassword(password: string): boolean {
  // 应该是64字符的hex字符串
  return /^[a-f0-9]{64}$/.test(password);
}

/**
 * 密码强度检查（可选）
 */
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string;
} {
  if (!isValidPassword(password)) {
    return { score: 0, feedback: 'Invalid password format' };
  }

  // 64字符hex已经足够安全
  return { score: 100, feedback: 'Strong' };
}
```

### 2. Gateway 凭证服务

```typescript
// src/services/gateway-credentials.ts

import { generateSecurePassword } from '@/utils/password';
import { db } from '@/db';

export interface GatewayCredentials {
  gatewayUrl: string;
  password: string;
  instanceType: 'cloud' | 'local';
  instanceId: string;
}

export interface UserInfo {
  userId: string;
  email: string;
  name: string;
}

/**
 * 为用户分配云端 Gateway 实例
 */
async function assignCloudInstance(userId: string): Promise<GatewayCredentials> {
  // 1. 查找负载最低的云端实例
  const instances = await db.query(`
    SELECT instance_id, host, port, current_users, max_users
    FROM cloud_gateway_instances
    WHERE status = 'active' AND current_users < max_users
    ORDER BY current_users ASC, RAND()
    LIMIT 1
  `);

  if (instances.length === 0) {
    throw new Error('No available cloud Gateway instances');
  }

  const instance = instances[0];

  // 2. 生成用户专属密码
  const password = generateSecurePassword();

  // 3. 构建 Gateway URL
  const gatewayUrl = `ws://${instance.host}:${instance.port}`;

  // 4. 保存凭证到数据库
  await db.query(`
    INSERT INTO user_gateway_credentials
    (user_id, gateway_password, gateway_url, instance_type, instance_id, assigned_at)
    VALUES (?, ?, ?, 'cloud', ?, NOW())
    ON DUPLICATE KEY UPDATE
      gateway_password = VALUES(gateway_password),
      gateway_url = VALUES(gateway_url),
      instance_type = VALUES(instance_type),
      instance_id = VALUES(instance_id),
      updated_at = CURRENT_TIMESTAMP
  `, [userId, password, gatewayUrl, instance.instance_id]);

  // 5. 更新实例负载
  await db.query(`
    UPDATE cloud_gateway_instances
    SET current_users = current_users + 1
    WHERE instance_id = ?
  `, [instance.instance_id]);

  console.log(`[GatewayCredentials] Assigned cloud instance ${instance.instance_id} to user ${userId}`);

  return {
    gatewayUrl,
    password,
    instanceType: 'cloud',
    instanceId: instance.instance_id,
  };
}

/**
 * 为用户分配本地硬件盒实例
 */
async function assignLocalInstance(userId: string): Promise<GatewayCredentials> {
  // 1. 查询用户的本地盒子
  const boxes = await db.query(`
    SELECT instance_id, tunnel_endpoint, box_name, online
    FROM local_gateway_instances
    WHERE user_id = ? AND online = TRUE
    ORDER BY last_heartbeat DESC
  `, [userId]);

  if (boxes.length === 0) {
    throw new Error('No available local Gateway instances for this user');
  }

  const box = boxes[0];

  // 2. 生成用户专属密码
  const password = generateSecurePassword();

  // 3. 构建隧道 URL
  const gatewayUrl = box.tunnel_endpoint; // 例如：ws://ts-box-userx.tail12abc.ts.net:18789

  // 4. 保存凭证到数据库
  await db.query(`
    INSERT INTO user_gateway_credentials
    (user_id, gateway_password, gateway_url, instance_type, instance_id, assigned_at)
    VALUES (?, ?, ?, 'local', ?, NOW())
    ON DUPLICATE KEY UPDATE
      gateway_password = VALUES(gateway_password),
      gateway_url = VALUES(gateway_url),
      instance_type = VALUES(instance_type),
      instance_id = VALUES(instance_id),
      updated_at = CURRENT_TIMESTAMP
  `, [userId, password, gatewayUrl, box.instance_id]);

  console.log(`[GatewayCredentials] Assigned local box ${box.box_name} to user ${userId}`);

  return {
    gatewayUrl,
    password,
    instanceType: 'local',
    instanceId: box.instance_id,
  };
}

/**
 * 获取用户的 Gateway 凭证（核心函数）
 */
export async function getUserGatewayCredentials(
  user: UserInfo
): Promise<GatewayCredentials> {
  const userId = user.userId;

  // 1. 查询用户现有凭证
  const existing = await db.query(`
    SELECT gateway_password, gateway_url, instance_type, instance_id,
           password_rotated_at, assigned_at
    FROM user_gateway_credentials
    WHERE user_id = ?
  `, [userId]);

  // 2. 更新最后使用时间
  await db.query(`
    UPDATE user_gateway_credentials
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [userId]);

  // 3. 如果已有凭证，检查是否需要轮换
  if (existing.length > 0) {
    const credentials = existing[0];

    // 密码轮换策略：每 30 天轮换一次
    const PASSWORD_ROTATION_DAYS = 30;
    const now = new Date();
    const assignedAt = new Date(credentials.assigned_at);
    const daysSinceRotation = credentials.password_rotated_at
      ? Math.floor((now.getTime() - new Date(credentials.password_rotated_at).getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((now.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceRotation >= PASSWORD_ROTATION_DAYS) {
      // 密码过期，轮换
      console.log(`[GatewayCredentials] Password expired for user ${userId}, rotating...`);
      return await rotateUserPassword(user, credentials.instance_type);
    }

    // 检查实例是否仍然可用
    if (credentials.instance_type === 'cloud') {
      const instance = await db.query(`
        SELECT status FROM cloud_gateway_instances
        WHERE instance_id = ? AND status = 'active'
      `, [credentials.instance_id]);

      if (instance.length === 0) {
        // 实例不可用，重新分配
        console.log(`[GatewayCredentials] Cloud instance ${credentials.instance_id} unavailable, reassigning...`);
        return await assignCloudInstance(userId);
      }
    } else if (credentials.instance_type === 'local') {
      const box = await db.query(`
        SELECT online FROM local_gateway_instances
        WHERE instance_id = ? AND online = TRUE
      `, [credentials.instance_id]);

      if (box.length === 0) {
        // 盒子离线，尝试切换到云端
        console.log(`[GatewayCredentials] Local box ${credentials.instance_id} offline, falling back to cloud...`);
        return await assignCloudInstance(userId);
      }
    }

    // 凭证有效，直接返回
    return {
      gatewayUrl: credentials.gateway_url,
      password: credentials.gateway_password,
      instanceType: credentials.instance_type,
      instanceId: credentials.instance_id,
    };
  }

  // 4. 首次使用：默认分配云端实例
  console.log(`[GatewayCredentials] First time for user ${userId}, assigning cloud instance...`);
  return await assignCloudInstance(userId);
}

/**
 * 轮换用户密码
 */
export async function rotateUserPassword(
  user: UserInfo,
  currentInstanceType?: 'cloud' | 'local'
): Promise<GatewayCredentials> {
  const userId = user.userId;

  // 生成新密码
  const newPassword = generateSecurePassword();

  // 查询当前凭证
  const current = await db.query(`
    SELECT gateway_url, instance_type, instance_id
    FROM user_gateway_credentials
    WHERE user_id = ?
  `, [userId]);

  if (current.length === 0) {
    // 没有凭证，分配新的
    return await getUserGatewayCredentials(user);
  }

  const credentials = current[0];
  const instanceType = currentInstanceType || credentials.instance_type;

  // 更新密码
  await db.query(`
    UPDATE user_gateway_credentials
    SET gateway_password = ?,
        password_rotated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [newPassword, userId]);

  console.log(`[GatewayCredentials] Password rotated for user ${userId}`);

  return {
    gatewayUrl: credentials.gateway_url,
    password: newPassword,
    instanceType: instanceType,
    instanceId: credentials.instance_id,
  };
}

/**
 * 用户手动切换到本地盒子
 */
export async function switchToLocalBox(user: UserInfo): Promise<GatewayCredentials> {
  const userId = user.userId;

  // 检查用户是否有本地盒子
  const boxes = await db.query(`
    SELECT instance_id FROM local_gateway_instances
    WHERE user_id = ? AND online = TRUE
  `, [userId]);

  if (boxes.length === 0) {
    throw new Error('No available local box for this user');
  }

  // 分配本地盒子（会自动切换）
  return await assignLocalInstance(userId);
}

/**
 * 用户手动切换到云端
 */
export async function switchToCloud(user: UserInfo): Promise<GatewayCredentials> {
  const userId = user.userId;

  // 分配云端实例（会自动切换）
  return await assignCloudInstance(userId);
}
```

### 3. API 路由

```typescript
// src/routes/openclaw.ts

import express from 'express';
import { verifyOAuthToken } from '@/auth/oauth-validator';
import {
  getUserGatewayCredentials,
  rotateUserPassword,
  switchToLocalBox,
  switchToCloud,
} from '@/services/gateway-credentials';

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
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid OAuth token' });
    }

    // 2. 获取 Gateway 凭证
    const credentials = await getUserGatewayCredentials(user);

    // 3. 返回凭证（不包含敏感信息到日志）
    console.log(`[API] Returning credentials for user ${user.userId}, instance ${credentials.instanceId}`);

    res.json(credentials);
  } catch (error) {
    console.error('[API] Failed to get credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to get Gateway credentials' });
  }
});

/**
 * POST /api/openclaw/credentials/reset
 * 手动轮换密码
 */
router.post('/credentials/reset', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid OAuth token' });
    }

    // 轮换密码
    const credentials = await rotateUserPassword(user);

    res.json({
      success: true,
      message: 'Password rotated successfully',
      instanceType: credentials.instanceType,
      instanceId: credentials.instanceId,
    });
  } catch (error) {
    console.error('[API] Failed to rotate password:', error);
    res.status(500).json({ error: error.message || 'Failed to rotate password' });
  }
});

/**
 * POST /api/openclaw/switch/cloud
 * 切换到云端实例
 */
router.post('/switch/cloud', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid OAuth token' });
    }

    const credentials = await switchToCloud(user);

    res.json({
      success: true,
      message: 'Switched to cloud instance',
      instanceType: credentials.instanceType,
      instanceId: credentials.instanceId,
    });
  } catch (error) {
    console.error('[API] Failed to switch to cloud:', error);
    res.status(500).json({ error: error.message || 'Failed to switch to cloud' });
  }
});

/**
 * POST /api/openclaw/switch/local
 * 切换到本地盒子
 */
router.post('/switch/local', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid OAuth token' });
    }

    const credentials = await switchToLocalBox(user);

    res.json({
      success: true,
      message: 'Switched to local box',
      instanceType: credentials.instanceType,
      instanceId: credentials.instanceId,
    });
  } catch (error) {
    console.error('[API] Failed to switch to local:', error);
    res.status(500).json({ error: error.message || 'Failed to switch to local box' });
  }
});

/**
 * GET /api/openclaw/instance/info
 * 获取当前实例信息
 */
router.get('/instance/info', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthToken = authHeader.substring(7);
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid OAuth token' });
    }

    // 查询用户当前实例信息
    const credentials = await db.query(`
      SELECT instance_type, instance_id, gateway_url, assigned_at, last_used_at
      FROM user_gateway_credentials
      WHERE user_id = ?
    `, [user.userId]);

    if (credentials.length === 0) {
      return res.json({
        hasInstance: false,
      });
    }

    const cred = credentials[0];

    let instanceDetails = null;

    if (cred.instance_type === 'cloud') {
      const instance = await db.query(`
        SELECT host, port, current_users, max_users, status
        FROM cloud_gateway_instances
        WHERE instance_id = ?
      `, [cred.instance_id]);

      if (instance.length > 0) {
        instanceDetails = {
          type: 'cloud',
          host: instance[0].host,
          port: instance[0].port,
          load: {
            current: instance[0].current_users,
            max: instance[0].max_users,
          },
          status: instance[0].status,
        };
      }
    } else if (cred.instance_type === 'local') {
      const box = await db.query(`
        SELECT box_name, online, firmware_version, last_heartbeat
        FROM local_gateway_instances
        WHERE instance_id = ?
      `, [cred.instance_id]);

      if (box.length > 0) {
        instanceDetails = {
          type: 'local',
          boxName: box[0].box_name,
          online: box[0].online,
          firmwareVersion: box[0].firmware_version,
          lastHeartbeat: box[0].last_heartbeat,
        };
      }
    }

    res.json({
      hasInstance: true,
      instanceType: cred.instance_type,
      instanceId: cred.instance_id,
      gatewayUrl: cred.gateway_url,
      assignedAt: cred.assigned_at,
      lastUsedAt: cred.last_used_at,
      details: instanceDetails,
    });
  } catch (error) {
    console.error('[API] Failed to get instance info:', error);
    res.status(500).json({ error: error.message || 'Failed to get instance info' });
  }
});

export default router;
```

---

## 客户端实现

### H5 客户端

```typescript
// src/openclaw/client.ts

import { GatewayBrowserClient } from '@/services/gateway';
import { oauthClient } from '@/auth/oauth';

export class OpenClawClient {
  private client: GatewayBrowserClient | null = null;
  private userId: string | null = null;
  private sessionKey: string | null = null;
  private credentials: {
    gatewayUrl: string;
    password: string;
  } | null = null;

  /**
   * 连接到 OpenClaw Gateway
   */
  async connect(): Promise<void> {
    try {
      // 步骤 1: 获取 OAuth Token
      const oauthToken = await oauthClient.getAccessToken();
      this.userId = this.parseUserIdFromToken(oauthToken);

      console.log(`[OpenClaw] Connecting for user ${this.userId}...`);

      // 步骤 2: 获取 Gateway 凭证
      const response = await fetch('/api/openclaw/credentials', {
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get Gateway credentials');
      }

      const credentials = await response.json();
      this.credentials = {
        gatewayUrl: credentials.gatewayUrl,
        password: credentials.password,
      };

      console.log(`[OpenClaw] Connecting to Gateway: ${credentials.gatewayUrl}`);

      // 步骤 3: 使用密码连接到 Gateway
      this.client = new GatewayBrowserClient({
        url: credentials.gatewayUrl,
        password: credentials.password,  // 使用 password 认证！
      });

      await this.client.connect();

      // 步骤 4: 生成会话 Key
      this.sessionKey = `user:${this.userId}`;

      console.log(`[OpenClaw] Connected successfully as user ${this.userId}`);
    } catch (error) {
      console.error('[OpenClaw] Connection failed:', error);
      throw error;
    }
  }

  /**
   * 发送聊天消息
   */
  async sendChatMessage(message: string) {
    if (!this.client || !this.sessionKey) {
      throw new Error('Not connected');
    }

    return await this.client.request('chat.send', {
      sessionKey: this.sessionKey,
      message,
    });
  }

  /**
   * 获取聊天历史
   */
  async getChatHistory() {
    if (!this.client || !this.sessionKey) {
      throw new Error('Not connected');
    }

    return await this.client.request('chat.history', {
      sessionKey: this.sessionKey,
      limit: 200,
    });
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.credentials = null;
    }
  }

  /**
   * 重置密码
   */
  async resetPassword() {
    const oauthToken = await oauthClient.getAccessToken();

    const response = await fetch('/api/openclaw/credentials/reset', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to reset password');
    }

    // 断开现有连接
    await this.disconnect();

    // 重新连接
    return await this.connect();
  }

  /**
   * 切换到云端
   */
  async switchToCloud() {
    const oauthToken = await oauthClient.getAccessToken();

    const response = await fetch('/api/openclaw/switch/cloud', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to switch to cloud');
    }

    // 断开现有连接
    await this.disconnect();

    // 重新连接
    return await this.connect();
  }

  /**
   * 切换到本地盒子
   */
  async switchToLocal() {
    const oauthToken = await oauthClient.getAccessToken();

    const response = await fetch('/api/openclaw/switch/local', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to switch to local box');
    }

    // 断开现有连接
    await this.disconnect();

    // 重新连接
    return await this.connect();
  }

  /**
   * 获取实例信息
   */
  async getInstanceInfo() {
    const oauthToken = await oauthClient.getAccessToken();

    const response = await fetch('/api/openclaw/instance/info', {
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get instance info');
    }

    return await response.json();
  }

  /**
   * 从 OAuth Token 解析用户 ID
   */
  private parseUserIdFromToken(token: string): string {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub;
  }
}

export const openclawClient = new OpenClawClient();
```

### Gateway Service 修改

```typescript
// src/canvas-host/app-h5/services/gateway/GatewayService.ts 修改

// 在 H5 客户端中使用 password 模式

const gateway = new GatewayService({
  url: userGatewayUrl,      // 动态获取
  password: userPassword,   // 动态获取，而不是固定 token
  role: 'operator',
});

// 注意：不需要设置 token！
```

---

## 云端容器 vs 本地盒子：业务流程对比

### 对比表

| 方面 | 云端容器版本 | 本地盒子版本 |
|------|-------------|-------------|
| **实例分配** | 从实例池自动分配 | 绑定到用户专属盒子 |
| **连接地址** | 云端公网 IP:Port | Tailscale 隧道端点 |
| **多用户共享** | ✅ 多用户共享一个实例 | ❌ 单用户专属 |
| **数据存储** | 云端容器卷 | 本地盒子存储 |
| **网络延迟** | 取决于用户到云端距离 | 本地访问，低延迟 |
| **离线可用** | ❌ 需要网络 | ✅ 本地运行 |
| **隐私性** | 数据在云端 | 数据在本地 |
| **切换灵活性** | ✅ 可随时切换实例 | ⚠️ 需盒子在线 |
| **成本** | 按需付费 | 硬件成本 |
| **维护** | 运维团队维护 | 用户自维护 |

### 详细业务流程

#### 场景 1：新用户首次使用（云端容器）

```
┌─────────────────────────────────────────────────────────────────┐
│  新用户 Alice 首次使用 OpenClaw                                │
└─────────────────────────────────────────────────────────────────┘

1. Alice 在系统注册账号（OAuth 提供商）
   └─ Auth0/Okta/GitHub 创建用户

2. Alice 首次登录系统
   ├─ OAuth 2.0 认证
   └─ 获取 access_token

3. Alice 点击"OpenClaw Chat"功能
   └─ 客户端请求 Gateway 凭证

4. 后端处理（首次）：
   ├─ 验证 OAuth Token
   ├─ 提取 user_id: "user_alice_123"
   ├─ 查询数据库：无凭证记录
   ├─ 从云端实例池选择负载最低的实例
   │   └─ 例如：Gateway Instance #2 (host: 10.0.1.12, port: 18789)
   ├─ 生成随机密码："a1b2c3d4e5f6...64chars"
   ├─ 保存到数据库
   │   user_id: "user_alice_123"
   │   gateway_password: "a1b2c3d4..."
   │   gateway_url: "ws://10.0.1.12:18789"
   │   instance_type: "cloud"
   │   instance_id: "cloud-gateway-2"
   └─ 返回凭证给客户端

5. 客户端连接到 Gateway
   ├─ WebSocket 连接到 ws://10.0.1.12:18789
   ├─ 发送 connect 请求
   │   {
   │     "method": "connect",
   │     "params": {
   │       "auth": {
   │         "password": "a1b2c3d4..."
   │       },
   │       "client": { "id": "webchat-ui", ... },
   │       "role": "operator"
   │     }
   │   }
   └─ Gateway 验证密码 → 连接成功

6. Alice 开始使用 OpenClaw
   ├─ 发送消息：chat.send
   ├─ 获取历史：chat.history
   └─ 所有消息使用 sessionKey: "user:user_alice_123"

7. 数据隔离：
   └─ Alice 的消息完全独立，其他用户无法访问
```

#### 场景 2：新用户首次使用（本地盒子）

```
┌─────────────────────────────────────────────────────────────────┐
│  新用户 Bob 首次使用本地盒子 OpenClaw                          │
└─────────────────────────────────────────────────────────────────┘

阶段 1：盒子注册（一次性）

1. Bob 收到预装 OpenClaw 的硬件盒子
   └─ 盒子已安装 OpenClaw CLI

2. Bob 启动盒子并注册
   ├─ 盒子生成设备身份（Ed25519 密钥对）
   ├─ 盒子加入 Tailscale 网络
   │   └─ 获得 Tailscale IP: ts-box-bob.tail12abc.ts.net
   ├─ Bob 在系统网页上输入盒子序列号
   ├─ 系统生成 instance_id: "local-box-bob-001"
   └─ 保存到数据库
       local_gateway_instances:
         user_id: "user_bob_456"
         instance_id: "local-box-bob-001"
         tunnel_endpoint: "ws://ts-box-bob.tail12abc.ts.net:18789"
         online: true

阶段 2：Bob 首次使用 OpenClaw

3. Bob 在系统登录（OAuth）
   └─ 获取 access_token

4. Bob 点击"OpenClaw Chat"
   └─ 客户端请求 Gateway 凭证

5. 后端处理（首次）：
   ├─ 验证 OAuth Token
   ├─ 提取 user_id: "user_bob_456"
   ├─ 查询数据库：无凭证记录
   ├─ 检查用户是否有本地盒子
   │   └─ 发现：local-box-bob-001 (online: true)
   ├─ 生成随机密码："x9y8z7w6v5u4...64chars"
   ├─ 保存到数据库
   │   user_id: "user_bob_456"
   │   gateway_password: "x9y8z7w6..."
   │   gateway_url: "ws://ts-box-bob.tail12abc.ts.net:18789"
   │   instance_type: "local"
   │   instance_id: "local-box-bob-001"
   └─ 返回凭证给客户端

6. 客户端通过 Tailscale 隧道连接
   ├─ WebSocket 连接到 ws://ts-box-bob.tail12abc.ts.net:18789
   ├─ 发送 connect 请求（使用密码）
   └─ 盒子 Gateway 验证密码 → 连接成功

7. Bob 开始使用 OpenClaw（在本地盒子运行）
   ├─ 数据存储在盒子本地
   ├─ Agent 在盒子中运行
   └─ 无需互联网也能工作（部分功能）
```

#### 场景 3：云端用户切换到本地盒子

```
┌─────────────────────────────────────────────────────────────────┐
│  云端用户 Charlie 购买了本地盒子，想切换到本地                  │
└─────────────────────────────────────────────────────────────────┘

1. Charlie 之前使用云端实例
   └─ user_gateway_credentials 记录：
       instance_type: "cloud"
       instance_id: "cloud-gateway-1"

2. Charlie 购买本地盒子并注册
   ├─ 盒子注册到系统
   └─ local_gateway_instances 新增记录：
       user_id: "user_charlie_789"
       instance_id: "local-box-charlie-001"

3. Charlie 在系统点击"切换到本地盒子"
   ├─ 调用 API: POST /api/openclaw/switch/local
   └─ 后端处理：
       ├─ 验证 OAuth Token
       ├─ 查询用户的本地盒子（online: true）
       ├─ 生成新密码
       ├─ 更新 user_gateway_credentials
       │   instance_type: "local" ✅ 更新
       │   gateway_url: "ws://ts-box-charlie.tail12abc.ts.net:18789"
       │   gateway_password: "新密码"
       └─ 返回新凭证

4. 客户端自动重连
   ├─ 断开云端连接
   ├─ 使用新凭证连接到本地盒子
   └─ ✅ 切换成功！

5. 数据迁移（可选）：
   ├─ 云端历史消息可以导出
   ├─ 导入到本地盒子
   └─ 或者从云端开始，新的消息在本地
```

#### 场景 4：本地盒子离线，自动回退到云端

```
┌─────────────────────────────────────────────────────────────────┐
│  本地盒子用户 David，盒子离线了                                 │
└─────────────────────────────────────────────────────────────────┘

1. David 通常使用本地盒子
   └─ instance_type: "local"

2. 本地盒子断网/关机
   ├─ Tailscale 隧道断开
   └─ 盒子不再发送心跳
       └─ local_gateway_instances.online = false

3. David 尝试连接 OpenClaw
   ├─ 调用 API: GET /api/openclaw/credentials
   └─ 后端处理：
       ├─ 验证 OAuth Token
       ├─ 查询当前凭证（instance_type: "local"）
       ├─ 检查盒子状态（online: false）
       ├─ 自动回退：分配云端实例
       │   ├─ 生成新密码
       │   ├─ 选择负载最低的云端实例
       │   └─ 更新 user_gateway_credentials
       │       instance_type: "cloud" ✅ 自动切换
       └─ 返回云端凭证

4. 客户端连接到云端
   └─ ✅ 临时使用云端，服务不中断

5. 盒子恢复上线
   ├─ Tailscale 隧道恢复
   ├─ 盒子发送心跳
   └─ online: true

6. David 可以选择切换回本地
   └─ 调用 API: POST /api/openclaw/switch/local
```

---

## 部署配置

### 云端 Gateway 容器配置

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=openclaw
      - POSTGRES_USER=openclaw
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  # API Gateway + OAuth 中间件
  api-gateway:
    image: your-registry/openclaw-api-gateway:latest
    ports:
      - "3000:3000"
      - "443:443"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://openclaw:${POSTGRES_PASSWORD}@postgres:5432/openclaw
      - OAUTH_DOMAIN=${OAUTH_DOMAIN}
      - OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID}
      - OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}
      - SSL_CERT_PATH=/certs/fullchain.pem
      - SSL_KEY_PATH=/certs/privkey.pem
    volumes:
      - ./certs:/certs:ro
    depends_on:
      - postgres
    restart: unless-stopped

  # 云端 Gateway 实例 #1
  openclaw-gateway-1:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
      # 不设置固定密码，由动态分配
    volumes:
      - openclaw-gateway-1-data:/data
    restart: unless-stopped

  # 云端 Gateway 实例 #2
  openclaw-gateway-2:
    image: openclaw/gateway:latest
    ports:
      - "18790:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
    volumes:
      - openclaw-gateway-2-data:/data
    restart: unless-stopped

  # 云端 Gateway 实例 #3
  openclaw-gateway-3:
    image: openclaw/gateway:latest
    ports:
      - "18791:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=password
    volumes:
      - openclaw-gateway-3-data:/data
    restart: unless-stopped

volumes:
  postgres-data:
  openclaw-gateway-1-data:
  openclaw-gateway-2-data:
  openclaw-gateway-3-data:
```

**初始化数据库**：

```bash
# 连接到 PostgreSQL
docker exec -it openclaw-postgres-1 psql -U openclaw openclaw

# 执行初始化脚本
\i /docker-entrypoint-initdb.d/01-init-schema.sql

# 插入云端实例数据
INSERT INTO cloud_gateway_instances (instance_id, host, port, max_users, current_users, status)
VALUES
  ('cloud-gateway-1', 'openclaw-gateway-1', 18789, 10, 0, 'active'),
  ('cloud-gateway-2', 'openclaw-gateway-2', 18790, 10, 0, 'active'),
  ('cloud-gateway-3', 'openclaw-gateway-3', 18791, 10, 0, 'active');
```

### 本地盒子配置

**1. 盒子安装 OpenClaw**：

```bash
# 在盒子中安装 OpenClaw CLI
curl -sSL https://openclaw.ai/install.sh | bash

# 配置 Gateway
openclaw config set gateway.auth.mode password

# 启动 Gateway（通过 Tailscale）
openclaw gateway run --bind 0.0.0.0 --port 18789
```

**2. Tailscale 配置**：

```bash
# 在盒子中安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 连接到 Tailscale 网络
sudo tailscale up --authkey=${TAILSCALE_AUTH_KEY}

# 记录 Tailscale 名称
tailscale status
# 输出：ts-box-charlie-001.tail12abc.ts.net
```

**3. 盒子注册脚本**：

```bash
#!/bin/bash
# scripts/register-local-box.sh

BOX_SERIAL="$1"
BOX_NAME="$2"

echo "Registering local box..."
echo "Serial: $BOX_SERIAL"
echo "Name: $BOX_NAME"

# 获取盒子信息
BOX_HOSTNAME=$(hostname)
TAILSCALE_NAME=$(tailscale status --json | jq -r '.Self.TailscaleIPs[0]')
BOX_FIRMWARE_VERSION=$(openclaw --version)

# 获取用户 OAuth Token（从标准输入）
read -p "Enter your OAuth access token: " OAUTH_TOKEN

# 调用注册 API
curl -X POST https://your-system.example.com/api/local-box/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OAUTH_TOKEN" \
  -d '{
    "boxSerial": "'$BOX_SERIAL'",
    "boxName": "'$BOX_NAME'",
    "boxHostname": "'$BOX_HOSTNAME'",
    "tunnelEndpoint": "ws://'$TAILSCALE_NAME':18789",
    "firmwareVersion": "'$BOX_FIRMWARE_VERSION'"
  }'

echo "Box registered successfully!"
```

**4. 盒子心跳服务**（保持在线状态）：

```bash
#!/bin/bash
# scripts/box-heartbeat.sh

API_URL="https://your-system.example.com"
INSTANCE_ID="local-box-charlie-001"

while true; do
  # 发送心跳
  curl -X POST ${API_URL}/api/local-box/heartbeat \
    -H "Content-Type: application/json" \
    -d '{
      "instanceId": "'$INSTANCE_ID'",
      "timestamp": '$(date +%s)'
    }'

  # 每 30 秒发送一次
  sleep 30
done
```

---

## 安全考虑

### 密码管理

| 风险 | 缓解措施 |
|------|---------|
| **密码在传输中被窃取** | ✅ 强制 HTTPS/WSS |
| **密码在数据库泄露** | ✅ 数据库加密存储（可选） |
| **密码长期不变** | ✅ 自动轮换（30 天） |
| **密码在日志泄露** | ✅ 禁止日志记录密码 |
| **重放攻击** | ⚠️ 密码每次使用后可更换（高级） |

### 密码存储选项

**选项 1：明文存储（简单）**

```sql
-- 简单但不推荐用于高安全场景
gateway_password VARCHAR(255) NOT NULL
```

**选项 2：哈希存储（推荐）**

```typescript
// 生成密码时哈希
const password = generateSecurePassword();
const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

// 存储哈希值
await db.query(`
  INSERT INTO user_gateway_credentials (user_id, gateway_password_hash)
  VALUES (?, ?)
`, [userId, passwordHash]);

// 验证时比较哈希
const hash = crypto.createHash('sha256').update(providedPassword).digest('hex');
const match = hash === storedHash;
```

**选项 3：加密存储（高安全）**

```typescript
// 使用 AES-256-GCM 加密
const encryptionKey = process.env.PASSWORD_ENCRYPTION_KEY;
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

let encrypted = cipher.update(password, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();

// 存储 IV + authTag + encrypted
const stored = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
```

### 访问控制

```typescript
// 验证用户只能访问自己的凭证

async function getUserCredentials(userId: string, requestingUserId: string) {
  // 检查用户是否在请求自己的凭证
  if (userId !== requestingUserId) {
    throw new Error('Unauthorized: can only access own credentials');
  }

  // 继续处理...
}
```

---

## 监控和告警

### 关键指标

```typescript
// 监控指标收集

class GatewayMetrics {
  // 活跃用户数
  activeUsers: number = 0;

  // 云端实例利用率
  cloudInstanceUtilization: Map<string, number> = new Map();

  // 本地盒子在线数
  localBoxesOnline: number = 0;

  // 密码轮换统计
  passwordsRotatedToday: number = 0;

  // 连接失败统计
  connectionFailures: number = 0;

  // 收集指标
  async collect() {
    // 从数据库查询
    const activeUsers = await db.query(`
      SELECT COUNT(*) as count
      FROM user_gateway_credentials
      WHERE last_used_at > NOW() - INTERVAL 1 HOUR
    `);

    this.activeUsers = activeUsers[0].count;

    // 云端实例利用率
    const instances = await db.query(`
      SELECT instance_id, current_users, max_users
      FROM cloud_gateway_instances
      WHERE status = 'active'
    `);

    instances.forEach(inst => {
      const utilization = (inst.current_users / inst.max_users) * 100;
      this.cloudInstanceUtilization.set(inst.instance_id, utilization);
    });

    // 本地盒子在线数
    const boxes = await db.query(`
      SELECT COUNT(*) as count
      FROM local_gateway_instances
      WHERE online = TRUE
    `);

    this.localBoxesOnline = boxes[0].count;
  }

  // 检查告警条件
  checkAlerts() {
    // 云端实例过载告警
    for (const [instanceId, utilization] of this.cloudInstanceUtilization) {
      if (utilization > 90) {
        console.warn(`[Alert] Cloud instance ${instanceId} at ${utilization}% capacity`);
        // 发送告警通知...
      }
    }

    // 本地盒子离线告警
    const totalBoxes = await db.query(`
      SELECT COUNT(*) as count FROM local_gateway_instances
    `);

    const offlineRate = 1 - (this.localBoxesOnline / totalBoxes[0].count);

    if (offlineRate > 0.3) {
      console.warn(`[Alert] ${(offlineRate * 100).toFixed(1)}% of local boxes are offline`);
    }
  }
}
```

---

## 故障排查

### 常见问题

**问题 1：连接失败 "Password mismatch"**

```
原因：
1. 密码已轮换，客户端使用了旧密码
2. 数据库中的密码与 Gateway 不一致
3. 客户端缓存了错误密码

解决方案：
1. 重新获取凭证：GET /api/openclaw/credentials
2. 检查数据库中的密码记录
3. 清除客户端缓存
```

**问题 2：无法分配云端实例**

```
原因：
1. 所有云端实例已满载
2. 所有实例状态为 'maintenance' 或 'offline'

解决方案：
1. 检查实例状态：
   SELECT * FROM cloud_gateway_instances WHERE status != 'active'
2. 扩容：添加新的云端实例
3. 调整 max_users 配置
```

**问题 3：本地盒子连接失败**

```
原因：
1. Tailscale 隧道断开
2. 盒子 Gateway 未运行
3. 防火墙阻止连接

解决方案：
1. 检查 Tailscale 连接：tailscale status
2. 检查 Gateway 运行状态：openclaw status
3. 检查防火墙：sudo ufw status
4. 检查盒子心跳：SELECT * FROM local_gateway_instances WHERE user_id = ?
```

---

## 总结

### 方案优势

1. **✅ 实现简单**：比设备配对简单得多
2. **✅ 与 OAuth 天然集成**：用户无感知
3. **✅ 完全隔离**：每用户独立密码和 sessionKey
4. **✅ 灵活切换**：云端 ⇄ 本地盒子
5. **✅ 自动故障转移**：本地离线自动切云端
6. **✅ 易于维护**：无需管理设备配对

### 适用场景

- ✅ 多用户 SaaS 平台
- ✅ 需要 OAuth 2.0 集成的系统
- ✅ 云端 Docker + 本地盒子混合部署
- ✅ 用户完全隔离需求
- ✅ 快速实施需求

### 实施清单

**云端部署**：
- [x] 部署 API Gateway + OAuth 中间件
- [x] 部署 PostgreSQL 数据库
- [x] 部署多个 Gateway 容器实例
- [x] 配置负载均衡
- [x] 配置 SSL 证书
- [x] 设置监控告警

**本地盒子**：
- [x] 预装 OpenClaw CLI
- [x] 配置 Tailscale VPN
- [x] 编写注册脚本
- [x] 配置心跳服务
- [x] 编写用户文档

**客户端**：
- [x] 实现 OAuth 登录
- [x] 实现密码获取逻辑
- [x] 实现自动重连
- [x] 实现云端/本地切换
- [x] 实现错误处理

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
