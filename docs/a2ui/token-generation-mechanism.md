# OpenClaw Gateway Token 生成机制分析

## 概述

本文档详细分析 OpenClaw Gateway 的认证和 Token 生成机制，包括设备认证流程、Token 获取方式，以及如何在黑盒环境下自动化获取 Token 以连接到 OpenClaw。

---

## 认证架构概览

### 认证方式

OpenClaw Gateway 支持多种认证方式：

| 认证方式 | 配置项 | 优先级 | 适用场景 |
|---------|--------|--------|----------|
| 共享 Token | `gateway.auth.token` | 高 | 简单部署，多客户端共享 |
| 共享 Password | `gateway.auth.password` | 高 | 临时访问，快速测试 |
| 设备签名认证 | 设备密钥对 + deviceToken | 低 | 生产环境，自动化部署 |
| Tailscale Auth | `gateway.auth.allowTailscale` | 自动 | 内网环境，零配置 |

### 认证流程图

```
客户端                         Gateway 服务器
  │                                │
  │  1. WebSocket 连接             │
  │───────────────────────────────>│
  │                                │
  │  2. connect.challenge 事件     │
  │<───────────────────────────────│
  │  { nonce: "abc123" }           │
  │                                │
  │  3. connect 请求               │
  │───────────────────────────────>│
  │  {                              │
  │    auth: { token: "..." },     │  ← 共享 Token 认证
  │    OR                           │
  │    auth: { password: "..." },  │  ← 共享 Password 认证
  │    OR                           │
  │    device: {                    │  ← 设备签名认证
  │      id: "...",
  │      publicKey: "...",
  │      signature: "...",
  │      nonce: "abc123"
  │    }
  │  }                              │
  │                                │
  │  4. 认证验证                    │
  │                                │
  │  ✓ 共享 Token: timingSafeEqual  │
  │  ✓ 设备签名: Ed25519 验证       │
  │  ✓ Tailscale: whois 查询       │
  │                                │
  │  5. hello-ok 响应              │
  │<───────────────────────────────│
  │  {                              │
  │    auth: {                      │
  │      deviceToken: "...",        │  ← 新设备令牌（可选）
  │      role: "operator",          │
  │      scopes: [...]              │
  │    }                            │
  │  }                              │
  │                                │
  │  6. 存储 deviceToken            │
  │  (localStorage)                 │
  │                                │
```

---

## 共享 Token 认证

### 配置方式

**方式 1: 配置文件** (`~/.openclaw/config.yml`):
```yaml
gateway:
  auth:
    mode: token
    token: "your-secret-token-here"
```

**方式 2: 环境变量**:
```bash
export OPENCLAW_GATEWAY_TOKEN="your-secret-token-here"
# 或
export CLAWDBOT_GATEWAY_TOKEN="your-secret-token-here"
```

### Token 验证逻辑

```typescript
// src/gateway/auth.ts

export async function authorizeGatewayConnect(params: {
  auth: ResolvedGatewayAuth;
  connectAuth?: { token?: string; password?: string };
  req?: IncomingMessage;
}): Promise<GatewayAuthResult> {
  const { auth, connectAuth } = params;

  // Token 模式
  if (auth.mode === "token") {
    // 1. 检查配置
    if (!auth.token) {
      return { ok: false, reason: "token_missing_config" };
    }

    // 2. 检查请求
    if (!connectAuth?.token) {
      return { ok: false, reason: "token_missing" };
    }

    // 3. 时间安全比较（防止时序攻击）
    if (!safeEqual(connectAuth.token, auth.token)) {
      return { ok: false, reason: "token_mismatch" };
    }

    return { ok: true, method: "token" };
  }

  return { ok: false, reason: "unauthorized" };
}

// 时间安全比较
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

### 客户端使用

```typescript
// ui/src/ui/gateway.ts

const client = new GatewayBrowserClient({
  url: 'ws://localhost:18789',
  token: 'your-secret-token-here',  // 共享 Token
  clientName: 'my-app',
  mode: 'webchat',
});

client.start();
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 实现简单 | ✗ 安全性较低（Token 泄露风险） |
| ✓ 无需密钥管理 | ✗ 无法区分客户端 |
| ✓ 易于测试 | ✗ 无法撤销单个客户端 |
| ✓ 跨语言支持 | ✗ 需要安全传递 Token |

---

## 设备签名认证（推荐）

### 认证流程

#### 1. 生成设备身份

```typescript
// ui/src/ui/device-identity.ts

import { getPublicKeyAsync, signAsync, utils } from "@noble/ed25519";

type DeviceIdentity = {
  deviceId: string;      // SHA-256(publicKey)
  publicKey: string;     // Base64URL 编码
  privateKey: string;    // Base64URL 编码
};

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const STORAGE_KEY = "openclaw-device-identity-v1";

  // 尝试从 localStorage 加载
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    return {
      deviceId: parsed.deviceId,
      publicKey: parsed.publicKey,
      privateKey: parsed.privateKey,
    };
  }

  // 生成新的 Ed25519 密钥对
  const privateKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(privateKey);

  // 计算 deviceId（SHA-256 哈希）
  const deviceId = await fingerprintPublicKey(publicKey);

  const identity: DeviceIdentity = {
    deviceId,
    publicKey: base64UrlEncode(publicKey),
    privateKey: base64UrlEncode(privateKey),
  };

  // 持久化到 localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    ...identity,
    createdAtMs: Date.now(),
  }));

  return identity;
}
```

#### 2. 构建认证负载

```typescript
// src/gateway/device-auth.ts

export type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;      // 可选：用于首次认证
  nonce?: string | null;      // 可选：挑战-响应
  version?: "v1" | "v2";
};

export function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";

  // 构建管道分隔的负载
  const base = [
    version,          // "v1" 或 "v2"
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];

  // v2 包含 nonce
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }

  return base.join("|");
}
```

**负载格式**:
```
v1|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<signedAtMs>|<token>
v2|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<signedAtMs>|<token>|<nonce>
```

#### 3. 签名负载

```typescript
// ui/src/ui/device-identity.ts

export async function signDevicePayload(
  privateKeyBase64Url: string,
  payload: string
): Promise<string> {
  const key = base64UrlDecode(privateKeyBase64Url);
  const data = new TextEncoder().encode(payload);
  const sig = await signAsync(data, key);
  return base64UrlEncode(sig);
}
```

#### 4. 发送连接请求

```typescript
// ui/src/ui/gateway.ts

private async sendConnect() {
  const deviceIdentity = await loadOrCreateDeviceIdentity();
  const signedAtMs = Date.now();
  const nonce = this.connectNonce ?? undefined;

  // 构建负载
  const payload = buildDeviceAuthPayload({
    deviceId: deviceIdentity.deviceId,
    clientId: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
    clientMode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
    role: "operator",
    scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
    signedAtMs,
    token: authToken ?? null,  // 可选：首次认证时的共享 Token
    nonce,
  });

  // 签名
  const signature = await signDevicePayload(
    deviceIdentity.privateKey,
    payload
  );

  // 发送连接请求
  await this.request("connect", {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: this.opts.clientName,
      version: this.opts.clientVersion,
      platform: navigator.platform,
      mode: this.opts.mode,
    },
    role: "operator",
    scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
    device: {
      id: deviceIdentity.deviceId,
      publicKey: deviceIdentity.publicKey,
      signature,
      signedAt: signedAtMs,
      nonce,
    },
  });
}
```

#### 5. Gateway 验证

```typescript
// src/gateway/server/ws-connection/message-handler.ts

import {
  deriveDeviceIdFromPublicKey,
  verifyDeviceSignature,
} from "../../../infra/device-identity.js";

// 验证签名
const verified = await verifyDeviceSignature({
  deviceId: connectParams.device?.id,
  publicKeyBase64Url: connectParams.device?.publicKey ?? "",
  payload: buildDeviceAuthPayload({
    deviceId: connectParams.device?.id ?? "",
    clientId: connectParams.client?.id ?? "",
    clientMode: connectParams.client?.mode ?? "",
    role: connectParams.role ?? "operator",
    scopes: connectParams.scopes ?? [],
    signedAtMs: connectParams.device?.signedAt ?? 0,
    token: connectParams.auth?.token ?? null,
    nonce: connectParams.device?.nonce,
  }),
  signatureBase64Url: connectParams.device?.signature ?? "",
});

if (!verified) {
  // 签名验证失败
  send({
    type: "res",
    id: req.id,
    ok: false,
    error: errorShape(ErrorCodes.UNAUTHORIZED, "invalid device signature"),
  });
  close(1008, "invalid device signature");
  return;
}

// 检查时间戳（防止重放攻击）
const skewMs = Math.abs(Date.now() - (connectParams.device?.signedAt ?? 0));
if (skewMs > DEVICE_SIGNATURE_SKEW_MS) {  // 10 分钟
  send({
    type: "res",
    id: req.id,
    ok: false,
    error: errorShape(ErrorCodes.UNAUTHORIZED, "device signature expired"),
  });
  close(1008, "device signature expired");
  return;
}
```

#### 6. 返回设备令牌

```typescript
// Gateway 生成并返回 deviceToken

const deviceToken = await ensureDeviceToken({
  deviceId: connectParams.device.id,
  role: connectParams.role ?? "operator",
  scopes: connectParams.scopes ?? [],
});

send({
  type: "hello-ok",
  protocol: PROTOCOL_VERSION,
  server: { ... },
  auth: {
    deviceToken,           // 新的设备令牌
    role: connectParams.role,
    scopes: connectParams.scopes,
    issuedAtMs: Date.now(),
  },
});
```

#### 7. 存储设备令牌

```typescript
// ui/src/ui/gateway.ts

void this.request<GatewayHelloOk>("connect", params)
  .then((hello) => {
    if (hello?.auth?.deviceToken && deviceIdentity) {
      // 存储设备令牌（下次连接使用）
      storeDeviceAuthToken({
        deviceId: deviceIdentity.deviceId,
        role: hello.auth.role ?? role,
        token: hello.auth.deviceToken,
        scopes: hello.auth.scopes ?? [],
      });
    }
  });
```

### 下次连接

```typescript
// 使用设备令牌，无需共享 Token

private async sendConnect() {
  const deviceIdentity = await loadOrCreateDeviceIdentity();

  // 尝试加载已存储的设备令牌
  const storedToken = loadDeviceAuthToken({
    deviceId: deviceIdentity.deviceId,
    role: "operator",
  });

  const authToken = storedToken?.token ?? this.opts.token;

  // 构建负载（包含 deviceToken）
  const payload = buildDeviceAuthPayload({
    deviceId: deviceIdentity.deviceId,
    clientId: this.opts.clientName,
    clientMode: this.opts.mode,
    role: "operator",
    scopes,
    signedAtMs,
    token: authToken,  // 使用存储的 deviceToken
    nonce,
  });

  // ...
}
```

### 认证负载格式详解

#### V1 格式
```
v1|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<timestamp>|<token>
```

**示例**:
```
v1|abc123...|openclaw-control-ui|webchat|operator|operator.admin,operator.approvals|1736123456789|initial-token-xyz
```

#### V2 格式（带 nonce）
```
v2|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<timestamp>|<token>|<nonce>
```

**示例**:
```
v2|abc123...|openclaw-control-ui|webchat|operator|operator.admin,operator.approvals|1736123456789|device-token-xyz|challenge-nonce-123
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| ✓ 每设备独立密钥 | ✗ 需要密钥管理 |
| ✓ 可撤销单个设备 | ✗ 实现复杂 |
| ✓ 防重放攻击（时间戳） | ✗ 需要安全存储私钥 |
| ✓ 支持挑战-响应（nonce） | ✗ 跨设备困难 |
| ✓ 无需共享 Token | - |

---

## 自动化 Token 获取方案

### 场景 1: 已知共享 Token（最简单）

```javascript
// 配置文件中直接使用
const config = {
  gatewayUrl: 'ws://localhost:18789',
  token: process.env.OPENCLAW_GATEWAY_TOKEN  // 从环境变量读取
};

const client = new GatewayClient(config);
await client.connect();
```

### 场景 2: 黑盒环境（无预先配置）

#### 方案 A: 手动配对后提取 Token

**步骤**:
1. 启动 OpenClaw Gateway
2. 打开 Web UI (`http://localhost:18789/__openclaw__/ui`)
3. 在浏览器开发者工具中查看：
   - Application → Local Storage → `openclaw.device.auth.v1`
4. 提取 `deviceToken` 字段
5. 在自动化脚本中使用该 Token

**示例**:
```javascript
// 从 localStorage 读取（浏览器控制台）
JSON.parse(localStorage.getItem('openclaw.device.auth.v1'))
// 输出: { version: 1, deviceId: "...", tokens: { operator: { token: "...", ... } } }

// 在自动化脚本中使用
const DEVICE_TOKEN = "extracted-device-token-here";

const client = new GatewayClient({
  url: 'ws://localhost:18789',
  deviceToken: DEVICE_TOKEN,
});
```

#### 方案 B: 编写设备认证脚本

**Node.js 实现**:
```javascript
// auto-auth.js
const { WebSocket } = require('ws');
const { ed25519 } = require('@noble/ed25519');

// 生成设备身份
async function generateDeviceIdentity() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKey(privateKey);

  const deviceId = crypto.createHash('sha256')
    .update(publicKey)
    .digest('hex');

  return {
    deviceId,
    privateKey: Buffer.from(privateKey).toString('base64url'),
    publicKey: Buffer.from(publicKey).toString('base64url'),
  };
}

// 构建认证负载
function buildAuthPayload(params) {
  const scopes = params.scopes.join(',');
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    params.token || '',
    params.nonce || '',
  ].join('|');
}

// 连接并认证
async function connectGateway(gatewayUrl, initialToken) {
  const identity = await generateDeviceIdentity();
  const ws = new WebSocket(gatewayUrl);

  return new Promise((resolve, reject) => {
    let nonce = null;

    ws.on('open', () => {
      console.log('WebSocket connected');
    });

    ws.on('message', async (data) => {
      const msg = JSON.parse(data);

      // 处理挑战
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        nonce = msg.payload.nonce;
        console.log('Received challenge, nonce:', nonce);

        // 构建负载
        const payload = buildAuthPayload({
          deviceId: identity.deviceId,
          clientId: 'my-auto-client',
          clientMode: 'backend',
          role: 'operator',
          scopes: ['operator.admin'],
          signedAtMs: Date.now(),
          token: initialToken,
          nonce,
        });

        // 签名
        const signature = Buffer.from(
          await ed25519.sign(
            Buffer.from(payload),
            Buffer.from(identity.privateKey, 'base64url')
          )
        ).toString('base64url');

        // 发送连接请求
        ws.send(JSON.stringify({
          type: 'req',
          id: 'connect-' + Date.now(),
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'my-auto-client',
              version: '1.0.0',
              platform: 'node',
              mode: 'backend',
            },
            role: 'operator',
            scopes: ['operator.admin'],
            device: {
              id: identity.deviceId,
              publicKey: identity.publicKey,
              signature,
              signedAt: Date.now(),
              nonce,
            },
            auth: {
              token: initialToken,
            },
          },
        }));
      }

      // 处理成功响应
      if (msg.type === 'res' && msg.id.startsWith('connect-')) {
        if (msg.ok) {
          console.log('Connected successfully!');
          console.log('Device Token:', msg.payload.auth.deviceToken);
          console.log('Device ID:', identity.deviceId);
          console.log('Private Key:', identity.privateKey);

          // 保存到文件（供后续使用）
          const credentials = {
            deviceId: identity.deviceId,
            privateKey: identity.privateKey,
            publicKey: identity.publicKey,
            deviceToken: msg.payload.auth.deviceToken,
            role: msg.payload.auth.role,
            scopes: msg.payload.auth.scopes,
          };

          require('fs').writeFileSync(
            'openclaw-credentials.json',
            JSON.stringify(credentials, null, 2)
          );

          console.log('Credentials saved to openclaw-credentials.json');
          resolve(credentials);
        } else {
          console.error('Connection failed:', msg.error);
          reject(msg.error);
        }
      }
    });

    ws.on('error', reject);
  });
}

// 使用
(async () => {
  try {
    // 首次连接需要共享 Token
    const INITIAL_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (!INITIAL_TOKEN) {
      console.error('Please set OPENCLAW_GATEWAY_TOKEN environment variable');
      process.exit(1);
    }

    const credentials = await connectGateway(
      'ws://localhost:18789',
      INITIAL_TOKEN
    );

    console.log('Success! Save these credentials for future connections.');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
})();
```

**运行**:
```bash
# 首次运行（需要共享 Token）
OPENCLAW_GATEWAY_TOKEN="your-shared-token" node auto-auth.js

# 输出: openclaw-credentials.json
{
  "deviceId": "abc123...",
  "privateKey": "...",
  "publicKey": "...",
  "deviceToken": "...",
  "role": "operator",
  "scopes": ["operator.admin"]
}

# 后续连接（不需要共享 Token）
# 使用 saved credentials 中的 deviceToken
```

#### 方案 C: Python 实现

```python
# auto_auth.py
import json
import hashlib
import time
import base64
import websocket
import nacl.signing
import nacl.encoding

def generate_device_identity():
    """生成 Ed25519 密钥对"""
    private_key = nacl.signing.SigningKey.generate()
    public_key = private_key.verify_key

    # 计算 deviceId (SHA-256)
    device_id = hashlib.sha256(
        public_key.encode(encoder=nacl.encoding.RawEncoder)
    ).hexdigest()

    return {
        'device_id': device_id,
        'private_key': private_key.encode(
            encoder=nacl.encoding.Base64UrlEncoder
        ).decode('ascii'),
        'public_key': public_key.encode(
            encoder=nacl.encoding.Base64UrlEncoder
        ).decode('ascii'),
    }

def build_auth_payload(device_id, client_id, client_mode, role, scopes,
                       signed_at_ms, token, nonce):
    """构建认证负载"""
    scopes_str = ','.join(scopes)
    parts = [
        'v2',
        device_id,
        client_id,
        client_mode,
        role,
        scopes_str,
        str(signed_at_ms),
        token or '',
        nonce or '',
    ]
    return '|'.join(parts)

def connect_gateway(gateway_url, initial_token):
    """连接 Gateway 并获取设备令牌"""
    identity = generate_device_identity()
    ws = websocket.create_connection(gateway_url)

    nonce = None

    # 接收挑战
    challenge = json.loads(ws.recv())
    if challenge.get('event') == 'connect.challenge':
        nonce = challenge['payload']['nonce']
        print(f"Received challenge, nonce: {nonce}")

    # 构建负载
    payload = build_auth_payload(
        device_id=identity['device_id'],
        client_id='my-auto-client',
        client_mode='backend',
        role='operator',
        scopes=['operator.admin'],
        signed_at_ms=int(time.time() * 1000),
        token=initial_token,
        nonce=nonce,
    )

    # 签名
    private_key = nacl.signing.SigningKey(
        identity['private_key'],
        encoder=nacl.encoding.Base64UrlEncoder
    )
    signature = private_key.sign(
        payload.encode(),
        encoder=nacl.encoding.Base64UrlEncoder
    ).signature.decode('ascii')

    # 发送连接请求
    connect_req = {
        'type': 'req',
        'id': f'connect-{int(time.time() * 1000)}',
        'method': 'connect',
        'params': {
            'minProtocol': 3,
            'maxProtocol': 3,
            'client': {
                'id': 'my-auto-client',
                'version': '1.0.0',
                'platform': 'python',
                'mode': 'backend',
            },
            'role': 'operator',
            'scopes': ['operator.admin'],
            'device': {
                'id': identity['device_id'],
                'publicKey': identity['public_key'],
                'signature': signature,
                'signedAt': int(time.time() * 1000),
                'nonce': nonce,
            },
            'auth': {
                'token': initial_token,
            },
        },
    }

    ws.send(json.dumps(connect_req))

    # 接收响应
    response = json.loads(ws.recv())

    if response.get('ok'):
        device_token = response['payload']['auth']['deviceToken']
        credentials = {
            'device_id': identity['device_id'],
            'private_key': identity['private_key'],
            'public_key': identity['public_key'],
            'device_token': device_token,
            'role': response['payload']['auth']['role'],
            'scopes': response['payload']['auth']['scopes'],
        }

        # 保存凭据
        with open('openclaw_credentials.json', 'w') as f:
            json.dump(credentials, f, indent=2)

        print("Success! Credentials saved to openclaw_credentials.json")
        print(f"Device Token: {device_token}")
        return credentials
    else:
        print(f"Failed: {response.get('error')}")
        raise Exception(response.get('error'))

if __name__ == '__main__':
    import os

    token = os.environ.get('OPENCLAW_GATEWAY_TOKEN')
    if not token:
        print("Please set OPENCLAW_GATEWAY_TOKEN environment variable")
        exit(1)

    credentials = connect_gateway('ws://localhost:18789', token)
```

### 场景 3: 完全黑盒（无任何配置）

**注意**: 如果 Gateway 配置了 `gateway.controlUi.allowInsecureAuth: true`，可以在无认证情况下连接（仅限本地开发）。

```javascript
const client = new GatewayClient({
  url: 'ws://localhost:18789',
  // 不提供 token 或 password
  // 必须是本地连接且启用了 allowInsecureAuth
});
```

**配置** (`~/.openclaw/config.yml`):
```yaml
gateway:
  controlUi:
    allowInsecureAuth: true  # 危险！仅用于本地开发
```

---

## Token 存储位置

### 共享 Token

| 位置 | 格式 | 优先级 |
|------|------|--------|
| 环境变量 `OPENCLAW_GATEWAY_TOKEN` | 明文字符串 | 1 |
| 环境变量 `CLAWDBOT_GATEWAY_TOKEN` | 明文字符串 | 2 |
| 配置文件 `gateway.auth.token` | 明文字符串 | 3 |
| 配置文件 `gateway.remote.token` | 明文字符串 | 4 |

### 设备 Token

| 位置 | 格式 | 用途 |
|------|------|------|
| Local Storage `openclaw.device.auth.v1` | JSON 对象 | Web 客户端 |
| Keychain / KeyStore | 加密存储 | 原生应用 |
| 配置文件 `deviceToken` | 明文字符串 | CLI 工具 |

**存储格式**:
```json
{
  "version": 1,
  "deviceId": "abc123...",
  "tokens": {
    "operator": {
      "token": "device-token-xyz...",
      "role": "operator",
      "scopes": ["operator.admin", "operator.approvals"],
      "updatedAtMs": 1736123456789
    }
  }
}
```

---

## 安全建议

### 1. 共享 Token

| 操作 | 建议 |
|------|------|
| 生成 | 使用 `openssl rand -hex 32` 生成随机 Token |
| 存储 | 环境变量或密钥管理服务（如 AWS Secrets Manager） |
| 传输 | 使用 HTTPS/WSS |
| 轮换 | 定期更换 Token |
| 权限 | 最小权限原则 |

### 2. 设备认证

| 操作 | 建议 |
|------|------|
| 私钥存储 | 使用系统 Keychain/KeyStore，不要存储在文件中 |
| 签名时间戳 | 检查时间偏移，防止重放攻击 |
| Nonce | 验证 nonce 的唯一性 |
| Token 撤销 | 在 Gateway 端实现 Token 黑名单 |

### 3. 生产环境

```yaml
# 推荐配置
gateway:
  auth:
    mode: token
    token: ${OPENCLAW_GATEWAY_TOKEN}  # 从环境变量读取
  controlUi:
    allowInsecureAuth: false  # 禁止无认证连接
```

---

## 故障排查

### 问题 1: "unauthorized: gateway token missing"

**原因**: 未提供 Token 或 Password

**解决**:
```javascript
// 检查配置
const client = new GatewayClient({
  url: 'ws://localhost:18789',
  token: 'your-token-here',  // 确保提供了 token
});
```

### 问题 2: "unauthorized: gateway token mismatch"

**原因**: Token 不匹配

**解决**:
```bash
# 检查 Gateway 配置
openclaw config get gateway.auth.token

# 检查环境变量
echo $OPENCLAW_GATEWAY_TOKEN

# 确保两者一致
```

### 问题 3: "invalid device signature"

**原因**: 设备签名验证失败

**解决**:
```javascript
// 检查私钥是否正确
// 检查签名算法是否为 Ed25519
// 检查时间戳是否在允许范围内（10 分钟）
```

### 问题 4: "device signature expired"

**原因**: 签名时间戳过期

**解决**:
```javascript
// 确保系统时间准确
// 使用 NTP 同步时间
// 减少签名和验证之间的延迟
```

---

## 参考资源

### 相关文件

| 文件 | 功能 |
|------|------|
| `src/gateway/auth.ts` | 认证逻辑实现 |
| `src/gateway/device-auth.ts` | 设备认证负载构建 |
| `src/infra/device-identity.ts` | 设备身份验证 |
| `ui/src/ui/gateway.ts` | Web 客户端连接 |
| `ui/src/ui/device-identity.ts` | Web 设备身份生成 |
| `ui/src/ui/device-auth.ts` | Web 设备令牌管理 |

### 相关标准

- [Ed25519 签名算法](https://ed25519.cr.yp.to/)
- [Base64URL 编码](https://tools.ietf.org/html/rfc4648#section-5)
- [WebSocket 协议](https://tools.ietf.org/html/rfc6455)

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
