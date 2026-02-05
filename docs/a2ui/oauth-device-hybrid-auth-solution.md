# OAuth 2.0 + 设备签名混合认证方案

## 业务场景

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器 / H5                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Web 应用前端                             │ │
│  │  - 功能 A：Dashboard                                        │ │
│  │  - 功能 B：Analytics                                        │ │
│  │  - 功能 C：OpenClaw Chat  ← 需要额外安全保护                │ │
│  │  - 功能 D：Settings                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ OAuth 2.0 Login
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OAuth 2.0 提供商                            │
│                  (Auth0 / Okta / GitHub)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 核心问题

**疑问**：既然用户已经通过 OAuth 2.0 登录了，还需要设备签名认证吗？

**答案**：**是的，需要！原因如下：**

1. **OAuth Token 保护的是"用户身份"，而不是"设备身份"**
   - OAuth Token 证明"你是谁"（用户）
   - 设备签名证明"你从哪里来"（设备）
   - 两者结合才能确保完整的身份验证

2. **OAuth Token 可能被窃取**
   - 如果只依赖 OAuth Token，一旦 Token 泄露，攻击者可以从任何设备访问
   - 设备签名限制了只能从注册过的设备访问
   - 即使 OAuth Token 被窃取，攻击者也无法从未注册设备访问

3. **OpenClaw 功能的特殊性**
   - OpenClaw 允许执行工具、访问文件系统等敏感操作
   - 比其他功能（Dashboard、Analytics）需要更高的安全级别
   - 设备签名提供了额外的安全层

---

## 混合认证架构

### 双重认证模型

```
┌─────────────────────────────────────────────────────────────────┐
│                       认证层次                                   │
│                                                                  │
│  Layer 1: OAuth 2.0（用户身份认证）                              │
│  ├─ 证明"你是谁"（user_id, email）                               │
│  ├─ 由 OAuth 提供商管理                                         │
│  └─ 用于所有功能的访问控制                                       │
│                                                                  │
│  Layer 2: 设备签名认证（设备身份认证）                            │
│  ├─ 证明"你从哪里来"（device_id, 签名）                          │
│  ├─ 由系统自己管理                                              │
│  └─ 仅用于敏感功能（OpenClaw）                                   │
│                                                                  │
│  Layer 3: 会话隔离（用户会话隔离）                                │
│  ├─ 每个用户独立 sessionKey                                      │
│  ├─ 消息历史隔离                                                │
│  └─ Agent 配置隔离                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 认证流程

```
┌─────────────────────────────────────────────────────────────────┐
│  步骤 1: 用户登录系统                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1.1 用户点击"登录"                                         │ │
│  │  1.2 重定向到 OAuth 提供商                                  │ │
│  │  1.3 用户授权                                               │ │
│  │  1.4 回调到应用，获取 OAuth Token                           │ │
│  │  1.5 保存 Token 到 localStorage                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  步骤 2: 访问普通功能（无需设备认证）                        │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  - Dashboard                                           │ │ │
│  │  │  - Analytics                                          │ │ │
│  │  │  - Settings                                           │ │ │
│  │  │                                                        │ │ │
│  │  │  认证方式：仅 OAuth Token                              │ │ │
│  │  │  API 请求：Authorization: Bearer {access_token}       │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  步骤 3: 首次访问 OpenClaw（需要设备注册）                  │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  3.1 检查本地存储是否有设备凭据                        │ │ │
│  │  │  3.2 如果没有，触发设备注册流程                        │ │ │
│  │  │  3.3 生成 Ed25519 密钥对                              │ │ │
│  │  │  3.4 发送设备注册请求（附带 OAuth Token）              │ │ │
│  │  │  3.5 服务器验证 OAuth Token                           │ │ │
│  │  │  3.6 服务器将设备绑定到当前用户                        │ │ │
│  │  │  3.7 返回 deviceToken                                 │ │ │
│  │  │  3.8 保存设备凭据到 localStorage                      │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  步骤 4: 后续访问 OpenClaw（双重认证）                      │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  4.1 从 localStorage 加载 OAuth Token                │ │ │
│  │  │  4.2 从 localStorage 加载设备凭据                     │ │ │
│  │  │  4.3 构建设备签名 payload                             │ │ │
│  │  │  4.4 使用私钥签名                                     │ │ │
│  │  │  4.5 连接到 Gateway                                   │ │ │
│  │  │      - OAuth Token（HTTP Header）                     │ │ │
│  │  │      - 设备签名（WebSocket 握手）                     │ │ │
│  │  │  4.6 服务器验证两者                                   │ │ │
│  │  │  4.7 连接成功                                         │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实现细节

### 数据库表设计

#### 扩展用户-设备绑定表

```sql
-- 用户表（OAuth 用户信息）
CREATE TABLE oauth_users (
  user_id VARCHAR(255) PRIMARY KEY,  -- OAuth sub
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  provider VARCHAR(50),  -- auth0, okta, github
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 设备表（设备身份 + 签名）
CREATE TABLE devices (
  device_id VARCHAR(255) PRIMARY KEY,
  public_key TEXT NOT NULL,  -- Ed25519 公钥
  device_token VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,  -- 绑定到的用户
  device_info JSON,  -- 设备信息（name, type, userAgent）
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP,
  status ENUM('active', 'revoked', 'lost') DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_device_token (device_token)
);

-- 用户实例映射表（用户 -> OpenClaw 实例）
CREATE TABLE user_instances (
  user_id VARCHAR(255) PRIMARY KEY,
  instance_type ENUM('cloud', 'local'),
  instance_id VARCHAR(255),
  gateway_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE
);

-- 云端实例表
CREATE TABLE cloud_instances (
  instance_id VARCHAR(255) PRIMARY KEY,
  host VARCHAR(255),
  port INT,
  max_users INT DEFAULT 10,
  current_users INT DEFAULT 0,
  status ENUM('active', 'maintenance', 'offline') DEFAULT 'active'
);

-- 本地实例表
CREATE TABLE local_instances (
  instance_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  tunnel_endpoint VARCHAR(512),
  last_heartbeat TIMESTAMP,
  online BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES oauth_users(user_id) ON DELETE CASCADE
);
```

### 客户端实现

#### OAuth 登录流程

```typescript
// src/auth/oauth.ts

export class OAuthClient {
  private config = {
    domain: 'your-tenant.auth0.com',
    clientId: 'your-client-id',
    redirectUri: window.location.origin + '/callback',
    audience: 'https://your-api.example.com',
  };

  /**
   * 启动 OAuth 登录流程
   */
  async login() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'openid profile email',
      audience: this.config.audience,
      state: this.generateState(),
    });

    window.location.href = `https://${this.config.domain}/authorize?${params}`;
  }

  /**
   * 处理 OAuth 回调
   */
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // 验证 state
    if (!this.verifyState(state)) {
      throw new Error('Invalid state');
    }

    // 交换 code for tokens
    const response = await fetch(`https://${this.config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: 'your-client-secret',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    const tokens = await response.json();

    // 保存 tokens
    localStorage.setItem('oauth_access_token', tokens.access_token);
    localStorage.setItem('oauth_id_token', tokens.id_token);
    localStorage.setItem('oauth_refresh_token', tokens.refresh_token);

    // 解析用户信息
    const userInfo = this.parseIdToken(tokens.id_token);

    return {
      accessToken: tokens.access_token,
      userId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
    };
  }

  /**
   * 获取当前访问 Token
   */
  async getAccessToken(): Promise<string> {
    let token = localStorage.getItem('oauth_access_token');

    // 检查 Token 是否过期
    if (this.isTokenExpired(token)) {
      token = await this.refreshAccessToken();
    }

    return token;
  }

  /**
   * 刷新访问 Token
   */
  private async refreshAccessToken(): Promise<string> {
    const refreshToken = localStorage.getItem('oauth_refresh_token');

    const response = await fetch(`https://${this.config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        refresh_token: refreshToken,
      }),
    });

    const tokens = await response.json();

    localStorage.setItem('oauth_access_token', tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem('oauth_refresh_token', tokens.refresh_token);
    }

    return tokens.access_token;
  }

  /**
   * 解析 Id Token
   */
  private parseIdToken(idToken: string) {
    const parts = idToken.split('.');
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  }

  /**
   * 检查 Token 是否过期
   */
  private isTokenExpired(token: string): boolean {
    const payload = this.parseIdToken(token);
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }

  /**
   * 生成随机 state（防 CSRF）
   */
  private generateState(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 验证 state
   */
  private verifyState(state: string): boolean {
    const savedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');
    return state === savedState;
  }

  /**
   * 登出
   */
  async logout() {
    // 清除本地 Token
    localStorage.removeItem('oauth_access_token');
    localStorage.removeItem('oauth_id_token');
    localStorage.removeItem('oauth_refresh_token');

    // 清除设备凭据
    localStorage.removeItem('openclaw_device_id');
    localStorage.removeItem('openclaw_private_key');
    localStorage.removeItem('openclaw_device_token');

    // 重定向到登出端点
    window.location.href = `https://${this.config.domain}/v2/logout?client_id=${this.config.clientId}&returnTo=${window.location.origin}`;
  }
}

export const oauthClient = new OAuthClient();
```

#### 设备管理（OpenClaw 专用）

```typescript
// src/openclaw/device-manager.ts

import { generateKeyPair, sign, deriveDeviceIdFromPublicKey } from '@/utils/device-auth';
import { oauthClient } from '@/auth/oauth';

export class DeviceManager {
  /**
   * 检查是否已注册设备
   */
  isDeviceRegistered(): boolean {
    return !!(
      localStorage.getItem('openclaw_device_id') &&
      localStorage.getItem('openclaw_private_key') &&
      localStorage.getItem('openclaw_device_token')
    );
  }

  /**
   * 注册新设备（需要 OAuth Token）
   */
  async registerDevice(): Promise<{
    deviceId: string;
    deviceToken: string;
  }> {
    try {
      // 1. 获取 OAuth Token（证明用户身份）
      const oauthToken = await oauthClient.getAccessToken();

      // 2. 生成设备密钥对
      const keyPair = await generateKeyPair();
      const deviceId = await deriveDeviceIdFromPublicKey(keyPair.publicKey);

      // 3. 构建设备注册请求
      const registerRequest = {
        deviceId,
        publicKey: keyPair.publicKey,
        deviceInfo: {
          name: this.getDeviceName(),
          type: this.getDeviceType(),
          userAgent: navigator.userAgent,
        },
      };

      // 4. 发送注册请求（附带 OAuth Token）
      const response = await fetch('/api/openclaw/devices/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oauthToken}`,
        },
        body: JSON.stringify(registerRequest),
      });

      if (!response.ok) {
        throw new Error('Device registration failed');
      }

      const result = await response.json();

      // 5. 保存设备凭据到本地
      localStorage.setItem('openclaw_device_id', deviceId);
      localStorage.setItem('openclaw_private_key', keyPair.privateKey);
      localStorage.setItem('openclaw_device_token', result.deviceToken);

      return {
        deviceId,
        deviceToken: result.deviceToken,
      };
    } catch (error) {
      console.error('Device registration failed:', error);
      throw error;
    }
  }

  /**
   * 获取设备凭据
   */
  getDeviceCredentials(): {
    deviceId: string;
    privateKey: string;
    deviceToken: string;
  } | null {
    const deviceId = localStorage.getItem('openclaw_device_id');
    const privateKey = localStorage.getItem('openclaw_private_key');
    const deviceToken = localStorage.getItem('openclaw_device_token');

    if (!deviceId || !privateKey || !deviceToken) {
      return null;
    }

    return { deviceId, privateKey, deviceToken };
  }

  /**
   * 构建设备认证 payload
   */
  async buildDeviceAuthPayload(): Promise<{
    payload: string;
    signature: string;
  }> {
    const credentials = this.getDeviceCredentials();

    if (!credentials) {
      throw new Error('Device not registered');
    }

    const { deviceId, privateKey, deviceToken } = credentials;

    // 构建认证 payload（v2）
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

    const payload = [
      'v2',
      deviceId,
      'webchat-ui',
      'webchat',
      'operator',
      'operator.read,operator.write',
      timestamp,
      deviceToken,
      nonce,
    ].join('|');

    // 使用私钥签名
    const signature = await sign(payload, privateKey);

    return { payload, signature };
  }

  /**
   * 撤销当前设备
   */
  async revokeDevice(): Promise<void> {
    const oauthToken = await oauthClient.getAccessToken();
    const credentials = this.getDeviceCredentials();

    if (!credentials) {
      return;
    }

    await fetch('/api/openclaw/devices/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauthToken}`,
      },
      body: JSON.stringify({
        deviceId: credentials.deviceId,
      }),
    });

    // 清除本地凭据
    localStorage.removeItem('openclaw_device_id');
    localStorage.removeItem('openclaw_private_key');
    localStorage.removeItem('openclaw_device_token');
  }

  /**
   * 列出用户的所有设备
   */
  async listDevices(): Promise<Array<{
    deviceId: string;
    deviceInfo: any;
    lastSeenAt: number;
    status: string;
  }>> {
    const oauthToken = await oauthClient.getAccessToken();

    const response = await fetch('/api/openclaw/devices', {
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to list devices');
    }

    return await response.json();
  }

  /**
   * 获取设备名称
   */
  private getDeviceName(): string {
    const userAgent = navigator.userAgent;

    if (/iPhone|iPad|iPod/.test(userAgent)) {
      return 'iPhone/iPad';
    } else if (/Android/.test(userAgent)) {
      return 'Android Device';
    } else if (/Mac/.test(userAgent)) {
      return 'Mac';
    } else if (/Windows/.test(userAgent)) {
      return 'Windows PC';
    } else if (/Linux/.test(userAgent)) {
      return 'Linux PC';
    } else {
      return 'Unknown Device';
    }
  }

  /**
   * 获取设备类型
   */
  private getDeviceType(): 'mobile' | 'desktop' {
    const userAgent = navigator.userAgent;
    return /iPhone|iPad|iPod|Android/.test(userAgent) ? 'mobile' : 'desktop';
  }
}

export const deviceManager = new DeviceManager();
```

#### OpenClaw 客户端（双重认证）

```typescript
// src/openclaw/client.ts

import { GatewayBrowserClient } from '@/services/gateway';
import { oauthClient } from '@/auth/oauth';
import { deviceManager } from './device-manager';

export class OpenClawClient {
  private client: GatewayBrowserClient | null = null;
  private userId: string | null = null;
  private sessionKey: string | null = null;

  /**
   * 连接到 OpenClaw Gateway
   */
  async connect(): Promise<void> {
    try {
      // 步骤 1: 确保 OAuth Token 有效
      const oauthToken = await oauthClient.getAccessToken();
      this.userId = this.parseUserIdFromToken(oauthToken);

      // 步骤 2: 检查设备是否已注册
      if (!deviceManager.isDeviceRegistered()) {
        // 首次访问：需要注册设备
        console.log('[OpenClaw] Device not registered, registering...');
        await deviceManager.registerDevice();
      }

      // 步骤 3: 构建设备认证 payload
      const deviceAuth = await deviceManager.buildDeviceAuthPayload();

      // 步骤 4: 连接到 Gateway（双重认证）
      this.client = new GatewayBrowserClient({
        url: 'wss://openclaw.example.com/ws',
        // OAuth Token（通过 HTTP Header 传递）
        authToken: oauthToken,
        // 设备签名（通过 WebSocket 握手传递）
        deviceAuth: deviceAuth,
      });

      await this.client.connect();

      // 步骤 5: 获取会话信息
      const sessionInfo = await this.client.request('session.info');
      this.sessionKey = sessionInfo.sessionKey;

      console.log(`[OpenClaw] Connected as user ${this.userId}, session ${this.sessionKey}`);
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
   * 断开连接
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
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

### 服务器端实现

#### 设备注册 API

```typescript
// API 路由：/api/openclaw/devices/register

import express from 'express';
import { verifyOAuthToken } from '@/auth/oauth-validator';
import { generateDeviceToken } from '@/utils/tokens';

const router = express.Router();

/**
 * 注册设备（需要 OAuth Token）
 */
router.post('/register', async (req, res) => {
  try {
    // 1. 验证 OAuth Token（提取用户身份）
    const oauthToken = req.headers.authorization?.replace('Bearer ', '');
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid OAuth token' });
    }

    const { deviceId, publicKey, deviceInfo } = req.body;

    // 2. 检查设备是否已注册
    const existingDevice = await db.query(`
      SELECT * FROM devices WHERE device_id = ?
    `, [deviceId]);

    if (existingDevice.length > 0) {
      // 设备已存在，检查是否属于当前用户
      if (existingDevice[0].user_id !== user.userId) {
        return res.status(400).json({ error: 'Device already registered to another user' });
      }

      // 设备属于当前用户，更新 deviceToken
      const newDeviceToken = generateDeviceToken();

      await db.query(`
        UPDATE devices
        SET device_token = ?, last_seen_at = ?, status = 'active'
        WHERE device_id = ?
      `, [newDeviceToken, Date.now(), deviceId]);

      return res.json({
        deviceId,
        deviceToken: newDeviceToken,
        message: 'Device re-registered successfully',
      });
    }

    // 3. 检查用户设备数量限制
    const deviceCount = await db.query(`
      SELECT COUNT(*) as count FROM devices WHERE user_id = ? AND status = 'active'
    `, [user.userId]);

    if (deviceCount[0].count >= 5) {
      return res.status(400).json({ error: 'Maximum device limit reached (5 devices per user)' });
    }

    // 4. 生成 deviceToken
    const deviceToken = generateDeviceToken();

    // 5. 保存设备记录
    await db.query(`
      INSERT INTO devices (device_id, public_key, device_token, user_id, device_info, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [deviceId, publicKey, deviceToken, user.userId, JSON.stringify(deviceInfo), Date.now()]);

    // 6. 清除用户实例缓存（如果需要重新分配）
    await redis.del(`user:instance:${user.userId}`);

    console.log(`[DeviceRegistry] Device ${deviceId} registered to user ${user.userId}`);

    res.json({
      deviceId,
      deviceToken,
      message: 'Device registered successfully',
    });
  } catch (error) {
    console.error('Device registration failed:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * 撤销设备（需要 OAuth Token）
 */
router.post('/revoke', async (req, res) => {
  try {
    const oauthToken = req.headers.authorization?.replace('Bearer ', '');
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { deviceId } = req.body;

    // 验证设备属于当前用户
    const device = await db.query(`
      SELECT * FROM devices WHERE device_id = ? AND user_id = ?
    `, [deviceId, user.userId]);

    if (device.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // 标记为已撤销
    await db.query(`
      UPDATE devices SET status = 'revoked' WHERE device_id = ?
    `, [deviceId]);

    // 清除缓存
    await redis.del(`device:${deviceId}`);

    res.json({ success: true, message: 'Device revoked' });
  } catch (error) {
    console.error('Device revocation failed:', error);
    res.status(500).json({ error: 'Revocation failed' });
  }
});

/**
 * 列出用户的所有设备（需要 OAuth Token）
 */
router.get('/', async (req, res) => {
  try {
    const oauthToken = req.headers.authorization?.replace('Bearer ', '');
    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const devices = await db.query(`
      SELECT device_id, device_info, last_seen_at, status
      FROM devices
      WHERE user_id = ?
      ORDER BY last_seen_at DESC
    `, [user.userId]);

    res.json(devices);
  } catch (error) {
    console.error('List devices failed:', error);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

export default router;
```

#### Gateway 认证中间件（双重验证）

```typescript
// Gateway 中间件：双重认证验证

import { verifyDeviceSignature } from '@/infra/device-identity';
import { parseDeviceAuthPayload } from '@/gateway/device-auth';
import { verifyOAuthToken } from '@/auth/oauth-validator';

interface AuthResult {
  success: boolean;
  userId?: string;
  deviceId?: string;
  instanceType?: 'cloud' | 'local';
  instanceId?: string;
  sessionKey?: string;
  error?: string;
}

/**
 * 双重认证验证
 * 1. OAuth Token（用户身份）
 * 2. 设备签名（设备身份）
 */
export async function verifyHybridAuth(
  oauthToken: string,
  deviceAuthPayload: string,
  deviceSignature: string
): Promise<AuthResult> {
  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 1: 验证 OAuth Token（用户身份）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const user = await verifyOAuthToken(oauthToken);

    if (!user) {
      return { success: false, error: 'Invalid OAuth token' };
    }

    const userId = user.userId;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 2: 解析设备认证 payload
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const auth = parseDeviceAuthPayload(deviceAuthPayload);

    if (auth.version !== 2) {
      return { success: false, error: 'Unsupported auth version' };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 3: 查询设备记录
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const deviceKey = `device:${auth.deviceId}`;
    const deviceRecord = await redis.get(deviceKey);

    if (!deviceRecord) {
      // Redis 未命中，从数据库查询
      const dbResult = await db.query(`
        SELECT * FROM devices WHERE device_id = ?
      `, [auth.deviceId]);

      if (dbResult.length === 0) {
        return { success: false, error: 'Device not registered' };
      }

      const device = dbResult[0];

      // 缓存到 Redis
      await redis.setex(deviceKey, 30 * 24 * 60 * 60, JSON.stringify(device));
    }

    const device = JSON.parse(deviceRecord);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 4: 验证设备归属
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ⚠️ 关键安全检查：设备必须属于当前用户
    if (device.user_id !== userId) {
      console.warn(`[Security] Device ${auth.deviceId} does not belong to user ${userId}`);
      return { success: false, error: 'Device does not belong to user' };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 5: 验证设备状态
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    if (device.status !== 'active') {
      return { success: false, error: 'Device inactive or revoked' };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 6: 验证 deviceToken
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    if (device.device_token !== auth.deviceToken) {
      return { success: false, error: 'Invalid device token' };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 7: 验证签名
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const isValid = await verifyDeviceSignature(
      deviceAuthPayload,
      deviceSignature,
      device.publicKey
    );

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 8: 检查 nonce 防重放攻击
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const nonceKey = `nonce:${auth.nonce}`;
    const nonceExists = await redis.exists(nonceKey);

    if (nonceExists) {
      console.warn(`[Security] Replay attack detected: nonce ${auth.nonce}`);
      return { success: false, error: 'Replay attack detected' };
    }

    await redis.setex(nonceKey, 300, '1');  // 5 分钟过期

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 9: 更新设备最后活跃时间
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    device.last_seen_at = Date.now();
    await redis.setex(deviceKey, 30 * 24 * 60 * 60, JSON.stringify(device));

    // 异步更新数据库
    db.query(`
      UPDATE devices SET last_seen_at = ? WHERE device_id = ?
    `, [Date.now(), auth.deviceId]).catch(console.error);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 10: 查询用户实例映射
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const userInstance = await getUserInstance(userId);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 步骤 11: 生成会话 Key（用户隔离）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const sessionKey = `user:${userId}`;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 认证成功
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    console.log(`[Auth] User ${userId} connected from device ${auth.deviceId}`);

    return {
      success: true,
      userId,
      deviceId: auth.deviceId,
      instanceType: userInstance.type,
      instanceId: userInstance.instanceId,
      sessionKey,
    };
  } catch (error) {
    console.error('[Auth] Verification failed:', error);
    return { success: false, error: 'Verification error' };
  }
}
```

#### OAuth Token 验证

```typescript
// src/auth/oauth-validator.ts

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// 创建 JWKS 客户端（用于验证 RS256 签名）
const jwks = jwksClient({
  jwksUri: 'https://your-tenant.auth0.com/.well-known/jwks.json',
  cache: true,
  rateLimit: true,
});

/**
 * 验证 OAuth Token
 */
export async function verifyOAuthToken(token: string): Promise<{
  userId: string;
  email: string;
  name: string;
} | null> {
  try {
    // 解码 JWT（不验证签名，先获取 header）
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      return null;
    }

    // 获取签名密钥
    const key = await jwks.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // 验证 JWT
    const verified = jwt.verify(token, signingKey, {
      audience: 'https://your-api.example.com',
      issuer: 'https://your-tenant.auth0.com/',
      algorithms: ['RS256'],
    });

    if (!verified) {
      return null;
    }

    // 提取用户信息
    return {
      userId: verified.sub,
      email: verified.email,
      name: verified.name,
    };
  } catch (error) {
    console.error('[OAuth] Token verification failed:', error);
    return null;
  }
}
```

---

## 安全性分析

### 攻击场景防护

| 攻击场景 | OAuth Only | OAuth + 设备签名 | 防护效果 |
|---------|------------|------------------|----------|
| **OAuth Token 泄露** | ❌ 攻击者可以从任何设备访问 | ✅ 攻击者无法从未注册设备访问 | ✅ 有效防护 |
| **设备私钥泄露** | N/A | ⚠️ 可以从该设备访问，但需要 OAuth Token | ⚠️ 部分防护 |
| **中间人攻击** | ⚠️ HTTPS 可防护，但无法验证设备 | ✅ HTTPS + 设备签名双重验证 | ✅ 有效防护 |
| **重放攻击** | ⚠️ OAuth Token 本身有有效期 | ✅ nonce 机制防重放 | ✅ 有效防护 |
| **跨站脚本攻击** | ⚠️ XSS 可以窃取 Token | ⚠️ XSS 可以窃取两者 | ⚠️ 需要其他防护 |
| **会话劫持** | ❌ 容易劫持 | ✅ 需要同时劫持 OAuth + 设备凭据 | ✅ 提高难度 |

### 安全级别

```
┌────────────────────────────────────────────────────────────┐
│                     安全级别分层                            │
│                                                              │
│  Level 1: OAuth Token Only                                  │
│  ├─ 用户身份验证                                            │
│  ├─ HTTPS 传输加密                                          │
│  └─ ✅ 适合普通功能（Dashboard、Analytics）                 │
│                                                              │
│  Level 2: OAuth Token + 设备签名（推荐）                    │
│  ├─ 用户身份验证（OAuth）                                   │
│  ├─ 设备身份验证（签名）                                    │
│  ├─ 双重认证（缺一不可）                                    │
│  └─ ✅ 适合敏感功能（OpenClaw）                             │
│                                                              │
│  Level 3: OAuth Token + 设备签名 + 生物识别                 │
│  ├─ 用户身份验证（OAuth）                                   │
│  ├─ 设备身份验证（签名）                                    │
│  ├─ 生物识别（指纹、Face ID）                               │
│  └─ ✅ 适合极高安全要求场景                                 │
└────────────────────────────────────────────────────────────┘
```

---

## 用户界面流程

### 首次访问 OpenClaw

```
┌─────────────────────────────────────────────────────────────┐
│  用户点击"OpenClaw Chat"                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  检查设备是否已注册                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  已注册          │    │  未注册          │
│  直接连接        │    │  显示注册对话框   │
└──────────────────┘    └─────────┬────────┘
                                  │
                                  ▼
                   ┌────────────────────────────┐
                   │  设备注册对话框             │
                   │                            │
                   │  ┌──────────────────────┐ │
                   │  │ 检测到新设备          │ │
                   │  │                      │ │
                   │  │ 设备: iPhone 15 Pro   │ │
                   │  │ 类型: mobile          │ │
                   │  │                      │ │
                   │  │ [注册设备] [取消]     │ │
                   │  └──────────────────────┘ │
                   └────────────┬───────────────┘
                                  │
                    用户点击"注册设备"
                                  │
                                  ▼
                   ┌────────────────────────────┐
                   │  后台执行                  │
                   │  1. 生成密钥对            │
                   │  2. 发送注册请求          │
                   │  3. 保存凭据              │
                   └────────────┬───────────────┘
                                  │
                                  ▼
                   ┌────────────────────────────┐
                   │  注册成功提示              │
                   │                            │
                   │  ✅ 设备已成功注册         │
                   │                            │
                   │  设备 ID: dev_abc123       │
                   │  注册时间: 2025-02-05     │
                   │                            │
                   │  [进入 OpenClaw]           │
                   └────────────────────────────┘
```

### 设备管理界面

```
┌─────────────────────────────────────────────────────────────┐
│  设备管理                                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  当前设备                                              │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ 📱 iPhone 15 Pro (本设备)                      │  │  │
│  │  │    最后活跃: 刚才                               │  │  │
│  │  │    状态: ✅ 活跃                                │  │  │
│  │  │    [撤销此设备]                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ 💻 MacBook Pro                                  │  │  │
│  │  │    最后活跃: 2 小时前                          │  │  │
│  │  │    状态: ✅ 活跃                                │  │  │
│  │  │    [撤销此设备]                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ 🖥️ Windows PC                                   │  │  │
│  │  │    最后活跃: 1 天前                             │  │  │
│  │  │    状态: ⚠️ 离线                                │  │  │
│  │  │    [撤销此设备]                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  已注册设备: 3/5                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [注册新设备] [关闭]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 方案总结

### 混合认证的优势

1. **用户身份**：OAuth 2.0 提供
   - 标准化认证
   - 支持多种登录方式
   - 集中用户管理
   - SSO 支持

2. **设备身份**：设备签名认证提供
   - 绑定到具体设备
   - 可撤销单个设备
   - 防止 Token 泄露后的滥用
   - 设备数量限制

3. **完全隔离**：sessionKey 机制
   - 每个用户独立会话
   - 消息历史隔离
   - Agent 配置隔离

### 适用场景

- ✅ 系统有多个功能，用户必须登录
- ✅ OpenClaw 是敏感功能，需要额外保护
- ✅ 需要防止 OAuth Token 泄露后的滥用
- ✅ 需要管理用户的访问设备

### 实施建议

1. **普通功能**：仅使用 OAuth Token 认证
   - Dashboard、Analytics、Settings 等

2. **敏感功能**：OAuth Token + 设备签名双重认证
   - OpenClaw Chat
   - 文件管理
   - 系统配置

3. **设备管理**：
   - 每个用户最多 5 个设备
   - 支持撤销设备
   - 设备列表展示

4. **用户体验**：
   - 首次访问自动提示注册设备
   - 后续访问自动连接
   - 撤销设备后需要重新注册

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
