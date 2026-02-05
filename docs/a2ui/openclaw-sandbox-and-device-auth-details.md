# OpenClaw 沙盒机制与设备认证详解

## 第一部分：OpenClaw 中的沙盒机制

### 核心结论

**OpenClaw 中运行在沙盒/Docker 中的组件：**

1. **工具执行沙盒**（Docker 容器）- 可选
2. **浏览器控制沙盒**（Docker 容器中的浏览器）- 可选
3. **Agent 本身** - ❌ **不在沙盒中**（默认直接在 Host 进程中运行）

---

## 一、Docker 沙盒（工具执行隔离）

### 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway/Agent 进程                        │
│  (直接运行在 Host 中，调用 pi-ai SDK)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────────┐
              │  工具执行请求                  │
              │  (如执行 bash/python 命令)    │
              └──────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────────┐
              │  沙盒系统                      │
              │  - resolveSandboxContext()    │
              │  - ensureSandboxContainer()  │
              └──────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
  ┌─────────────┐               ┌─────────────┐
  │ Docker 容器  │               │ 浏览器容器  │
  │ (工具执行)  │               │ (CDP 控制)  │
  └─────────────┘               └─────────────┘
```

### 1. Docker 沙盒配置

**配置文件** (`~/.openclaw/config.yml`):

```yaml
sandbox:
  # 是否启用沙盒（默认 false）
  enabled: true

  # 工作区访问权限
  workspaceAccess: ro  # ro (只读) | rw (读写) | full (完全访问)

  # 工作区根目录
  workspaceRoot: ~/.openclaw/sandboxes

  # Docker 镜像
  docker:
    image: debian:bookworm-slim

    # 容器工作目录
    workdir: /workspace

    # 只读根文件系统
    readOnlyRoot: true

    # 临时文件系统
    tmpfs:
      - /tmp
      - /run

    # 网络隔离
    network: none  # bridge | none | custom

    # 非 root 用户运行
    user: "1000:1000"

    # 限制能力
    capDrop:
      - ALL
      # 或保留特定能力
      # - NET_BIND_SERVICE

    # Seccomp 配置
    seccompProfile: strict

    # AppArmor 配置
    apparmorProfile: openclaw-sandbox

    # DNS 服务器
    dns:
      - 8.8.8.8
      - 8.8.4.4

    # 主机挂载
    binds:
      - "/host/path:/container/path:ro"

    # 资源限制
    pidsLimit: 100
    memory: "512m"
    cpus: 0.5

    # Ulimit 限制
    ulimits:
      nofile: 1024:2048
```

**Agent 级别覆盖**:

```yaml
agents:
  defaults:
    # 全局沙盒配置
    sandbox:
      enabled: true
      workspaceAccess: ro

  # 特定 Agent 沙盒配置
  list:
    untrusted-agent:
      description: "不受信任的 Agent"
      sandbox:
        enabled: true
        workspaceAccess: none
        docker:
          readOnlyRoot: true
          capDrop:
            - ALL

    trusted-agent:
      description: "受信任的 Agent"
      sandbox:
        enabled: false  # 不使用沙盒
```

### 2. 沙盒工作流程

```typescript
// src/agents/sandbox/context.ts

export async function resolveSandboxContext(params: {
  config?: OpenClawConfig;
  sessionKey?: string;
  workspaceDir?: string;
}): Promise<SandboxContext | null> {
  // 1. 检查是否启用沙盒
  const runtime = resolveSandboxRuntimeStatus({
    cfg: params.config,
    sessionKey: params.sessionKey,
  });

  if (!runtime.sandboxed) {
    return null;  // 未启用沙盒
  }

  // 2. 解析配置
  const cfg = resolveSandboxConfigForAgent(params.config, runtime.agentId);

  // 3. 准备工作区
  const workspaceDir = resolveSandboxWorkspaceDir(...);
  await ensureSandboxWorkspace(workspaceDir, ...);

  // 4. 创建 Docker 容器
  const containerName = await ensureSandboxContainer({
    sessionKey: params.sessionKey,
    workspaceDir,
    cfg,
  });

  // 5. （可选）创建浏览器容器
  const browser = await ensureSandboxBrowser({
    scopeKey,
    workspaceDir,
    cfg,
  });

  return {
    enabled: true,
    sessionKey: params.sessionKey,
    workspaceDir,
    containerName,
    docker: cfg.docker,
  };
}
```

### 3. 工具执行在沙盒中

```typescript
// 工具调用流程

async function executeToolInSandbox(tool: string, args: string[]) {
  // 1. 检查是否启用沙盒
  const sandbox = await resolveSandboxContext({ sessionKey });

  if (sandbox && sandbox.enabled) {
    // 在 Docker 容器中执行
    return await executeInDockerContainer({
      containerName: sandbox.containerName,
      tool,
      args,
      workdir: sandbox.containerWorkdir,
    });
  } else {
    // 直接在 Host 进程中执行
    return spawn(tool, args);
  }
}
```

---

## 二、浏览器沙盒（浏览器控制）

### 架构

```
┌─────────────────────────────────────────────────────────────┐
│              Gateway/Agent 进程                                │
│                                                              │
│  Agent 需要控制浏览器（如：截图、执行 JavaScript）              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  ensureSandboxBrowser()      │
              │  - 启动 Docker 容器         │
              │  - 包含 Chrome/Chromium     │
              │  - 暴露 CDP 端口             │
              └──────────────────────────────┘
                             │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
        ┌──────────────┐                   ┌──────────────┐
        │   CDP 协议    │                   │   noVNC      │
        │  (Puppeteer)  │                   │   (VNC 查看)  │
        └──────────────┘                   └──────────────┘
```

### 浏览器沙盒配置

```yaml
# ~/.openclaw/config.yml

sandbox:
  # 浏览器沙盒配置
  browser:
    # 是否启用
    enabled: true

    # Docker 镜像
    image: openclaw/browser:latest

    # CDP 端口
    cdpPort: 9222

    # VNC 端口
    vncPort: 5900

    # noVNC 端口
    noVncPort: 6080

    # 无头模式
    headless: true

    # 启用 noVNC
    enableNoVnc: true

    # 是否允许 Host 控制
    allowHostControl: false

    # 自动启动
    autoStart: true

    # 启动超时
    autoStartTimeoutMs: 30000
```

### 工作流程

```typescript
// src/agents/sandbox/browser.ts

export async function ensureSandboxBrowser(params: {
  scopeKey: string;
  workspaceDir: string;
  cfg: SandboxBrowserConfig;
}): Promise<SandboxBrowserContext | null> {
  // 1. 检查是否启用
  if (!params.cfg.enabled) {
    return null;
  }

  // 2. 检查容器是否已存在
  const containerName = `openclaw-browser-${params.scopeKey}`;
  const state = await dockerContainerState(containerName);

  if (state.exists && state.running) {
    // 容器已在运行，验证 CDP 可达
    const cdpPort = await readDockerPort(containerName, params.cfg.cdpPort || 9222);
    if (cdpPort) {
      return { containerName, cdpPort };
    }
  }

  // 3. 创建新容器
  const args = buildSandboxCreateArgs({
    name: containerName,
    cfg: params.cfg.docker,
    scopeKey: params.scopeKey,
  });

  await execDocker([...args, params.cfg.image]);

  // 4. 等待 CDP 端口就绪
  const cdpPort = await readDockerPort(containerName, params.cfg.cdpPort || 9222);

  return { containerName, cdpPort };
}
```

---

## 三、沙盒运行时检测

### 检测逻辑

```typescript
// src/agents/sandbox/runtime-status.ts

export function resolveSandboxRuntimeStatus(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
}): SandboxRuntimeStatus {
  // 解析 Agent 级别配置
  const agentConfig = resolveSandboxConfigForAgent(params.cfg, agentId);

  // 检查是否启用
  const enabled = agentConfig?.enabled ?? false;

  return {
    sandboxed: enabled,
    agentId,
    docker: agentConfig?.docker,
    tools: agentConfig?.tools,
    workspaceAccess: agentConfig?.workspaceAccess,
  };
}
```

### 配置优先级

```
1. Agent 特定配置
   agents.list.<agentId>.sandbox.enabled
   agents.list.<agentId>.sandbox.docker

2. 全局默认配置
   agents.defaults.sandbox.enabled
   agents.defaults.sandbox.docker

3. 未配置时：false（不使用沙盒）
```

---

## 四、设备签名认证完整流程

### 业务流程图

```
客户端                                    Gateway 服务器
  │                                           │
  │  1. 首次配对启动                         │
  │  - 用户访问配对页面                    │
  ├─────────────────────────────────────>│
  │                                           │
  │  2. 生成设备密钥对                     │
  │  - crypto.generateKeyPairSync()      │
  │  - Ed25519 算法                       │
  │  - deviceId = SHA256(publicKey)        │
  │                                           │
  │  3. 发送配对请求                       │
  │  POST /api/device/pairing              │
  │  {                                    │
  │    deviceId,                           │
  │    publicKey,                          │
  │    displayName,                        │
  │    platform                            │
  │  }                                    │
  ├─────────────────────────────────────>│
  │                                           │
  │  4. Gateway 记录待配对请求               │
  │  - 保存到 ~/.openclaw/devices/pending.json │
  │                                           │
  │  5. 管理员批准配对                      │
  │  openclaw devices approve <requestId>   │
  │                                           │
  │  6. Gateway 生成 deviceToken            │
  │  - 随机生成 Token                       │
  │  - 关联 deviceId + role + scopes       │
  │  - 保存到 ~/.openclaw/devices/paired.json │
  │                                           │
  │  7. 客户端轮询配对状态                  │
  │  GET /api/device/pairing/<requestId>     │
  │                                           │
  ├─────────────────────────────────────>│
  │                                           │
  │  8. 返回 deviceToken                    │
  │  {                                    │
  │    token,                              │
  │    role,                               │
  │    scopes,                             │
  │    approvedAtMs                        │
  │  }                                    │
  │<─────────────────────────────────────│
  │                                           │
  │  9. 保存凭据到客户端                    │
  │  localStorage/device.json             │
  │  {                                    │
  │    deviceId,                           │
  │    privateKey,                         │
  │    publicKey,                          │
  │    deviceToken                         │
  │  }                                    │
  │                                           │
  │  10. 后续连接：设备签名认证             │
  │  ┌─────────────────────────────────┐   │
  │  │ WebSocket 连接                │   │
  │  │  - 使用 deviceToken            │   │
  │  │  - 签名认证负载                │   │
  │  │  - Ed25519 签名                 │   │
  │  └─────────────────────────────┘   │
  ├─────────────────────────────────────>│
  │                                           │
  │  11. Gateway 验证签名                   │
  │  - verifyDeviceSignature()         │
  │  - 检查时间戳（10分钟窗口）         │
  │  - 验证 deviceId 匹配                │
  │                                           │
  │  12. 认证成功                           │
  │  ← hello-ok 响应                    │
  │                                           │
  │  13. 可选：刷新 deviceToken            │
  │  - Gateway 返回新的 deviceToken      │
```

---

## 五、设备签名认证内部实现

### 1. 设备身份生成（客户端）

```typescript
// src/infra/device-identity.ts

export function loadOrCreateDeviceIdentity(
  filePath: string = "~/.openclaw/identity/device.json"
): DeviceIdentity {
  // 1. 尝试加载现有身份
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (existing?.version === 1) {
    return {
      deviceId: existing.deviceId,
      publicKeyPem: existing.publicKeyPem,
      privateKeyPem: existing.privateKeyPem,
    };
  }

  // 2. 生成新的 Ed25519 密钥对
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  // 3. 导出 PEM 格式
  const publicKeyPem = publicKey.export({
    type: "spki",
    format: "pem"
  }).toString();

  const privateKeyPem = privateKey.export({
    type: "pkcs8",
    format: "pem"
  }).toString();

  // 4. 计算 deviceId（SHA-256 哈希）
  const deviceId = crypto.createHash("sha256")
    .update(derivePublicKeyRaw(publicKeyPem))
    .digest("hex");

  // 5. 保存到文件
  const identity = {
    version: 1,
    deviceId,
    publicKeyPem,
    privateKeyPem,
    createdAtMs: Date.now(),
  };

  fs.writeFileSync(filePath, JSON.stringify(identity, null, 2), { mode: 0o600 });

  return identity;
}
```

### 2. 认证负载构建

```typescript
// src/gateway/device-auth.ts

export function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
}): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";

  // 管道分隔的格式
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

  // v2 包含 nonce（挑战-响应）
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }

  return base.join("|");
}
```

**负载格式**：

**V1 格式**：
```
v1|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<timestamp>|<token>
```

**V2 格式**（带 nonce）：
```
v2|<deviceId>|<clientId>|<clientMode>|<role>|<scopes>|<timestamp>|<token>|<nonce>
```

**示例**：
```
v2|abc123|openclaw-control-ui|webchat|operator|operator.admin,operator.approvals|1736123456789|device-token-xyz|challenge-nonce-123
```

### 3. 签名生成（客户端）

```typescript
// src/infra/device-identity.ts

export function signDevicePayload(
  privateKeyPem: string,
  payload: string
): string {
  // 1. 加载私钥
  const key = crypto.createPrivateKey(privateKeyPem);

  // 2. 签名负载（UTF-8 编码）
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), key);

  // 3. Base64URL 编码
  return base64UrlEncode(sig);
}
```

### 4. 签名验证（Gateway 端）

```typescript
// src/infra/device-identity.ts

export function verifyDeviceSignature(
  publicKey: string,
  payload: string,
  signatureBase64Url: string
): boolean {
  try {
    // 1. 加载公钥
    const key = publicKey.includes("BEGIN")
      ? crypto.createPublicKey(publicKey)
      : crypto.createPublicKey({
          key: Buffer.concat([
            ED25519_SPKI_PREFIX,
            base64UrlDecode(publicKey)
          ]),
          type: "spki",
          format: "der",
        });

    // 2. 解码签名
    const sig = (() => {
      try {
        return base64UrlDecode(signatureBase64Url);
      } catch {
        return Buffer.from(signatureBase64Url, "base64");
      }
    })();

    // 3. 验证签名
    return crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      key,
      sig
    );
  } catch {
    return false;
  }
}
```

### 5. Gateway 连接处理（完整流程）

```typescript
// src/gateway/server/ws-connection/message-handler.ts

// 1. 接收 connect 请求
const connectParams = parseConnectParams(frame);

// 2. 检查是否提供设备签名
if (connectParams.device) {
  const device = connectParams.device;

  // 3. 验证 deviceId
  const derivedId = deriveDeviceIdFromPublicKey(device.publicKey);
  if (!derivedId || derivedId !== device.id) {
    sendError("device-id-mismatch");
    closeConnection();
    return;
  }

  // 4. 构建认证负载
  const payload = buildDeviceAuthPayload({
    deviceId: device.id,
    clientId: connectParams.client.id,
    clientMode: connectParams.client.mode,
    role: connectParams.role ?? "operator",
    scopes: connectParams.scopes ?? [],
    signedAtMs: device.signedAt,
    token: connectParams.auth?.token ?? null,
    nonce: connectParams.device.nonce,
    version: connectParams.device.nonce ? "v2" : "v1",
  });

  // 5. 验证签名
  const signatureOk = verifyDeviceSignature(
    device.publicKey,
    payload,
    device.signature
  );

  if (!signatureOk) {
    sendError("device-signature-invalid");
    closeConnection();
    return;
  }

  // 6. 检查时间戳（防重放攻击）
  const nowMs = Date.now();
  const skewMs = Math.abs(nowMs - device.signedAt);
  if (skewMs > 10 * 60 * 1000) {  // 10分钟
    sendError("device-signature-expired");
    closeConnection();
    return;
  }

  // 7. 检查设备是否已配对
  const pairedDevice = getPairedDevice(device.id);
  const authToken = connectParams.auth?.token;

  if (pairedDevice) {
    // 已配对设备，验证 token
    const deviceToken = pairedDevice.tokens?.[role];
    if (deviceToken && authToken === deviceToken.token) {
      // Token 匹配，允许连接
      sendHelloOk({
        auth: {
          deviceToken: deviceToken.token,
          role: pairedDevice.role,
          scopes: deviceToken.scopes,
        }
      });
    } else {
      sendError("device-token-mismatch");
      closeConnection();
    }
  } else {
    // 未配对设备，需要手动批准或使用初始 Token
    if (authToken) {
      // 首次连接，需要管理后台批准
      sendError("device-pairing-required");

      // 记录待配对请求
      await requestDevicePairing({
        deviceId: device.id,
        publicKey: device.publicKey,
        clientId: connectParams.client.id,
        displayName: connectParams.client.displayName,
        platform: connectParams.client.platform,
        remoteIp: clientIp,
      });

    } else {
      sendError("device-not-paired");
      closeConnection();
    }
  }
} else {
  // 未提供设备签名，尝试共享 Token 认证
  if (!connectParams.auth?.token && !isLocalDirect) {
    sendError("token-missing");
    closeConnection();
    return;
  }

  // 共享 Token 认证
  // ...
}
```

### 6. deviceToken 生成

```typescript
// src/infra/device-pairing.ts

export async function ensureDeviceToken(params: {
  deviceId: string;
  role: string;
  scopes: string[];
}): Promise<string> {
  // 1. 生成随机 Token
  const token = randomBytes(32).toString('hex');

  // 2. 保存到设备记录
  const pairedDevice = getPairedDevice(params.deviceId);

  pairedDevice.tokens = {
    ...(pairedDevice.tokens || {}),
    [params.role]: {
      token,
      role: params.role,
      scopes: params.scopes,
      createdAtMs: Date.now(),
      lastUsedAtMs: Date.now(),
    },
  };

  savePairedDevice(pairedDevice);

  return token;
}
```

---

## 六、设备配对流程详解

### 配对 API

#### 1. 请求配对

**请求**：
```http
POST /api/device/pairing
Content-Type: application/json

{
  "deviceId": "abc123...",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "displayName": "My iPhone",
  "platform": "ios",
  "clientId": "openclaw-h5",
  "clientMode": "webchat",
  "role": "operator",
  "scopes": ["operator.admin", "operator.approvals"],
  "remoteIp": "203.0.113.42"
}
```

**响应**：
```http
202 Accepted

{
  "requestId": "req-uuid-123",
  "status": "pending",
  "message": "Waiting for admin approval"
}
```

#### 2. 查询配对状态

**请求**：
```http
GET /api/device/pairing/req-uuid-123

{
  "status": "approved",
  "deviceToken": "generated-token-xyz...",
  "role": "operator",
  "scopes": ["operator.admin"],
  "approvedAtMs": 1736123456789
}
```

#### 3. 管理员批准

**命令行**：
```bash
# 查看待批准请求
openclaw devices list-pending

# 批准配对
openclaw devices approve req-uuid-123

# 拒绝配对
openclaw devices deny req-uuid-123

# 列出已配对设备
openclaw devices list

# 撤销设备
openclaw devices revoke abc123...
```

---

## 七、完整示例：H5 客户端设备认证

### 前端实现

```typescript
// h5-client/device-auth.ts

export class DeviceAuthService {
  private readonly STORAGE_KEY = 'openclaw_device';
  private readonly SERVER_URL = 'wss://openclaw.example.com';

  async getOrRegisterDevice(): Promise<{
    deviceId: string;
    privateKey: string;
    publicKey: string;
    deviceToken?: string;
  }> {
    // 1. 尝试加载本地设备
    const local = this.loadLocalDevice();
    if (local) {
      return local;
    }

    // 2. 生成新设备身份
    const identity = await this.generateDeviceIdentity();

    // 3. 请求配对
    const pairingUrl = `${this.SERVER_URL}/api/device/pairing`;
    const response = await fetch(pairingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: identity.deviceId,
        publicKey: identity.publicKeyPem,
        displayName: 'H5 Mobile',
        platform: 'mobile',
        clientId: 'openclaw-h5',
        clientMode: 'webchat',
        role: 'operator',
        scopes: ['operator.admin'],
      }),
    });

    if (response.status === 202) {
      // 需要等待批准
      const { requestId } = await response.json();

      // 轮询配对状态
      const approved = await this.pollPairingStatus(requestId);

      if (approved) {
        // 保存 deviceToken
        const deviceToken = approved.deviceToken;
        this.saveLocalDevice({
          ...identity,
          deviceToken,
        });

        return { ...identity, deviceToken };
      }
    } else if (response.status === 200) {
      // 自动批准（已配对设备）
      const { deviceToken } = await response.json();
      this.saveLocalDevice({
        ...identity,
        deviceToken,
      });

      return { ...identity, deviceToken };
    }

    throw new Error('Device pairing failed');
  }

  private async generateDeviceIdentity(): Promise<{
    deviceId: string;
    privateKey: string;
    publicKey: string;
  }> {
    // 使用 Web Crypto API 生成 Ed25519 密钥对
    const keyPair = await crypto.subtle.generateKey(
      'ed25519',
      true,  // extractable
      ['sign']
    );

    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    // 计算 deviceId
    const publicKeyRaw = await this.extractRawKey(publicKeyBuffer);
    const hashBuffer = await crypto.subtle.digest('SHA-256', publicKeyRaw);
    const deviceId = Array.from(hashBuffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      deviceId,
      privateKey: this.arrayBufferToBase64(privateKeyBuffer),
      publicKey: this.arrayBufferToBase64(publicKeyBuffer),
    };
  }

  private async extractRawKey(keyData: ArrayBuffer): Promise<Uint8Array> {
    const data = new Uint8Array(keyData);
    // 去除 SPKI 前缀
    const ED25519_SPKI_PREFIX = new TextEncoder().encode('302a300506032b6570032100', 'hex').buffer;

    if (data.length > ED25519_SPKI_PREFIX.length &&
        this.arrayBuffersEqual(data.slice(0, ED25519_SPKI_PREFIX.length), ED25519_SPKI_PREFIX)) {
      return data.slice(ED25519_SPKI_PREFIX.length);
    }

    return data;
  }

  connectWithDeviceAuth(credentials: {
    deviceId: string;
    privateKey: string;
    publicKey: string;
    deviceToken?: string;
  }): WebSocket {
    const ws = new WebSocket(`${this.SERVER_URL}`, {
      protocols: ['openclaw-gateway'],
    });

    ws.addEventListener('open', () => {
      // 1. 接收 challenge
      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          const nonce = msg.payload.nonce;

          // 2. 构建负载
          const payload = this.buildAuthPayload({
            deviceId: credentials.deviceId,
            nonce,
            deviceToken: credentials.deviceToken,
          });

          // 3. 签名
          const signature = this.signPayload(credentials.privateKey, payload);

          // 4. 发送 connect 请求
          ws.send(JSON.stringify({
            type: 'req',
            id: this.generateId(),
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'openclaw-h5',
                version: '1.0.0',
                platform: navigator.platform,
                mode: 'webchat',
              },
              role: 'operator',
              scopes: ['operator.admin'],
              device: {
                id: credentials.deviceId,
                publicKey: credentials.publicKey,
                signature,
                signedAt: Date.now(),
                nonce,
              },
              auth: {
                token: credentials.deviceToken,
              },
            },
          }));
        }
      });
    });

    return ws;
  }

  private buildAuthPayload(params: {
    deviceId: string;
    nonce: string;
    deviceToken?: string;
  }): string {
    const scopes = 'operator.admin,operator.approvals';
    const timestamp = Date.now();
    const token = params.deviceToken || '';

    return [
      'v2',
      params.deviceId,
      'openclaw-h5',
      'webchat',
      'operator',
      scopes,
      String(timestamp),
      token,
      params.nonce,
    ].join('|');
  }

  private signPayload(privateKey: string, payload: string): string {
    // 签名实现（需要使用 Web Crypto API）
    // ...
  }
}
```

---

## 八、关键文件位置

| 文件 | 功能 |
|------|------|
| `src/config/types.sandbox.ts` | 沙盒配置类型定义 |
| `src/agents/sandbox/context.ts` | 沙盒上下文解析 |
| `src/agents/sandbox/docker.ts` | Docker 沙盒管理 |
| `src/infra/device-identity.ts` | 设备身份管理 |
| `src/infra/device-pairing.ts` | 设备配对管理 |
| `src/gateway/server/ws-connection/message-handler.ts` | Gateway 连接处理 |

---

## 总结

### 沙盒部分

OpenClaw 中**只有以下组件**运行在 Docker 沙盒中：

1. **工具执行容器** - 隔离 Agent 调用的 bash/python 等工具
2. **浏览器控制容器** - 隔离用于控制的浏览器
3. **Agent 本身** - ❌ **不运行在沙盒中**，直接在 Host 进程

### 设备认证流程

**完整流程**：

1. **首次配对**（需共享 Token 或管理员批准）
   - 生成 Ed25519 密钥对
   - 请求配对 → 管理员批准
   - 获取 deviceToken

2. **后续连接**（设备签名认证）
   - 接收 challenge → 返回 nonce
   - 签名认证负载（含 deviceToken）
   - Gateway 验证签名 → 连接成功

**安全机制**：
- Ed25519 签名（行业标准）
- 时间戳验证（10分钟窗口）
- DeviceId 哈希验证
- 可撤销 deviceToken

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
