# OpenClaw 原生认证机制详解

## OpenClaw 原生支持的认证方式

### 1. Token 模式（共享 Token）- 最简单

**配置**：
```yaml
# ~/.openclaw/config.yml
gateway:
  auth:
    mode: token
    token: "shared-secret-token-here"
```

**特点**：
- ✅ 最简单，无需额外配置
- ❌ 所有客户端使用同一个 Token
- ❌ 无法区分不同设备
- ❌ Token 泄露风险高

**适用场景**：个人使用、可信网络

---

### 2. Password 模式

**配置**：
```yaml
gateway:
  auth:
    mode: password
    password: "your-password-here"
```

**特点**：
- 与 Token 模式类似，但使用密码
- Control UI 会显示密码输入框

**适用场景**：个人使用

---

### 3. Tailscale 模式（VPN 认证）

**配置**：
```yaml
gateway:
  auth:
    mode: token
    allowTailscale: true
```

**特点**：
- ✅ 无需 Token，基于 Tailscale 身份
- ✅ 自动密钥轮换
- ❌ 需要安装 Tailscale

**适用场景**：内网、边缘计算

---

### 4. **设备配对 + deviceToken（推荐）** ⭐

这是介于共享 Token 和复杂设备签名之间的**中间方案**！

#### 工作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    首次连接（配对流程）                          │
└─────────────────────────────────────────────────────────────────┘

1. 客户端生成设备身份（Ed25519 密钥对）
   ├─ deviceId: 从公钥派生（SHA-256）
   ├─ publicKey: 公钥
   └─ privateKey: 私钥（保存在客户端）

2. 客户端发送 connect 请求
   ├─ device.id
   ├─ device.publicKey
   ├─ device.signature（签名认证 payload）
   └─ auth.token（可选，共享 Token 或留空）

3. Gateway 验证设备签名
   ├─ 验证签名有效性
   ├─ 检查时间戳（10 分钟内）
   ├─ 检查 nonce（远程连接必需）

4. Gateway 检查设备是否已配对
   └─ 如果未配对，创建配对请求（pending）

5. 用户在 Control UI 中批准配对
   └─ 显示配对请求对话框

6. Gateway 生成 deviceToken
   ├─ 随机 UUID（无横杠）
   ├─ 保存到 ~/.openclaw/devices/paired.json
   └─ 返回给客户端

7. 客户端保存 deviceToken
   └─ 后续连接使用此 Token

┌─────────────────────────────────────────────────────────────────┐
│                    后续连接（已配对）                            │
└─────────────────────────────────────────────────────────────────┘

1. 客户端发送 connect 请求
   ├─ device.id
   ├─ device.publicKey
   ├─ device.signature
   └─ auth.token（deviceToken，不是共享 Token！）

2. Gateway 双重验证
   ├─ 验证设备签名（证明设备身份）
   └─ 验证 deviceToken（证明已配对）

3. 连接成功！
```

#### 配对存储

**存储位置**：`~/.openclaw/devices/paired.json`

```json
{
  "pairedByDeviceId": {
    "abc123...": {
      "deviceId": "abc123...",
      "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
      "displayName": "iPhone 15 Pro",
      "platform": "ios",
      "clientId": "webchat-ui",
      "clientMode": "webchat",
      "role": "operator",
      "roles": ["operator"],
      "scopes": ["operator.read", "operator.write"],
      "tokens": {
        "operator": {
          "token": "a1b2c3d4e5f6g7h8i9j0",  // deviceToken！
          "role": "operator",
          "scopes": ["operator.read", "operator.write"],
          "createdAtMs": 1736123456789,
          "rotatedAtMs": 1736123500000,
          "lastUsedAtMs": 1736123550000
        }
      },
      "createdAtMs": 1736123456789,
      "approvedAtMs": 1736123500000
    }
  }
}
```

#### 配对请求存储

**存储位置**：`~/.openclaw/devices/pending.json`

```json
{
  "pendingById": {
    "req-uuid-123": {
      "requestId": "req-uuid-123",
      "deviceId": "abc123...",
      "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
      "displayName": "New Device",
      "platform": "web",
      "role": "operator",
      "scopes": ["operator.read", "operator.write"],
      "ts": 1736123456789
    }
  }
}
```

#### 优势

| 特性 | 共享 Token | 设备配对 + deviceToken | 完整设备签名系统 |
|------|-----------|----------------------|-----------------|
| **安全性** | ❌ 低 | ✅ 中高 | ✅ 高 |
| **实现复杂度** | ✅ 简单 | ✅⭐ 简单（OpenClaw 内置） | ❌ 复杂（需自建） |
| **设备管理** | ❌ 无 | ✅ 内置配对系统 | ✅ 需自建 |
| **Token 管理** | ❌ 手动共享 | ✅ 自动生成 | ❌ 需自建 |
| **可撤销性** | ❌ 需改 Token | ✅ 可撤销单个设备 | ✅ 可撤销 |
| **多用户支持** | ❌ 不支持 | ⚠️ 需额外处理 | ✅ 支持 |

#### 为什么这是最佳选择？

**1. OpenClaw 内置功能**
- 无需自建认证系统
- 配对流程已实现
- deviceToken 自动生成和管理

**2. 比共享 Token 安全**
- 每个设备独立 Token
- 设备撤销不影响其他设备
- 设备签名验证防止伪造

**3. 比自建系统简单**
- 无需数据库
- 无需注册表服务
- 文件系统存储即可

**4. 用户体验好**
- 首次配对后自动连接
- 无需手动管理 Token
- Control UI 可视化管理

---

## 在 OAuth 2.0 系统中使用设备配对

### 方案：OAuth 2.0 + 设备配对（混合）

既然你的系统已经要求用户 OAuth 登录，可以结合 OpenClaw 的设备配对机制：

```
┌─────────────────────────────────────────────────────────────────┐
│                       认证层次                                   │
│                                                                  │
│  Layer 1: OAuth 2.0（系统级认证）                                │
│  └─ 用于所有功能的用户身份验证                                   │
│                                                                  │
│  Layer 2: 设备配对（OpenClaw 专用）                              │
│  └─ OpenClaw 功能的设备认证                                     │
│                                                                  │
│  Layer 3: sessionKey（用户隔离）                                │
│  └─ 每个用户独立会话                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 实现方案

#### 方案 A：每个用户一个 Gateway 实例（推荐）

```
┌────────────────────────────────────────────────────────────┐
│  用户 A                                                    │
│  ├─ OAuth 登录                                             │
│  ├─ 独立的 Gateway 实例（云端 Docker）                     │
│  └─ 设备配对存储在 Gateway 实例中                          │
│                                                            │
│  用户 B                                                    │
│  ├─ OAuth 登录                                             │
│  ├─ 独立的 Gateway 实例（云端 Docker）                     │
│  └─ 设备配对存储在 Gateway 实例中                          │
└────────────────────────────────────────────────────────────┘
```

**优点**：
- 完全隔离（用户之间看不到彼此）
- 设备配对存储独立
- 配置简单

**实现**：
- 每个用户分配独立的 Gateway 实例（云端 Docker）
- 使用 OAuth Token 交换临时访问 Token
- 设备配对在各自 Gateway 实例中管理

#### 方案 B：共享 Gateway + 多租户改造

```
┌────────────────────────────────────────────────────────────┐
│  共享 Gateway 实例                                          │
│  ├─ OAuth 认证中间件                                        │
│  ├─ 用户-实例映射                                           │
│  └─ 设备配对按用户隔离（需改造）                           │
└────────────────────────────────────────────────────────────┘
```

**需要改造**：
- 扩展 `device-pairing.ts`，添加 `userId` 字段
- 验证设备时检查设备属于哪个用户
- 将 `paired.json` 改为数据库存储

---

## 推荐方案总结

### 对于你的场景（OAuth 系统集成）

**推荐：方案 A（每个用户独立 Gateway）**

```
架构：

用户浏览器
  │
  ├─ OAuth 2.0 登录
  │
  ├─ 访问普通功能（Dashboard、Analytics）
  │   └─ 仅 OAuth Token 认证
  │
  └─ 访问 OpenClaw
      ├─ OAuth Token（用户身份）
      ├─ 设备配对（设备身份）
      │   ├─ 首次：配对流程
      │   └─ 后续：deviceToken
      └─ 独立 Gateway 实例（完全隔离）
```

**为什么这样做？**

1. **简单**：使用 OpenClaw 内置的设备配对功能
2. **安全**：设备级认证 + 用户级 OAuth
3. **隔离**：每个用户独立 Gateway 实例
4. **可维护**：无需修改 OpenClaw 代码

**不推荐的方案**：

- ❌ **纯共享 Token**：安全性太低
- ❌ **自建设备签名系统**：重复造轮子，OpenClaw 已内置
- ❌ **改造 OpenClaw 多租户**：增加复杂度，维护成本高

---

## 实施步骤

### 云端 Docker 部署

**1. 为每个用户启动独立 Gateway 实例**：

```bash
# 用户 A 的 Gateway
docker run -d \
  -v openclaw-user-a:/data \
  -p 18789:18789 \
  openclaw/gateway:latest

# 用户 B 的 Gateway
docker run -d \
  -v openclaw-user-b:/data \
  -p 18790:18789 \
  openclaw/gateway:latest
```

**2. 配置 API Gateway**：

```typescript
// 根据用户 ID 路由到不同 Gateway 实例

async function getUserGateway(userId: string) {
  const userInstance = await db.query(`
    SELECT instance_id, host, port
    FROM user_instances
    WHERE user_id = ?
  `, [userId]);

  return {
    gatewayUrl: `ws://${userInstance.host}:${userInstance.port}`,
  };
}
```

**3. 客户端实现**：

```typescript
// 首次连接：触发配对
async function connectToOpenClaw() {
  const oauthToken = await getOAuthToken();
  const userId = parseUserId(oauthToken);

  // 获取用户的 Gateway 实例
  const { gatewayUrl } = await getUserGateway(userId);

  // 生成设备身份
  const identity = await generateDeviceIdentity();

  // 连接（触发配对）
  const client = new GatewayBrowserClient({
    url: gatewayUrl,
    deviceAuth: identity,
  });

  // 如果未配对，会收到配对请求
  // 用户在 Control UI 中批准
}
```

---

## 相关文件

**OpenClaw 认证代码**：
- `src/gateway/auth.ts` - Token/Password 认证
- `src/gateway/server/ws-connection/message-handler.ts` - 设备配对验证
- `src/infra/device-identity.ts` - 设备身份生成
- `src/infra/device-pairing.ts` - 配对存储和 deviceToken 管理
- `src/gateway/device-auth.ts` - 设备认证 payload 构建

**存储位置**：
- `~/.openclaw/devices/paired.json` - 已配对设备
- `~/.openclaw/devices/pending.json` - 待配对请求
- `~/.openclaw/identity/device.json` - 设备身份（客户端）

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
