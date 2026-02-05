# Web UI Chat 功能实现分析文档

## 概述

本文档详细分析 OpenClaw Web UI 的 Chat 功能实现，包括架构设计、协议交互、状态管理和消息处理流程，为后续 H5 客户端开发提供参考。

---

## 架构概览

### 核心模块

```
ui/src/ui/
├── app.ts                    # 主应用入口
├── app-chat.ts               # Chat 业务逻辑层
├── app-gateway.ts            # Gateway 连接管理
├── gateway.ts                # WebSocket 客户端实现
├── controllers/
│   └── chat.ts               # Chat 控制器（状态管理）
├── views/
│   └── chat.ts               # Chat UI 渲染层
├── chat/
│   ├── message-normalizer.ts # 消息标准化
│   ├── grouped-render.ts     # 消息分组渲染
│   └── message-extract.ts    # 消息内容提取
├── device-identity.ts        # 设备身份管理
└── device-auth.ts            # 设备认证令牌管理
```

### 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                     Views Layer                         │
│  (chat.ts - Lit 组件，负责 UI 渲染和用户交互)             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Controllers Layer                       │
│  (chat.ts - 状态管理，业务逻辑协调)                       │
│  - ChatState: 消息列表、发送状态、stream 文本等           │
│  - loadChatHistory()                                     │
│  - sendChatMessage()                                     │
│  - handleChatEvent()                                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Business Logic Layer                    │
│  (app-chat.ts - 高级业务逻辑)                            │
│  - 消息队列管理                                           │
│  - 命令处理（/stop, /new, /reset）                        │
│  - Avatar 加载                                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Gateway Client Layer                    │
│  (gateway.ts - WebSocket 客户端)                         │
│  - 连接管理                                               │
│  - 请求/响应处理                                          │
│  - 事件分发                                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
              Gateway WebSocket Server
```

---

## 核心数据结构

### ChatState (控制器状态)

```typescript
// ui/src/ui/controllers/chat.ts

export type ChatState = {
  client: GatewayBrowserClient | null;    // Gateway 客户端实例
  connected: boolean;                       // WebSocket 连接状态
  sessionKey: string;                       // 当前会话键
  chatLoading: boolean;                     // 历史加载中
  chatMessages: unknown[];                  // 消息列表
  chatThinkingLevel: string | null;         // 思考级别
  chatSending: boolean;                     // 发送中
  chatMessage: string;                      // 输入框文本
  chatAttachments: ChatAttachment[];        // 图片附件
  chatRunId: string | null;                 // 当前运行的 ID
  chatStream: string | null;                // 流式文本（AI 回复）
  chatStreamStartedAt: number | null;       // 流开始时间
  lastError: string | null;                 // 错误信息
};
```

### ChatEventPayload (事件负载)

```typescript
export type ChatEventPayload = {
  runId: string;                             // 运行 ID
  sessionKey: string;                        // 会话键
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;                         // 消息内容
  errorMessage?: string;                     // 错误信息
};
```

### ChatAttachment (附件)

```typescript
export type ChatAttachment = {
  id: string;                                // 附件 ID
  dataUrl: string;                           // base64 数据
  mimeType: string;                          // MIME 类型
};
```

---

## Gateway WebSocket 协议

### 连接流程

```
客户端                              Gateway 服务器
  │                                    │
  │  1. WebSocket 连接                  │
  │────────────────────────────────────>│
  │                                    │
  │  2. 收到 connect.challenge 事件      │
  │<────────────────────────────────────│
  │  { nonce: "..." }                   │
  │                                    │
  │  3. 发送 connect 请求               │
  │────────────────────────────────────>│
  │  {                                  │
  │    type: "req",                     │
  │    method: "connect",               │
  │    params: {                        │
  │      minProtocol: 3,                │
  │      maxProtocol: 3,                │
  │      client: { ... },               │
  │      device: {                      │
  │        id: "...",                   │
  │        publicKey: "...",            │
  │        signature: "...",            │
  │        signedAt: ...,               │
  │        nonce: "..."                 │
  │      },                             │
  │      auth: { token: "..." }         │
  │    }                                │
  │  }                                  │
  │                                    │
  │  4. 收到 hello-ok 响应              │
  │<────────────────────────────────────│
  │  {                                  │
  │    type: "hello-ok",                │
  │    protocol: 3,                     │
  │    auth: {                          │
  │      deviceToken: "...",            │
  │      role: "operator",              │
  │      scopes: [...]                  │
  │    }                                │
  │  }                                  │
  │                                    │
  │  5. 连接成功，可以发送请求            │
  │                                    │
```

### 帧格式

#### 请求帧 (Request)

```typescript
{
  type: "req",
  id: string,              // 唯一请求 ID（UUID）
  method: string,          // 方法名（如 "chat.send"）
  params?: unknown         // 方法参数
}
```

#### 响应帧 (Response)

```typescript
{
  type: "res",
  id: string,              // 对应的请求 ID
  ok: boolean,             // 是否成功
  payload?: unknown,       // 成功时的返回数据
  error?: {                // 失败时的错误信息
    code: string,
    message: string,
    details?: unknown
  }
}
```

#### 事件帧 (Event)

```typescript
{
  type: "event",
  event: string,           // 事件名（如 "chat"）
  payload?: unknown,       // 事件负载
  seq?: number,            // 序列号（用于检测丢包）
  stateVersion?: {         // 状态版本
    presence: number,
    health: number
  }
}
```

---

## Chat 协议详解

### 1. chat.history (加载历史)

**请求**:
```json
{
  "type": "req",
  "id": "uuid-1",
  "method": "chat.history",
  "params": {
    "sessionKey": "main",
    "limit": 200
  }
}
```

**响应**:
```json
{
  "type": "res",
  "id": "uuid-1",
  "ok": true,
  "payload": {
    "sessionKey": "main",
    "sessionId": "sess-uuid",
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "Hello" }
        ],
        "timestamp": 1234567890
      },
      {
        "role": "assistant",
        "content": [
          { "type": "text", "text": "Hi there!" }
        ],
        "timestamp": 1234567891
      }
    ],
    "thinkingLevel": "off"
  }
}
```

### 2. chat.send (发送消息)

**请求**:
```json
{
  "type": "req",
  "id": "uuid-2",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "What's the weather?",
    "idempotencyKey": "msg-uuid",
    "deliver": false,
    "attachments": [
      {
        "type": "image",
        "mimeType": "image/png",
        "content": "base64-data..."
      }
    ]
  }
}
```

**响应**:
```json
{
  "type": "res",
  "id": "uuid-2",
  "ok": true,
  "payload": {
    "runId": "msg-uuid",
    "status": "started"
  }
}
```

### 3. chat 事件 (流式更新)

**Delta 事件**:
```json
{
  "type": "event",
  "event": "chat",
  "seq": 1,
  "payload": {
    "runId": "msg-uuid",
    "sessionKey": "main",
    "state": "delta",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "The weather today is..." }
      ]
    }
  }
}
```

**Final 事件**:
```json
{
  "type": "event",
  "event": "chat",
  "seq": 2,
  "payload": {
    "runId": "msg-uuid",
    "sessionKey": "main",
    "state": "final",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "The weather today is sunny." }
      ],
      "timestamp": 1234567892,
      "stopReason": "stop"
    }
  }
}
```

### 4. chat.abort (中止运行)

**请求**:
```json
{
  "type": "req",
  "id": "uuid-3",
  "method": "chat.abort",
  "params": {
    "sessionKey": "main",
    "runId": "msg-uuid"
  }
}
```

**响应**:
```json
{
  "type": "res",
  "id": "uuid-3",
  "ok": true,
  "payload": {
    "ok": true,
    "aborted": true,
    "runIds": ["msg-uuid"]
  }
}
```

---

## 消息处理流程

### 发送消息流程

```typescript
// ui/src/ui/controllers/chat.ts

export async function sendChatMessage(
  state: ChatState,
  message: string,
  attachments?: ChatAttachment[],
): Promise<string | null> {
  // 1. 验证输入
  const msg = message.trim();
  if (!msg && !hasAttachments) return null;

  // 2. 立即添加用户消息到本地列表
  state.chatMessages = [
    ...state.chatMessages,
    {
      role: "user",
      content: contentBlocks,  // 文本 + 图片
      timestamp: Date.now(),
    },
  ];

  // 3. 初始化流状态
  const runId = generateUUID();
  state.chatRunId = runId;
  state.chatStream = "";
  state.chatStreamStartedAt = Date.now();
  state.chatSending = true;

  // 4. 转换附件格式
  const apiAttachments = hasAttachments
    ? attachments.map(att => ({
        type: "image",
        mimeType: att.mimeType,
        content: base64Data,
      }))
    : undefined;

  // 5. 发送请求
  try {
    await state.client.request("chat.send", {
      sessionKey: state.sessionKey,
      message: msg,
      deliver: false,
      idempotencyKey: runId,
      attachments: apiAttachments,
    });
    return runId;
  } catch (err) {
    // 错误处理
    state.chatRunId = null;
    state.chatStream = null;
    state.lastError = String(err);
    return null;
  } finally {
    state.chatSending = false;
  }
}
```

### 处理事件流程

```typescript
// ui/src/ui/controllers/chat.ts

export function handleChatEvent(
  state: ChatState,
  payload?: ChatEventPayload
) {
  if (!payload || payload.sessionKey !== state.sessionKey) {
    return null;
  }

  // 特殊处理：其他 run 的 final 事件（如 sub-agent）
  if (payload.runId && state.chatRunId &&
      payload.runId !== state.chatRunId) {
    if (payload.state === "final") {
      return "final";  // 触发 history 刷新
    }
    return null;
  }

  // Delta 事件：更新流文本
  if (payload.state === "delta") {
    const next = extractText(payload.message);
    if (typeof next === "string") {
      const current = state.chatStream ?? "";
      if (!current || next.length >= current.length) {
        state.chatStream = next;
      }
    }
  }

  // Final 事件：清除流状态
  else if (payload.state === "final") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  }

  // Aborted 事件：中止
  else if (payload.state === "aborted") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
  }

  // Error 事件：错误
  else if (payload.state === "error") {
    state.chatStream = null;
    state.chatRunId = null;
    state.chatStreamStartedAt = null;
    state.lastError = payload.errorMessage ?? "chat error";
  }

  return payload.state;
}
```

### 关键设计决策

#### 1. 立即显示用户消息

```typescript
// 发送时立即添加到本地，不等待服务器确认
state.chatMessages = [
  ...state.chatMessages,
  { role: "user", content: ..., timestamp: Date.now() }
];
```

**原因**：
- 提升用户体验（即时反馈）
- 避免时序问题（history 可能还未写入）
- 与 Web 端架构一致

#### 2. Delta 替换而非累积

```typescript
if (!current || next.length >= current.length) {
  state.chatStream = next;  // 直接替换
}
```

**原因**：
- Gateway 发送的 delta 已经是累积文本
- 客户端只需显示，无需再次累积

#### 3. Final 时清除 Stream，不请求 History

```typescript
if (payload.state === "final") {
  state.chatStream = null;
  state.chatRunId = null;
  // 不调用 loadChatHistory()
}
```

**原因**：
- 消息已经通过 delta 显示完整
- 避免时序问题（history 写入延迟）
- 减少不必要的网络请求

#### 4. 其他 run 的 final 触发 history 刷新

```typescript
if (payload.runId !== state.chatRunId && payload.state === "final") {
  return "final";  // 调用者会刷新 history
}
```

**原因**：
- Sub-agent 完成时，需要显示其回复
- 通过 history 获取完整的对话上下文

---

## UI 渲染层

### 消息分组渲染

```typescript
// ui/src/ui/views/chat.ts

function groupMessages(items: ChatItem[]): Array<ChatItem | MessageGroup> {
  const result: Array<ChatItem | MessageGroup> = [];
  let currentGroup: MessageGroup | null = null;

  for (const item of items) {
    if (item.kind !== "message") {
      if (currentGroup) {
        result.push(currentGroup);
        currentGroup = null;
      }
      result.push(item);
      continue;
    }

    const normalized = normalizeMessage(item.message);
    const role = normalizeRoleForGrouping(normalized.role);

    // 角色变化时创建新分组
    if (!currentGroup || currentGroup.role !== role) {
      if (currentGroup) {
        result.push(currentGroup);
      }
      currentGroup = {
        kind: "group",
        role,
        messages: [{ message: item.message, key: item.key }],
        timestamp: normalized.timestamp,
      };
    } else {
      currentGroup.messages.push({ message: item.message, key: item.key });
    }
  }

  if (currentGroup) {
    result.push(currentGroup);
  }
  return result;
}
```

**分组策略**：
- 同一角色的连续消息合并为一组
- 提升阅读体验（减少视觉跳跃）

### Chat 组件属性

```typescript
export type ChatProps = {
  // 数据
  sessionKey: string;
  messages: unknown[];
  toolMessages: unknown[];
  stream: string | null;
  streamStartedAt: number | null;
  sessions: SessionsListResult | null;

  // 状态
  loading: boolean;
  sending: boolean;
  connected: boolean;
  canSend: boolean;
  disabledReason: string | null;
  error: string | null;

  // 配置
  thinkingLevel: string | null;
  showThinking: boolean;
  focusMode: boolean;
  assistantName: string;
  assistantAvatar: string | null;

  // 附件
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (attachments: ChatAttachment[]) => void;

  // 回调
  onRefresh: () => void;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  onAbort?: () => void;
  onNewSession: () => void;
  // ...
};
```

---

## 消息队列机制

### 队列结构

```typescript
type ChatQueueItem = {
  id: string;
  text: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  refreshSessions?: boolean;
};
```

### 队列处理逻辑

```typescript
// ui/src/ui/app-chat.ts

async function sendChatMessageNow(
  host: ChatHost,
  message: string,
  opts?: { attachments?: ChatAttachment[]; ... }
) {
  // 发送消息
  const runId = await sendChatMessage(host, message, opts?.attachments);

  // 发送成功后，检查队列
  if (runId && !host.chatRunId) {
    void flushChatQueue(host);  // 发送下一条
  }
}

async function flushChatQueue(host: ChatHost) {
  if (!host.connected || isChatBusy(host)) {
    return;  // 忙碌时跳过
  }

  const [next, ...rest] = host.chatQueue;
  if (!next) return;

  host.chatQueue = rest;

  const ok = await sendChatMessageNow(host, next.text, {
    attachments: next.attachments,
  });

  if (!ok) {
    host.chatQueue = [next, ...host.chatQueue];  // 失败则重新入队
  }
}
```

**使用场景**：
- 用户快速连续发送多条消息
- 命令触发需要刷新会话（/reset）

---

## 命令处理

### 停止命令

```typescript
function isChatStopCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized === "/stop" ||
         normalized === "stop" ||
         normalized === "esc" ||
         normalized === "abort";
}

export async function handleAbortChat(host: ChatHost) {
  if (!host.connected) return;
  host.chatMessage = "";
  await abortChatRun(host);
}
```

### 重置命令

```typescript
function isChatResetCommand(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized === "/new" ||
         normalized === "/reset" ||
         normalized.startsWith("/new ") ||
         normalized.startsWith("/reset ");
}

export async function handleSendChat(host: ChatHost, messageOverride?: string) {
  // ...

  const refreshSessions = isChatResetCommand(message);

  if (isChatStopCommand(message)) {
    await handleAbortChat(host);
    return;
  }

  // ...
}
```

---

## 设备认证机制

### 设备身份生成

```typescript
// ui/src/ui/device-identity.ts

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const STORAGE_KEY = "openclaw-device-identity-v1";

  // 尝试加载现有身份
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    return {
      deviceId: parsed.deviceId,
      publicKey: parsed.publicKey,
      privateKey: parsed.privateKey,
    };
  }

  // 生成新身份（Ed25519 密钥对）
  const privateKey = utils.randomSecretKey();
  const publicKey = await getPublicKeyAsync(privateKey);
  const deviceId = await fingerprintPublicKey(publicKey);  // SHA-256

  const identity = {
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

### 设备令牌管理

```typescript
// ui/src/ui/device-auth.ts

// 存储设备令牌
export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  const STORAGE_KEY = "openclaw.device.auth.v1";

  const entry: DeviceAuthEntry = {
    token: params.token,
    role: params.role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };

  // 存储到 localStorage
  const store = {
    version: 1,
    deviceId: params.deviceId,
    tokens: { [params.role]: entry },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

  return entry;
}

// 加载设备令牌
export function loadDeviceAuthToken(params: {
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  if (parsed.deviceId !== params.deviceId) return null;

  return parsed.tokens[params.role] || null;
}
```

---

## 连接时序图

```
客户端                      Gateway 服务器
  │                            │
  │  WebSocket 连接             │
  │───────────────────────────>│
  │                            │
  │  connect.challenge 事件     │
  │<───────────────────────────│
  │  { nonce: "abc123" }       │
  │                            │
  │  connect 请求              │
  │───────────────────────────>│
  │  { device: {               │
  │      id: "device-id",       │
  │      publicKey: "...",     │
  │      signature: "...",     │
  │      nonce: "abc123"       │
  │    } }                     │
  │                            │
  │  验证签名                   │
  │                            │✓ 签名有效
  │                            │
  │  hello-ok 响应             │
  │<───────────────────────────│
  │  { auth: {                 │
  │      deviceToken: "...",   │
  │      role: "operator",     │
  │      scopes: [...]         │
  │    } }                     │
  │                            │
  │  存储 deviceToken           │
  │  (localStorage)             │
  │                            │
  │  连接成功                   │
  │                            │
  │  chat.send 请求             │
  │───────────────────────────>│
  │  { params: {               │
  │      message: "Hello",     │
  │      runId: "run-1"        │
  │    } }                     │
  │                            │
  │  chat 事件流                │
  │<───────────────────────────│
  │  { seq: 1,                 │
  │    payload: {              │
  │      state: "delta",       │
  │      message: { text: "H"} │
  │    } }                     │
  │<───────────────────────────│
  │  { seq: 2,                 │
  │    payload: {              │
  │      state: "delta",       │
  │      message: { text: "He"}│
  │    } }                     │
  │                            │
  │  chat 事件流                │
  │<───────────────────────────│
  │  { seq: 3,                 │
  │    payload: {              │
  │      state: "final",       │
  │      message: { text: "Hello!" }
  │    } }                     │
  │                            │
```

---

## 最佳实践总结

### 1. 状态管理

- **单一数据源**：所有聊天状态集中在 `ChatState`
- **不可变更新**：使用展开运算符创建新数组
- **即时反馈**：发送时立即更新本地状态

### 2. 错误处理

- **网络错误**：显示友好错误消息，保持应用稳定
- **验证失败**：在发送前验证输入
- **超时处理**：Gateway 客户端自动重连

### 3. 性能优化

- **消息限制**：只渲染最近 200 条消息
- **虚拟滚动**：长列表按需渲染（可扩展）
- **请求去重**：使用 idempotencyKey 防止重复

### 4. 用户体验

- **流式显示**：delta 事件提供实时反馈
- **消息队列**：快速发送时自动排队
- **快捷命令**：/stop, /new 等提升效率

---

## 相关文件清单

| 文件路径 | 功能描述 |
|---------|---------|
| `ui/src/ui/controllers/chat.ts` | Chat 状态管理和业务逻辑 |
| `ui/src/ui/app-chat.ts` | Chat 高级业务逻辑 |
| `ui/src/ui/gateway.ts` | WebSocket 客户端 |
| `ui/src/ui/views/chat.ts` | Chat UI 组件 |
| `ui/src/ui/device-identity.ts` | 设备身份管理 |
| `ui/src/ui/device-auth.ts` | 设备令牌管理 |
| `src/gateway/server-methods/chat.ts` | Gateway chat 方法实现 |
| `src/gateway/protocol/schema/frames.ts` | 协议帧定义 |
| `src/gateway/auth.ts` | 认证逻辑 |

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
