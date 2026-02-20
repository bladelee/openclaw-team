# A2UI 消息触发场景分析

## 概述

本文档详细分析什么情况会触发 A2UI 类型的消息，以及完整的消息流程。

---

## A2UI 消息类型

### Gateway WebSocket 消息格式

```typescript
{
  type: 'event',
  event: 'a2ui',
  payload: {
    surfaceId: string;
    messages: A2UIMessage[];
  }
}
```

### A2UI 消息类型（v0.8 协议）

```typescript
type A2UIMessage =
  | { surfaceUpdate: SurfaceUpdate }
  | { beginRendering: BeginRendering }
  | { dataModelUpdate: DataModelUpdate }
  | { deleteSurface: DeleteSurface };
```

---

## 触发场景

### 场景 1: Agent 使用 canvas 工具的 a2ui_push 动作

**最常见场景**：AI Agent 主动推送 A2UI 内容到节点 Canvas。

**触发条件**：
- Agent 调用 `canvas` 工具
- 参数 `action: "a2ui_push"`
- 提供 `jsonl` 或 `jsonlPath` 参数

**完整流程**：

```
1. Agent 执行工具调用
   canvas(action="a2ui_push", jsonl="...")

2. Gateway 接收请求
   POST /gateway/v1/node.invoke
   {
     nodeId: "xxx",
     command: "canvas.a2ui.pushJSONL",
     params: { jsonl: "..." }
   }

3. Gateway 转发到移动节点
   WebSocket -> node: { type: "event", event: "canvas.a2ui.pushJSONL", payload: { jsonl: "..." } }

4. 移动节点接收 JSONL
   iOS/Android 节点解析 JSONL 消息

5. 移动节点显示 Canvas
   自动导航到: http://gateway:18789/__openclaw__/a2ui/

6. A2UI 页面通过 WebSocket 接收消息
   Gateway 发送 event: 'a2ui' 消息到连接的客户端
```

**示例 JSONL 内容**：

```jsonl
{"surfaceUpdate": {"surfaceId": "main", "components": [{"id": "root", "component": {"Column": {"children": {"explicitList": ["title"]}}}}, {"id": "title", "component": {"Text": {"text": {"literalString": "Hello A2UI"}}}}}]}}
{"beginRendering": {"surfaceId": "main", "root": "root"}}
```

---

### 场景 2: 移动节点自动显示 Canvas

**触发条件**：
- 移动节点（iOS/Android）连接到 Gateway
- Gateway 提供 Canvas Host URL
- 移动节点收到连接成功事件

**完整流程**：

```
1. 移动节点启动并连接 Gateway
   WebSocket 连接到 ws://gateway:18789

2. Gateway 返回 hello-ok 响应
   {
     type: "hello-ok",
     canvasHostUrl: "http://localhost:18789"
   }

3. 移动节点解析 Canvas Host URL
   iOS: await self.gateway.currentCanvasHostUrl()
   => "http://localhost:18789"

4. 移动节点自动导航到 A2UI
   screen.navigate(to: "http://localhost:18789/__openclaw__/a2ui/?platform=ios")

5. A2UI 页面加载
   通过 WebSocket 等待 A2UI 消息
```

**iOS 代码示例**：

```swift
// NodeAppModel.swift
private func showA2UIOnConnectIfNeeded() async {
    guard let a2uiUrl = await self.resolveA2UIHostURL() else { return }
    let current = self.screen.urlString.trimmingCharacters(in: .whitespacesAndNewlines)
    if current.isEmpty || current == self.lastAutoA2uiURL {
        self.screen.navigate(to: a2uiUrl)
        self.lastAutoA2uiURL = a2uiUrl
    }
}

private func resolveA2UIHostURL() async -> String? {
    guard let raw = await self.gateway.currentCanvasHostUrl() else { return nil }
    let base = URL(string: raw)
    return base?.appendingPathComponent("__openclaw__/a2ui/").absoluteString + "?platform=ios"
}
```

---

### 场景 3: 用户点击 A2UI 按钮触发动作

**触发条件**：
- 用户点击 A2UI 界面中的按钮
- A2UI 组件触发 action 事件
- 移动节点捕获 action 并发送给 Gateway

**完整流程**：

```
1. 用户点击 A2UI 按钮
   <Button action={name: "submit", surfaceId: "main"} />

2. A2UI 触发 DOM 事件
   document.dispatchEvent(new CustomEvent('a2uiaction', {
     detail: {
       eventType: 'a2ui.action',
       action: { name: 'submit', surfaceId: 'main' }
     }
   }))

3. 移动节点捕获事件
   iOS: ScreenController 的 a2uiActionHandler 捕获
   Android: CanvasA2UIActionMessageHandler 捕获

4. 移动节点格式化消息并发送到 Gateway
   格式化为 Agent 消息:
   "ACTION: [submit] (main, component-id@ios-node)"

5. Gateway 接收消息并发送给 Agent
   chat.send 事件，包含用户的 action

6. Agent 处理 action 并可能返回新的 A2UI
   Agent 可以调用 canvas.a2ui_push 更新界面
```

**iOS 代码示例**：

```swift
// NodeAppModel.swift
private func handleCanvasA2UIAction(body: [String: Any]) async {
    guard let name = OpenClawCanvasA2UIAction.extractActionName(userAction) else { return }

    let messageContext = OpenClawCanvasA2UIAction.AgentMessageContext(
        actionName: name,
        session: .init(key: sessionKey, surfaceId: surfaceId),
        component: .init(id: sourceComponentId, host: host, instanceId: instanceId),
        contextJSON: contextJSON
    )
    let message = OpenClawCanvasA2UIAction.formatAgentMessage(messageContext)

    try await self.sendAgentRequest(link: AgentDeepLink(
        message: message,
        sessionKey: sessionKey,
        thinking: "low",
        deliver: false
    ))

    // 执行 JS 返回结果状态
    let js = OpenClawCanvasA2UIAction.jsDispatchA2UIActionStatus(
        actionId: actionId,
        ok: ok,
        error: errorText
    )
    try await self.screen.eval(javaScript: js)
}
```

---

### 场景 4: 数据模型更新

**触发条件**：
- Agent 需要动态更新 A2UI 中的数据
- 不需要重新渲染整个界面

**完整流程**：

```
1. Agent 推送数据模型更新
   canvas.a2ui_push(jsonl: 包含 dataModelUpdate 的 JSONL)

2. Gateway 转发到移动节点
   event: 'a2ui' -> payload: { messages: [{ dataModelUpdate: {...} }] }

3. A2UI React 接收并应用更新
   window.openclawA2UI.applyMessages([{ dataModelUpdate: {...} }])

4. 组件自动重新渲染
   使用新数据更新组件显示
```

**示例 JSONL**：

```jsonl
{"dataModelUpdate": {"surfaceId": "main", "contents": [{"key": "progress", "valueNumber": 75}]}}
```

---

## A2UI 协议消息详解

### 1. surfaceUpdate

定义或更新 surface 的组件树结构。

```json
{
  "surfaceUpdate": {
    "surfaceId": "main",
    "components": [
      {
        "id": "root",
        "component": {
          "Column": {
            "children": { "explicitList": ["title", "button"] }
          }
        }
      },
      {
        "id": "title",
        "component": {
          "Text": {
            "text": { "literalString": "Hello" }
          }
        }
      },
      {
        "id": "button",
        "component": {
          "Button": {
            "text": { "literalString": "Click" },
            "action": {
              "name": "click",
              "surfaceId": "main"
            }
          }
        }
      }
    ]
  }
}
```

### 2. beginRendering

开始渲染指定的 surface。

```json
{
  "beginRendering": {
    "surfaceId": "main",
    "root": "root"
  }
}
```

### 3. dataModelUpdate

更新数据模型中的值，组件可以通过路径引用。

```json
{
  "dataModelUpdate": {
    "surfaceId": "main",
    "contents": [
      { "key": "user.name", "valueString": "张三" },
      { "key": "progress", "valueNumber": 60 },
      { "key": "isLoading", "valueBoolean": true }
    ]
  }
}
```

在组件中使用路径引用：
```json
{
  "Text": {
    "text": { "path": "user.name" }
  }
}
```

### 4. deleteSurface

删除指定的 surface。

```json
{
  "deleteSurface": {
    "surfaceId": "main"
  }
}
```

---

## 测试 C 场景详细说明

### 场景描述

测试 A2UI 消息在 app-h5 中的完整流程：
1. 用户通过 app-h5 发送消息
2. Agent 收到消息后决定显示 A2UI
3. Agent 调用 canvas.a2ui_push
4. Gateway 发送 a2ui 事件到 WebSocket
5. app-h5 接收 a2ui 事件并渲染组件

### 测试步骤

#### Step 1: 准备环境

```bash
# 启动 Gateway
pnpm gateway:dev

# 启动 app-h5
pnpm app:h5:dev
```

#### Step 2: 连接并发送消息

在 app-h5 中发送消息：
```
"显示一个包含按钮和进度条的界面"
```

#### Step 3: Agent 推送 A2UI

Agent 应该调用：
```
canvas(action="a2ui_push", jsonl='
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","progress","button"]}}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
')
```

#### Step 4: 验证消息流

1. 打开浏览器开发者工具 → Network → WS
2. 观察收到的 WebSocket 消息
3. 应该看到 `event: 'a2ui'` 类型的消息

```json
{
  "type": "event",
  "event": "a2ui",
  "payload": {
    "surfaceId": "main",
    "messages": [...]
  }
}
```

#### Step 5: 验证界面渲染

app-h5 应该：
1. 接收 a2ui 事件
2. 解析 A2UI 消息
3. 使用 a2ui-react 渲染组件
4. 显示界面

### 预期结果

- ✅ A2UI 消息正确接收
- ✅ 界面组件正确渲染
- ✅ 点击按钮触发 action
- ✅ action 正确发送到 Gateway
- ✅ Agent 收到 action 并响应

---

## 与其他系统的交互

### 与 Chat 系统的关系

```
用户发送 Chat 消息
    ↓
Agent 处理并决定返回 Chat 或 A2UI
    ↓
├─ Chat 返回: event: 'chat', payload: { message: {...} }
└─ A2UI 返回: event: 'a2ui', payload: { messages: [...] }
```

### 与 Canvas 系统的关系

```
Canvas (导航模式)
    ↓
showLocalCanvas() → 显示默认 Canvas 页面
    ↓
用户触发 Agent 操作
    ↓
Agent 调用 canvas.a2ui_push
    ↓
自动切换到 A2UI 渲染
```

---

## 关键文件参考

| 文件 | 功能 |
|------|------|
| `src/agents/tools/canvas-tool.ts` | Agent canvas 工具实现 |
| `src/cli/nodes-cli/register.canvas.ts` | CLI canvas 命令 |
| `src/canvas-host/a2ui-react/` | A2UI React 渲染引擎 |
| `apps/ios/Sources/Model/NodeAppModel.swift` | iOS A2UI 处理 |
| `apps/android/.../NodeRuntime.kt` | Android A2UI 处理 |

---

**文档版本**: 1.0
**创建日期**: 2026-02-06
