# OpenClaw 多场景部署认证方案（精炼版）

## 业务场景描述

### 核心需求

```
┌─────────────────────────────────────────────────────────────────┐
│                        公网访问入口                              │
│                  https://openclaw.example.com                   │
│                     (统一 Web/H5 客户端)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ 用户认证 + 路由决策
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐      ┌────────▼────────┐
        │  云端 Docker    │      │  本地硬件盒子     │
        │  OpenClaw 实例 │      │  OpenClaw 实例   │
        │  (多用户共享)   │      │  (单用户专属)     │
        └────────────────┘      └─────────────────┘
                 │                         │
        ┌────────▼────────┐      ┌────────▼────────┐
        │ 用户 A、B、C...  │      │    用户 X        │
        │  云端托管实例    │      │  本地私有实例    │
        └─────────────────┘      └─────────────────┘
```

### 关键特性

1. **统一访问入口**：所有用户通过同一公网地址访问
2. **用户完全隔离**：不同用户之间完全看不到和访问到别人的 OpenClaw
3. **灵活部署**：支持云端 Docker（共享）和本地硬件盒（专属）
4. **透明路由**：用户无需关心后端部署位置

---

## 用户隔离架构

### 隔离层次

```
┌────────────────────────────────────────────────────────────┐
│                     访问层                                  │
│  - SSL/TLS 加密                                            │
│  - 认证中间件（设备签名 / OAuth 2.0）                      │
└────────────────────┬───────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────────┐
│                   路由层                                    │
│  - 用户识别（从认证 Token 中提取 user_id）                  │
│  - 实例查找（查询用户专属 OpenClaw 实例）                  │
│  - 连接代理（建立到目标实例的 WebSocket）                   │
└────────────────────┬───────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │                      │
┌────────▼────────┐    ┌────────▼────────┐
│   云端实例池     │    │   本地实例池     │
│  - 用户 A       │    │  - 用户 X       │
│  - 用户 B       │    │  - 用户 Y       │
│  - 用户 C       │    │  - 用户 Z       │
│  ...            │    │  ...            │
└─────────────────┘    └─────────────────┘
         │                      │
┌────────▼────────┐    ┌────────▼────────┐
│   会话隔离       │    │   会话隔离       │
│  - sessionKey   │    │  - sessionKey   │
│  - 消息历史     │    │  - 消息历史     │
│  - Agent 配置   │    │  - Agent 配置   │
└─────────────────┘    └─────────────────┘
```

### 用户-实例映射

**数据库表设计**:

```sql
-- 用户实例映射表
CREATE TABLE user_instances (
  user_id VARCHAR(255) PRIMARY KEY,
  instance_type ENUM('cloud', 'local'),
  instance_id VARCHAR(255),
  gateway_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instance_type (instance_type),
  INDEX idx_instance_id (instance_id)
);

-- 云端实例表
CREATE TABLE cloud_instances (
  instance_id VARCHAR(255) PRIMARY KEY,
  host VARCHAR(255),
  port INT,
  max_users INT DEFAULT 10,
  current_users INT DEFAULT 0,
  status ENUM('active', 'maintenance', 'offline') DEFAULT 'active',
  INDEX idx_status (status)
);

-- 本地实例表
CREATE TABLE local_instances (
  instance_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  tunnel_endpoint VARCHAR(512),  -- Tailscale/FRP endpoint
  last_heartbeat TIMESTAMP,
  online BOOLEAN DEFAULT FALSE,
  INDEX idx_user_id (user_id),
  INDEX idx_online (online)
);
```

**Redis 缓存**:

```bash
# 用户实例映射缓存（TTL: 1 小时）
user:instance:{user_id} -> {
  "type": "cloud|local",
  "instanceId": "...",
  "gatewayUrl": "ws://...",
  "sessionKey": "user:{user_id}"
}

# 云端实例负载缓存（TTL: 30 秒）
cloud:instance:{instance_id}:load -> {
  "currentUsers": 5,
  "maxUsers": 10
}
```

---

## 方案 2: 设备签名认证（推荐生产）

### 架构设计

```
┌───────────────────────────────────────────────────────────────┐
│                        客户端设备                              │
│  (Web 浏览器 / H5 移动端)                                      │
│                                                                  │
│  1. Ed25519 密钥对生成                                         │
│  2. 设备签名认证 payload 构建                                   │
│  3. WebSocket 连接 + 设备注册                                   │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           │ wss://openclaw.example.com/ws
                           │
┌──────────────────────────▼────────────────────────────────────┐
│                    统一接入层                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Nginx 反向代理                            │   │
│  │  - WebSocket 升级处理                                  │   │
│  │  - SSL/TLS 终止                                       │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │          设备认证中间件 (Node.js)                       │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  1. 解析设备签名 payload                        │    │   │
│  │  │  2. Ed25519 签名验证                           │    │   │
│  │  │  3. 设备注册表查询 (Redis/DB)                   │    │   │
│  │  │  4. 用户-实例映射查找                          │    │   │
│  │  │  5. 会话创建 (sessionKey 生成)                  │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │              连接路由器                                 │   │
│  │  - 查询用户专属实例                                    │   │
│  │  - 建立 WebSocket 隧道                                │   │
│  │  - 转发消息 + 注入 sessionKey                         │   │
│  └────────────────────────┬───────────────────────────────┘   │
└───────────────────────────┼───────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
┌───────────▼────────────┐    ┌────────────▼────────────┐
│    云端 Docker 集群     │    │    本地硬件盒子集群      │
│  ┌──────────────────┐  │    │  ┌──────────────────┐  │
│  │ Gateway Instance │  │    │  │ Gateway Instance │  │
│  │      #1          │  │    │  │  (User X)        │  │
│  │  - User A        │  │    │  │                  │  │
│  │  - User B        │  │    │  └──────────────────┘  │
│  │  - User C        │  │    │  ┌──────────────────┐  │
│  └──────────────────┘  │    │  │ Gateway Instance │  │
│  ┌──────────────────┐  │    │  │  (User Y)        │  │
│  │ Gateway Instance │  │    │  │                  │  │
│  │      #2          │  │    │  └──────────────────┘  │
│  │  - User D        │  │    │  (通过 Tailscale/FRP   │
│  │  - User E        │  │    │   隧道连接)             │
│  └──────────────────┘  │    │                        │
└────────────────────────┘    └─────────────────────────┘
```

### 认证流程详解

#### 阶段 1: 客户端设备注册（首次连接）

```javascript
// 客户端：设备注册流程

import { generateKeyPair, sign } from '@openclaw/device-auth';

// 步骤 1: 生成设备身份
async function registerDevice() {
  // 1.1 生成 Ed25519 密钥对
  const keyPair = await generateKeyPair();

  // 1.2 从公钥派生 deviceId
  const deviceId = await deriveDeviceIdFromPublicKey(keyPair.publicKey);

  // 1.3 构建设备注册请求
  const registerPayload = {
    deviceId,
    publicKey: keyPair.publicKey,
    deviceInfo: {
      name: 'My Mobile Device',
      type: 'mobile',  // 'mobile' | 'desktop' | 'hardware'
      userAgent: navigator.userAgent,
    },
  };

  // 1.4 使用共享 Token（仅用于注册）
  const client = new GatewayBrowserClient({
    url: 'wss://openclaw.example.com/ws',
    token: SHARED_REGISTRATION_TOKEN,  // 一次性注册 Token
  });

  // 1.5 发送设备注册请求
  const response = await client.request('device.register', registerPayload);

  // 1.6 保存设备凭据到本地存储
  localStorage.setItem('openclaw_device_id', deviceId);
  localStorage.setItem('openclaw_private_key', keyPair.privateKey);
  localStorage.setItem('openclaw_device_token', response.deviceToken);

  return {
    deviceId,
    deviceToken: response.deviceToken,
  };
}
```

**设备注册表（Redis/DB）**:

```json
// Redis: device:{deviceId}
{
  "deviceId": "dev_123abc456def",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "deviceToken": "dt_789xyz012abc",
  "userId": "user_alice",  // 绑定到的用户 ID
  "registeredAt": 1736123456789,
  "lastSeenAt": 1736123500000,
  "status": "active",
  "deviceInfo": {
    "name": "My Mobile Device",
    "type": "mobile"
  }
}
```

#### 阶段 2: 后续连接（设备签名认证）

```javascript
// 客户端：使用设备签名连接

async function connectWithDeviceAuth() {
  // 2.1 从本地存储加载设备凭据
  const deviceId = localStorage.getItem('openclaw_device_id');
  const privateKey = localStorage.getItem('openclaw_private_key');
  const deviceToken = localStorage.getItem('openclaw_device_token');

  // 2.2 构建设备认证 payload
  const timestamp = Date.now();
  const authPayload = await buildDeviceAuthPayload({
    version: 2,
    deviceId,
    clientId: 'webchat-ui',
    clientMode: 'webchat',
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
    timestamp,
    deviceToken,
    nonce: crypto.randomUUID(),  // v2 添加 nonce 防重放
  });

  // 2.3 使用私钥签名
  const signature = await sign(authPayload, privateKey);

  // 2.4 连接到 Gateway
  const client = new GatewayBrowserClient({
    url: 'wss://openclaw.example.com/ws',
    deviceAuth: {
      payload: authPayload,
      signature: signature,
    },
  });

  await client.connect();

  return client;
}
```

**设备认证 payload 格式**（v2）:

```
v2|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{timestamp}|{deviceToken}|{nonce}

示例：
v2|dev_123abc456def|webchat-ui|webchat|operator|operator.read,operator.write|1736123456789|dt_789xyz012abc|abc-123-def-456
```

#### 阶段 3: Gateway 认证中间件验证

```typescript
// 设备认证中间件：src/gateway/middleware/device-auth.ts

import { verifyDeviceSignature } from '@/infra/device-identity';
import { parseDeviceAuthPayload } from '@/gateway/device-auth';

interface DeviceAuthResult {
  success: boolean;
  userId?: string;
  deviceId?: string;
  instanceType?: 'cloud' | 'local';
  instanceId?: string;
  sessionKey?: string;
  error?: string;
}

export async function verifyDeviceAuth(
  payload: string,
  signature: string
): Promise<DeviceAuthResult> {
  try {
    // 1. 解析认证 payload
    const auth = parseDeviceAuthPayload(payload);

    if (auth.version !== 2) {
      return { success: false, error: 'Unsupported auth version' };
    }

    // 2. 从设备注册表查询设备
    const deviceRecord = await redis.get(`device:${auth.deviceId}`);

    if (!deviceRecord) {
      return { success: false, error: 'Device not registered' };
    }

    const device = JSON.parse(deviceRecord);

    // 3. 验证设备状态
    if (device.status !== 'active') {
      return { success: false, error: 'Device inactive' };
    }

    // 4. 验证 deviceToken
    if (device.deviceToken !== auth.deviceToken) {
      return { success: false, error: 'Invalid device token' };
    }

    // 5. 验证签名
    const isValid = await verifyDeviceSignature(
      payload,
      signature,
      device.publicKey
    );

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // 6. 检查 nonce 防重放攻击（v2）
    const nonceKey = `nonce:${auth.nonce}`;
    const nonceExists = await redis.exists(nonceKey);

    if (nonceExists) {
      return { success: false, error: 'Replay attack detected' };
    }

    // 7. 存储 nonce（5 分钟过期）
    await redis.setex(nonceKey, 300, '1');

    // 8. 更新设备最后活跃时间
    device.lastSeenAt = Date.now();
    await redis.setex(
      `device:${auth.deviceId}`,
      30 * 24 * 60 * 60,  // 30 天
      JSON.stringify(device)
    );

    // 9. 查询用户实例映射
    const userId = device.userId;
    const userInstance = await getUserInstance(userId);

    // 10. 生成会话 Key（确保用户隔离）
    const sessionKey = `user:${userId}`;

    return {
      success: true,
      userId,
      deviceId: auth.deviceId,
      instanceType: userInstance.type,
      instanceId: userInstance.instanceId,
      sessionKey,
    };
  } catch (error) {
    console.error('Device auth verification failed:', error);
    return { success: false, error: 'Verification error' };
  }
}

// 查询用户实例映射
async function getUserInstance(userId: string) {
  // 1. 尝试从缓存获取
  const cached = await redis.get(`user:instance:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. 从数据库查询
  const result = await db.query(`
    SELECT instance_type, instance_id, gateway_url
    FROM user_instances
    WHERE user_id = ?
  `, [userId]);

  if (result.length === 0) {
    // 新用户：分配云端实例
    return await assignCloudInstance(userId);
  }

  const instance = {
    type: result[0].instance_type,
    instanceId: result[0].instance_id,
    gatewayUrl: result[0].gateway_url,
  };

  // 3. 缓存结果
  await redis.setex(`user:instance:${userId}`, 3600, JSON.stringify(instance));

  return instance;
}

// 为新用户分配云端实例
async function assignCloudInstance(userId: string) {
  // 1. 查找负载最低的云端实例
  const instances = await redis.keys('cloud:instance:*:load');

  let bestInstance = null;
  let lowestLoad = Infinity;

  for (const key of instances) {
    const load = await redis.get(key);
    const data = JSON.parse(load);

    if (data.currentUsers < data.maxUsers && data.currentUsers < lowestLoad) {
      bestInstance = key.replace('cloud:instance:', '').replace(':load', '');
      lowestLoad = data.currentUsers;
    }
  }

  if (!bestInstance) {
    throw new Error('No available cloud instances');
  }

  // 2. 查询实例详情
  const instanceData = await db.query(`
    SELECT instance_id, host, port
    FROM cloud_instances
    WHERE instance_id = ? AND status = 'active'
  `, [bestInstance]);

  if (instanceData.length === 0) {
    throw new Error('Cloud instance unavailable');
  }

  // 3. 保存用户实例映射
  const gatewayUrl = `ws://${instanceData[0].host}:${instanceData[0].port}`;

  await db.query(`
    INSERT INTO user_instances (user_id, instance_type, instance_id, gateway_url)
    VALUES (?, 'cloud', ?, ?)
  `, [userId, bestInstance, gatewayUrl]);

  // 4. 更新实例负载
  await redis.hincrby(`cloud:instance:${bestInstance}:load`, 'currentUsers', 1);

  return {
    type: 'cloud',
    instanceId: bestInstance,
    gatewayUrl,
  };
}
```

#### 阶段 4: 连接路由与消息转发

```typescript
// 连接路由器：src/gateway/router/connection-router.ts

import WebSocket from 'ws';

export class ConnectionRouter {
  private clientConnections: Map<string, WebSocket> = new Map();
  private gatewayConnections: Map<string, WebSocket> = new Map();

  /**
   * 为客户端连接创建到目标 Gateway 的隧道
   */
  async createTunnel(clientWs: WebSocket, authResult: DeviceAuthResult) {
    const { userId, instanceId, gatewayUrl, sessionKey } = authResult;

    try {
      // 1. 连接到目标 Gateway 实例
      const gatewayWs = new WebSocket(gatewayUrl);

      // 2. 发送 connect 请求（包含 sessionKey）
      gatewayWs.on('open', () => {
        const connectRequest = {
          type: 'req',
          id: `tunnel-${userId}-${Date.now()}`,
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: `tunnel-${userId}`,
              displayName: `Tunnel for ${userId}`,
              version: '1.0.0',
              platform: 'node',
              mode: 'tunnel',
            },
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            sessionKey,  // 注入用户专属 sessionKey
          },
        };

        gatewayWs.send(JSON.stringify(connectRequest));
      });

      // 3. 双向消息转发
      gatewayWs.on('message', (data: Buffer) => {
        // 从 Gateway 接收消息 -> 转发给客户端
        const message = JSON.parse(data.toString());

        // 注入 sessionKey 到所有 chat 请求
        if (message.type === 'req' && message.method?.startsWith('chat.')) {
          message.params = message.params || {};
          message.params.sessionKey = sessionKey;
        }

        clientWs.send(data);
      });

      // 4. 保存连接映射
      this.clientConnections.set(userId, clientWs);
      this.gatewayConnections.set(userId, gatewayWs);

      // 5. 处理客户端消息
      clientWs.on('message', (data: Buffer) => {
        // 从客户端接收消息 -> 转发给 Gateway
        const message = JSON.parse(data.toString());

        // 注入 sessionKey 到所有 chat 请求
        if (message.type === 'req' && message.method?.startsWith('chat.')) {
          message.params = message.params || {};
          message.params.sessionKey = sessionKey;
        }

        gatewayWs.send(data);
      });

      // 6. 连接关闭处理
      const cleanup = () => {
        this.clientConnections.delete(userId);
        this.gatewayConnections.delete(userId);
        gatewayWs.close();
      };

      clientWs.on('close', cleanup);
      gatewayWs.on('close', cleanup);

      console.log(`[Router] Tunnel created for user ${userId} -> instance ${instanceId}`);
    } catch (error) {
      console.error(`[Router] Tunnel creation failed for user ${userId}:`, error);
      clientWs.close(1011, 'Internal Server Error');
    }
  }

  /**
   * 断开用户连接
   */
  disconnectUser(userId: string) {
    const clientWs = this.clientConnections.get(userId);
    const gatewayWs = this.gatewayConnections.get(userId);

    if (clientWs) clientWs.close();
    if (gatewayWs) gatewayWs.close();

    this.clientConnections.delete(userId);
    this.gatewayConnections.delete(userId);
  }
}
```

### 云端 Docker 部署配置

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  # Redis（设备注册表 + 缓存）
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes

  # PostgreSQL（用户实例映射）
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

  # 云端 Gateway 实例 #1
  openclaw-gateway-1:
    image: openclaw/gateway:latest
    ports:
      - "18789:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=token
      - OPENCLAW_REDIS_HOST=redis
      - OPENCLAW_POSTGRES_HOST=postgres
      - OPENCLAW_POSTGRES_DB=openclaw
      - OPENCLAW_POSTGRES_USER=openclaw
      - OPENCLAW_POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - openclaw-data-1:/data
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  # 云端 Gateway 实例 #2
  openclaw-gateway-2:
    image: openclaw/gateway:latest
    ports:
      - "18790:18789"
    environment:
      - OPENCLAW_GATEWAY_MODE=token
      - OPENCLAW_REDIS_HOST=redis
      - OPENCLAW_POSTGRES_HOST=postgres
      - OPENCLAW_POSTGRES_DB=openclaw
      - OPENCLAW_POSTGRES_USER=openclaw
      - OPENCLAW_POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - openclaw-data-2:/data
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  # 设备认证中间件 + 路由服务
  auth-router:
    image: openclaw/auth-router:latest
    ports:
      - "3000:3000"
      - "443:443"
    environment:
      - REDIS_HOST=redis
      - DATABASE_URL=postgres://openclaw:${POSTGRES_PASSWORD}@postgres:5432/openclaw
      - SSL_CERT_PATH=/certs/fullchain.pem
      - SSL_KEY_PATH=/certs/privkey.pem
    volumes:
      - ./certs:/certs:ro
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:
  openclaw-data-1:
  openclaw-data-2:
```

### 本地硬件盒部署配置

**本地 Gateway 配置**:

```yaml
# ~/.openclaw/config.yml

gateway:
  # 绑定地址
  bind: 0.0.0.0
  port: 18789

  # 认证模式（通过云端认证中间件）
  auth:
    mode: tunnel  # 隧道模式（不直接验证）
    allowTunnels: true  # 允许来自云端路由器的隧道连接

  # Tailscale 配置（用于建立到云端的隧道）
  tunnel:
    provider: tailscale
    enabled: true
    serverName: openclaw-box-userx  # Tailscale 设备名称
```

**本地设备注册脚本**:

```bash
#!/bin/bash
# scripts/register-local-box.sh

# 1. 获取设备身份
DEVICE_ID=$(openclaw config get device.id)
PUBLIC_KEY=$(openclaw config get device.publicKey)

# 2. 读取用户 Token（从本地配置或用户输入）
read -p "Enter your user token: " USER_TOKEN

# 3. 向云端注册设备
curl -X POST https://openclaw.example.com/api/local-box/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "deviceId": "'$DEVICE_ID'",
    "publicKey": "'$PUBLIC_KEY'",
    "deviceInfo": {
      "name": "OpenClaw Hardware Box",
      "type": "hardware"
    },
    "tunnelEndpoint": "ts-openclaw-box-userx.tail12abc.ts.net:18789"
  }'

# 4. 保存返回的 deviceToken
# （云端响应中包含）

echo "Local box registered successfully!"
```

**云端本地实例注册 API**:

```typescript
// 云端 API：注册本地硬件盒

import express from 'express';
import { verifyUserToken } from '@/auth/oauth';
import { generateDeviceToken } from '@/utils/tokens';

const router = express.Router();

router.post('/api/local-box/register', async (req, res) => {
  try {
    // 1. 验证用户 Token
    const user = await verifyUserToken(req.headers.authorization?.replace('Bearer ', ''));

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { deviceId, publicKey, deviceInfo, tunnelEndpoint } = req.body;

    // 2. 检查是否已有本地实例
    const existing = await db.query(`
      SELECT * FROM local_instances WHERE user_id = ?
    `, [user.userId]);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Local instance already exists' });
    }

    // 3. 创建设备注册表记录
    const deviceToken = generateDeviceToken();

    await redis.setex(`device:${deviceId}`, 30 * 24 * 60 * 60, JSON.stringify({
      deviceId,
      publicKey,
      deviceToken,
      userId: user.userId,
      registeredAt: Date.now(),
      lastSeenAt: Date.now(),
      status: 'active',
      deviceInfo,
    }));

    // 4. 创建本地实例记录
    const instanceId = `local-${user.userId}`;
    await db.query(`
      INSERT INTO local_instances (instance_id, user_id, tunnel_endpoint, online)
      VALUES (?, ?, ?, true)
    `, [instanceId, user.userId, tunnelEndpoint]);

    // 5. 创建用户实例映射
    await db.query(`
      INSERT INTO user_instances (user_id, instance_type, instance_id, gateway_url)
      VALUES (?, 'local', ?, ?)
      ON DUPLICATE KEY UPDATE
        instance_type = 'local',
        instance_id = ?,
        gateway_url = ?
    `, [user.userId, instanceId, tunnelEndpoint, instanceId, tunnelEndpoint]);

    // 6. 清除云端实例缓存（如果用户之前使用云端）
    await redis.del(`user:instance:${user.userId}`);

    res.json({
      success: true,
      deviceToken,
      instanceId,
    });
  } catch (error) {
    console.error('Local box registration failed:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
```

### 客户端完整实现

```typescript
// H5 客户端：完整设备认证流程

import { GatewayBrowserClient } from '@/services/gateway';
import { generateKeyPair, sign, deriveDeviceIdFromPublicKey } from '@/utils/device-auth';

class OpenClawClient {
  private client: GatewayBrowserClient | null = null;
  private userId: string | null = null;
  private sessionKey: string | null = null;

  /**
   * 初始化客户端（首次使用时注册设备）
   */
  async initialize() {
    // 1. 检查本地存储中是否有设备凭据
    const deviceId = localStorage.getItem('openclaw_device_id');
    const privateKey = localStorage.getItem('openclaw_private_key');
    const deviceToken = localStorage.getItem('openclaw_device_token');
    const userId = localStorage.getItem('openclaw_user_id');

    if (!deviceId || !privateKey || !deviceToken) {
      // 首次使用：需要注册设备
      return await this.registerNewDevice();
    }

    // 2. 已有凭据：直接连接
    this.userId = userId || null;
    return await this.connect();
  }

  /**
   * 注册新设备
   */
  private async registerNewDevice() {
    try {
      // 1. 生成密钥对
      const keyPair = await generateKeyPair();
      const deviceId = await deriveDeviceIdFromPublicKey(keyPair.publicKey);

      // 2. 连接到认证端点（使用临时注册 Token）
      const tempClient = new GatewayBrowserClient({
        url: 'wss://openclaw.example.com/ws',
        token: SHARED_REGISTRATION_TOKEN,
      });

      await tempClient.connect();

      // 3. 发送设备注册请求
      const response = await tempClient.request('device.register', {
        deviceId,
        publicKey: keyPair.publicKey,
        deviceInfo: {
          name: 'My Mobile Device',
          type: 'mobile',
          userAgent: navigator.userAgent,
        },
      });

      await tempClient.disconnect();

      // 4. 保存凭据
      localStorage.setItem('openclaw_device_id', deviceId);
      localStorage.setItem('openclaw_private_key', keyPair.privateKey);
      localStorage.setItem('openclaw_device_token', response.deviceToken);
      localStorage.setItem('openclaw_user_id', response.userId);

      this.userId = response.userId;

      // 5. 使用设备认证连接
      return await this.connect();
    } catch (error) {
      console.error('Device registration failed:', error);
      throw error;
    }
  }

  /**
   * 使用设备认证连接
   */
  private async connect() {
    const deviceId = localStorage.getItem('openclaw_device_id');
    const privateKey = localStorage.getItem('openclaw_private_key');
    const deviceToken = localStorage.getItem('openclaw_device_token');

    if (!deviceId || !privateKey || !deviceToken) {
      throw new Error('Device credentials not found');
    }

    try {
      // 1. 构建设备认证 payload
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

      // 2. 签名
      const signature = await sign(payload, privateKey);

      // 3. 连接到 Gateway
      this.client = new GatewayBrowserClient({
        url: 'wss://openclaw.example.com/ws',
        deviceAuth: { payload, signature },
      });

      await this.client.connect();

      // 4. 获取会话信息
      const sessionInfo = await this.client.request('session.info');
      this.sessionKey = sessionInfo.sessionKey;
      this.userId = sessionInfo.userId;

      console.log(`[OpenClawClient] Connected as user ${this.userId}, session ${this.sessionKey}`);

      return this.client;
    } catch (error) {
      console.error('Connection failed:', error);
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
    }
  }
}

// 导出单例
export const openclawClient = new OpenClawClient();
```

### 方案 2 总结

**优点**：
- ✅ 设备级认证：每个设备独立身份
- ✅ 安全性高：Ed25519 签名 + nonce 防重放
- ✅ 支持撤销：可吊销单个设备
- ✅ 用户完全隔离：sessionKey 确保会话隔离
- ✅ 透明路由：用户无需关心后端部署
- ✅ 灵活扩展：支持云端 + 本地混合部署

**缺点**：
- ⚠️ 首次配对需要共享 Token（一次性）
- ⚠️ 需要管理设备注册表
- ⚠️ 需要额外的路由层

**适用场景**：
- 生产环境推荐
- 多用户 SaaS 平台
- 云端 Docker + 本地硬件盒混合部署
- 需要设备管理的场景

---

## 方案 3: OAuth 2.0 + 反向代理（企业级）

### 架构设计

```
┌───────────────────────────────────────────────────────────────┐
│                      用户浏览器                                │
│                 (访问 https://app.example.com)                │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  OAuth 2.0 提供商    │
                │  (Auth0/Okta/GitHub)  │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Web 应用前端       │
                │  (React SPA)         │
                │  - OAuth 登录流程    │
                │  - Token 管理        │
                └──────────┬───────────┘
                           │
                           │ API 请求 (Bearer Token)
                           ▼
                ┌──────────────────────┐
                │   API Gateway        │
                │  - OAuth Token 验证  │
                │  - 用户身份提取      │
                │  - 实例路由决策      │
                └──────────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
      ┌───────▼────────┐      ┌────────▼────────┐
      │  云端 Docker    │      │  本地硬件盒子     │
      │  Gateway 集群   │      │  Gateway 实例   │
      └────────────────┘      └─────────────────┘
```

### OAuth 2.0 集成

**Auth0 配置示例**:

```javascript
// src/auth/auth0-config.ts

export const authConfig = {
  domain: 'your-tenant.auth0.com',
  clientId: 'your-client-id',
  redirectUri: window.location.origin + '/callback',
  audience: 'https://openclaw.example.com',
  scope: 'openid profile email',
};

// 登录流程
export async function login() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    scope: authConfig.scope,
    audience: authConfig.audience,
    state: generateState(),  // 防 CSRF
  });

  window.location.href = `https://${authConfig.domain}/authorize?${params}`;
}

// 处理回调
export async function handleCallback() {
  const code = new URLSearchParams(window.location.search).get('code');
  const state = new URLSearchParams(window.location.search).get('state');

  // 验证 state
  if (!verifyState(state)) {
    throw new Error('Invalid state');
  }

  // 交换 code for tokens
  const tokenResponse = await fetch(`https://${authConfig.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: authConfig.clientId,
      client_secret: 'your-client-secret',
      code,
      redirect_uri: authConfig.redirectUri,
    }),
  });

  const tokens = await tokenResponse.json();

  // 保存 tokens
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('id_token', tokens.id_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);

  // 解析用户信息
  const userInfo = JSON.parse(atob(tokens.id_token.split('.')[1]));

  return {
    accessToken: tokens.access_token,
    userId: userInfo.sub,
    email: userInfo.email,
  };
}

// Token 刷新
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');

  const response = await fetch(`https://${authConfig.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: authConfig.clientId,
      refresh_token: refreshToken,
    }),
  });

  const tokens = await response.json();

  localStorage.setItem('access_token', tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem('refresh_token', tokens.refresh_token);
  }

  return tokens.access_token;
}
```

### API Gateway 实现

```typescript
// API Gateway：src/api-gateway/index.ts

import express from 'express';
import { expressjwt: jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import httpProxy from 'http-proxy-middleware';

const app = express();

// JWT 验证中间件
const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`,
  }),
  audience: authConfig.audience,
  issuer: `https://${authConfig.domain}/`,
  algorithms: ['RS256'],
});

// 用户信息提取中间件
app.use('/api', (req, res, next) => {
  // 从 JWT 中提取用户信息
  if (req.auth) {
    req.user = {
      userId: req.auth.sub,
      email: req.auth.email,
    };
  }
  next();
});

// Token 交换端点：OAuth Token -> Gateway Token
app.post('/api/token/exchange', jwtCheck, async (req, res) => {
  try {
    const { userId } = req.user;

    // 1. 查询用户实例
    const userInstance = await getUserInstance(userId);

    // 2. 生成临时 Gateway Token
    const gatewayToken = generateGatewayToken({
      userId,
      instanceId: userInstance.instanceId,
      expiresIn: '1h',
    });

    // 3. 生成 sessionKey
    const sessionKey = `user:${userId}`;

    res.json({
      gatewayToken,
      sessionKey,
      instanceType: userInstance.type,
      gatewayUrl: userInstance.gatewayUrl,
    });
  } catch (error) {
    console.error('Token exchange failed:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// WebSocket 代理端点
app.use('/ws', jwtCheck, (req, res, next) => {
  const { userId } = req.user;

  // 查询用户实例并代理 WebSocket 连接
  getUserInstance(userId).then((instance) => {
    const targetUrl = instance.gatewayUrl;

    // 创建到目标 Gateway 的代理
    const proxy = httpProxy.createProxyMiddleware({
      target: targetUrl,
      ws: true,
      headers: {
        'X-User-Id': userId,
        'X-Session-Key': `user:${userId}`,
      },
    });

    proxy(req, res, next);
  }).catch((error) => {
    console.error('Instance lookup failed:', error);
    res.status(500).json({ error: 'Instance lookup failed' });
  });
});

// HTTP API 代理
app.use('/api', jwtCheck, (req, res, next) => {
  const { userId } = req.user;

  getUserInstance(userId).then((instance) => {
    const targetUrl = instance.gatewayUrl;

    const proxy = httpProxy.createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      headers: {
        'X-User-Id': userId,
        'X-Session-Key': `user:${userId}`,
      },
    });

    proxy(req, res, next);
  }).catch((error) => {
    console.error('Instance lookup failed:', error);
    res.status(500).json({ error: 'Instance lookup failed' });
  });
});

app.listen(3000);
```

### 方案 3 总结

**优点**：
- ✅ 标准化认证：OAuth 2.0 行业标准
- ✅ 集中用户管理：集成企业 SSO
- ✅ 细粒度权限控制：基于角色的访问控制（RBAC）
- ✅ 安全审计：完整的用户活动日志
- ✅ 可扩展性：支持多种 OAuth 提供商

**缺点**：
- ⚠️ 架构复杂：需要 API Gateway
- ⚠️ 运维成本高：需要管理 OAuth 提供商
- ⚠️ 延迟较高：多层代理
- ⚠️ 学习曲线陡：需要理解 OAuth 2.0

**适用场景**：
- 大型企业（100+ 用户）
- 需要 SSO 集成
- 多系统统一认证
- 需要细粒度权限控制

---

## 方案对比与选择

### 对比表

| 特性 | 方案 2: 设备签名 | 方案 3: OAuth 2.0 |
|------|------------------|-------------------|
| **复杂度** | 中等 | 高 |
| **安全性** | 高 | 最高 |
| **运维成本** | 中等 | 高 |
| **用户管理** | 简单 | 集中（企业级） |
| **SSO 集成** | 需要自定义 | 原生支持 |
| **适用规模** | 10-1000 用户 | 100+ 用户 |
| **云端部署** | ✅ 优秀 | ✅ 优秀 |
| **本地盒部署** | ✅ 优秀 | ⚠️ 需要额外组件 |
| **推荐度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### 选择建议

**推荐方案 2（设备签名认证）**：
- ✅ 云端 Docker 部署：完美支持多用户共享实例
- ✅ 本地硬件盒部署：设备签名天然适合硬件设备
- ✅ 统一访问入口：路由层透明处理
- ✅ 用户完全隔离：sessionKey 确保隔离
- ✅ 实现复杂度适中：不需要 OAuth 提供商
- ✅ 成本较低：无需额外的第三方服务

**推荐方案 3（OAuth 2.0）**：
- 仅当以下条件**全部**满足时考虑：
  1. 大型企业（100+ 用户）
  2. 已有 SSO 系统
  3. 需要集中用户管理
  4. 有专业运维团队

---

## 实施清单

### 云端 Docker 部署（方案 2）

- [ ] 部署 Redis（设备注册表 + 缓存）
- [ ] 部署 PostgreSQL（用户实例映射）
- [ ] 部署多个 Gateway 实例
- [ ] 部署设备认证中间件 + 路由服务
- [ ] 配置 SSL 证书
- [ ] 配置负载均衡
- [ ] 初始化数据库表
- [ ] 配置监控告警

### 本地硬件盒部署（方案 2）

- [ ] 安装 OpenClaw CLI
- [ ] 配置 Tailscale VPN
- [ ] 生成设备身份（Ed25519 密钥对）
- [ ] 向云端注册设备
- [ ] 配置 Gateway 隧道模式
- [ ] 测试云端访问

### Web/H5 客户端开发（方案 2）

- [ ] 实现设备密钥对生成
- [ ] 实现设备注册流程
- [ ] 实现设备签名认证
- [ ] 实现 WebSocket 连接
- [ ] 实现 sessionKey 注入
- [ ] 实现错误处理和重连
- [ ] 实现 UI 指示器

---

**文档版本**：2.0（精炼版）
**创建日期**：2026-02-05
**最后更新**：2026-02-05
