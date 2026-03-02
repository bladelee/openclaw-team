# App-H5 WebSocket 聊天功能实现总结

**日期**: 2025-02-28
**版本**: v1.0

## 1. 概述

本文档总结了 H5 应用中实例聊天功能和设置的完整实现，包括从旧的独立 Chat/Settings 页面迁移到新的实例级 Chat+Settings+Info 集成架构的全部变更。

---

## 2. 架构变更

### 2.1 旧架构（已废弃）

```
App
├── /chat (独立页面)        ← 全局单例 Chat，通过 WebSocket 连接 Gateway
├── /settings (独立页面)    ← 全局 Gateway 连接配置
└── /instances (实例列表)
```

**特点**：
- Chat 和 Settings 是独立的全局页面
- 通过 `AppContext` 管理全局 `GatewayService`
- 所有实例共享一个 WebSocket 连接
- 需要在 Settings 中手动配置 Gateway 地址和 Token

### 2.2 新架构（当前实现）

```
App
└── /instances
    ├── /instances                     ← 实例列表页
    └── /instances/:instanceId         ← 实例详情页（Chat 首屏）
        ├── Header (操作按钮)
        ├── Chat (默认视图)             ← 实例专属聊天
        ├── Info (实例信息)             ← 从更多菜单切换
        └── Settings (底部抽屉)        ← 实例专属配置
```

**特点**：
- 每个实例有独立的 Chat 和 Settings
- Settings 作为底部抽屉（Bottom Sheet），不是独立页面
- 每个实例有独立的 WebSocket 连接配置
- 配置存储在 `localStorage`，key 为 `instance-{instanceId}`
- 使用 A2UI 深色主题设计规范

---

## 3. 新增文件

### 3.1 WebSocket 管理 Hook

**文件**: `/src/hooks/useWebSocket.ts`

**功能**：
- WebSocket 连接管理（连接、断开、重连）
- 消息发送和接收
- 连接状态追踪
- 自动处理认证参数（token、role）

**核心 API**：
```typescript
interface WebSocketConfig {
  url: string;              // WebSocket 地址
  token?: string;           // 认证 Token（可选）
  role?: "operator" | "node";  // 用户角色
  onMessage?: (msg) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (err) => void;
}

const {
  isConnected,     // 连接状态
  isConnecting,    // 连接中状态
  error,           // 错误信息
  connect,         // 连接方法
  disconnect,      // 断开方法
  send,            // 发送消息方法
} = useWebSocket(config);
```

**实现细节**：
- WebSocket URL 构建时自动添加 `?token=xxx&role=xxx` 参数
- 连接失败时自动清理状态
- 组件卸载时自动断开连接
- 支持 JSON 格式的消息协议

---

## 4. 修改文件清单

### 4.1 InstanceDetailPage.tsx（主页面）

**路径**: `/src/pages/instances/InstanceDetailPage.tsx`

**变更内容**：
1. 添加事件监听器，响应从 Chat 触发的"打开设置"事件
2. 设置作为底部抽屉（Bottom Sheet）形式弹出
3. 支持三种视图模式切换：Chat（默认）、Info、Settings

```typescript
// 新增代码
useEffect(() => {
  const handleOpenSettings = () => {
    openSettings();
  };
  window.addEventListener("open-instance-settings", handleOpenSettings);
  return () => {
    window.removeEventListener("open-instance-settings", handleOpenSettings);
  };
}, []);
```

### 4.2 InstanceSettings.tsx（设置组件）

**路径**: `/src/pages/instances/components/InstanceSettings.tsx`

**新增功能**：

#### 4.2.1 基本信息编辑
- 实例名称编辑（已存在）
- 实例 ID、类型、健康状态展示（已存在）

#### 4.2.2 Gateway 连接配置（新增）

```typescript
interface GatewayConfig {
  wsUrl: string;              // WebSocket 地址，如 ws://192.168.1.100:18789
  authToken: string;          // 认证 Token
  userRole: "operator" | "node";  // 用户角色
}
```

**UI 配置项**：
1. **连接状态指示器**：显示已连接/未连接状态
2. **WebSocket 地址**：文本输入框，支持 `ws://` 和 `wss://` 协议
3. **认证 Token**：密码输入框，用于 operator 模式
4. **用户角色**：下拉选择，operator 或 node
5. **连接/断开按钮**：手动控制连接
6. **保存配置按钮**：保存到 localStorage

**配置持久化**：
```typescript
// 保存
const storageKey = `instance-${instance.instanceId}`;
localStorage.setItem(storageKey, JSON.stringify({
  wsUrl,
  authToken,
  userRole,
}));

// 加载（组件初始化时）
useEffect(() => {
  const savedConfig = localStorage.getItem(`instance-${instance.instanceId}`);
  // 恢复配置...
}, [instance.instanceId]);
```

**自动 URL 生成逻辑**：
```typescript
if (instance.port) {
  // 硬件实例：ws://{IP}:{port}
  setWsUrl(`ws://${baseUrl}:${instance.port}`);
} else if (instance.url) {
  // 云实例/托管实例：wss://{host} 或 ws://{host}
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  setWsUrl(`${wsProtocol}//${url.host}`);
}
```

#### 4.2.3 连接信息展示（已存在）
- 访问地址、自定义地址、端口、容器 ID
- 时间信息（创建时间、更新时间）
- 危险操作（删除实例）

### 4.3 InstanceChat.tsx（聊天组件）

**路径**: `/src/pages/instances/components/InstanceChat.tsx`

**新增功能**：

#### 4.3.1 连接状态栏
```typescript
// 顶部状态指示器
{isConnected ? (
  <Wifi className="w-4 h-4 text-green-500" />
  <span className="text-sm text-green-500">已连接</span>
) : (
  <WifiOff className="w-4 h-4" />
  <span className="text-sm">
    {isConnecting ? "连接中..." : "未连接"}
  </span>
)}
```

#### 4.3.2 WebSocket 连接
```typescript
// 从 localStorage 加载配置
const [wsConfig, setWsConfig] = useState<{
  url: string;
  token: string;
  role: "operator" | "node";
} | null>(null);

useEffect(() => {
  const storageKey = `instance-${instance.instanceId}`;
  const savedConfig = localStorage.getItem(storageKey);
  if (savedConfig) {
    setWsConfig(JSON.parse(savedConfig));
  }
}, [instance.instanceId]);

// 使用 WebSocket
const { isConnected, send } = useWebSocket({
  url: wsConfig?.url || "",
  token: wsConfig?.token,
  role: wsConfig?.role,
  onMessage: (message) => {
    // 处理接收到的消息
    setMessages(prev => [...prev, aiMessage]);
  },
});
```

#### 4.3.3 未配置提示
```typescript
!wsConfig ? (
  <div className="flex items-center justify-center h-full">
    <p>请先在设置中配置 Gateway 连接</p>
    <button onClick={() => {
      const event = new CustomEvent("open-instance-settings");
      window.dispatchEvent(event);
    }}>
      前往设置
    </button>
  </div>
) : (
  // 正常聊天界面
)
```

#### 4.3.4 消息发送
```typescript
const handleSend = async () => {
  // 检查连接状态
  if (!isConnected) {
    // 显示错误消息
    return;
  }

  // 使用 WebSocket 发送
  send({
    type: "chat",
    content: messageToSend,
    role: "user",
  });
};
```

#### 4.3.5 移除的代码
- 删除了 `simulateAIResponse` 函数（模拟响应）
- 改为使用真实的 WebSocket 连接

---

## 5. 功能对比表

| 功能 | 旧实现（ChatPage + SettingsPage） | 新实现（InstanceChat + InstanceSettings） |
|------|-----------------------------------|-------------------------------------------|
| **页面架构** | 独立的 /chat 和 /settings 页面 | 实例详情页内的 Chat 和 Settings（底部抽屉） |
| **作用域** | 全局单例，所有实例共享 | 每个实例独立 |
| **配置存储** | `gateway-url`, `gateway-token`, `gateway-role` | `instance-{instanceId}` (JSON) |
| **配置界面位置** | /settings 独立页面 | 实例详情页 → 设置按钮 → 底部抽屉 |
| **WebSocket 管理** | `GatewayService` (AppContext) | `useWebSocket` Hook |
| **连接状态显示** | Settings 中显示 | Chat 顶部 + Settings 中显示 |
| **Token 配置** | ✅ 有 | ✅ 有 |
| **角色配置** | ✅ operator/node | ✅ operator/node |
| **连接/断开控制** | ✅ Settings 中 | ✅ Settings 中 |
| **主题** | 浅色主题（#ffffff 背景） | A2UI 深色主题（#071016 背景） |
| **实例信息** | 无 | ✅ 完整的实例信息展示 |
| **删除实例** | 无 | ✅ Settings 中有删除按钮 |

---

## 6. 数据流

### 6.1 配置流程

```
用户操作                 InstanceSettings          localStorage
   |                          |                         |
   |--配置 WebSocket 地址---->|                         |
   |--配置 Token------------>|                         |
   |--选择角色-------------->|                         |
   |--点击保存配置---------->|--saveConfig()---------->|
   |                          |                    [写入]
   |                          |                         |
   |<--保存成功提示-----------|                         |
```

### 6.2 连接流程

```
用户操作              InstanceSettings         useWebSocket              后端 Gateway
   |                       |                        |                      |
   |--点击连接----------->|                        |                      |
   |                      |--handleConnect()------>|                      |
   |                      |    saveConfig()        |                      |
   |                      |                        |--WebSocket 连接---->|
   |                      |                        |                      |
   |                      |                        |<----连接成功----------|
   |                      |                        |                      |
   |<--状态更新：已连接----|<--onConnected()--------|                      |
```

### 6.3 消息流程

```
用户操作              InstanceChat            useWebSocket              后端 Gateway
   |                      |                       |                       |
   |--输入消息----------->|                       |                       |
   |--点击发送----------->|                       |                       |
   |                      |--handleSend()-------->|                       |
   |                      |    send({             |                       |
   |                      |      type: "chat",    |                       |
   |                      |      content,         |                       |
   |                      |      role: "user"     |                       |
   |                      |    })                 |                       |
   |                      |                       |--WebSocket 消息------>|
   |                      |                       |                       |
   |                      |                       |<----AI 响应-----------|
   |                      |                       |                       |
   |<--显示 AI 消息--------|<--onMessage()---------|                       |
```

---

## 7. 主题对比

### 7.1 旧实现（浅色主题）

```css
背景: #ffffff (白色)
主色: #3b82f6 (蓝色)
文字: #1f2937 (深灰)
边框: #e5e7eb (浅灰)
```

### 7.2 新实现（A2UI 深色主题）

```css
背景: #071016 (深蓝黑)
表面: #0f1720 (深色)
卡片: #1e293b (深灰)
主色: #06b6d4 (青色)
边框: #1e293b / #334155
文字主: #ffffff (白色)
文字次: #94a3b8 (灰色)
文字辅: #64748b (深灰)
```

---

## 8. 关键实现细节

### 8.1 Token 是否必须？

**当前实现**：Token 标记为"可选"，但实际上对于生产环境是必须的。

**建议修改**：
```typescript
// 将提示文字改为必填提示
<label>认证 Token *必填*</label>
<input required placeholder="请输入 Gateway Token" />
<p className="text-red-500">⚠️ Operator 模式必须提供 Token</p>
```

### 8.2 配置验证

**当前问题**：连接前没有验证配置完整性

**建议添加**：
```typescript
const validateConfig = () => {
  if (!wsUrl.trim()) {
    alert("请先配置 WebSocket 地址");
    return false;
  }
  if (!authToken.trim() && userRole === "operator") {
    alert("Operator 模式必须提供认证 Token");
    return false;
  }
  return true;
};

const handleConnect = async () => {
  if (!validateConfig()) return;
  // ... 连接逻辑
};
```

### 8.3 连接失败处理

**当前问题**：连接失败时只是打印日志，用户无感知

**建议添加**：
```typescript
const [connectionError, setConnectionError] = useState<string | null>(null);

const handleConnect = async () => {
  try {
    setConnectionError(null);
    // ... 连接逻辑
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsConnected(true);
  } catch (error) {
    setConnectionError("连接失败，请检查配置和网络");
    console.error("连接失败:", error);
  }
};

// UI 中显示错误
{connectionError && (
  <div className="text-red-500 text-sm">
    ⚠️ {connectionError}
  </div>
)}
```

---

## 9. 待完成功能（TODO）

### 9.1 InstanceSettings.tsx

```typescript
// Line 72-89: 实际的 WebSocket 连接逻辑
const handleConnect = async () => {
  setIsConnecting(true);
  try {
    saveConfig();
    // TODO: 建立 WebSocket 连接
    // 这里需要实现 WebSocket 连接逻辑
    console.log("Connecting to:", wsUrl, "with token:", authToken ? "***" : "none");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsConnected(true);
  } catch (error) {
    console.error("连接失败:", error);
  } finally {
    setIsConnecting(false);
  }
};

// Line 92-96: 实际的 WebSocket 断开逻辑
const handleDisconnect = () => {
  // TODO: 断开 WebSocket 连接
  console.log("Disconnecting from:", wsUrl);
  setIsConnected(false);
};

// Line 29: API 调用更新实例名称
const handleSaveName = async () => {
  // TODO: 调用 API 更新实例名称
  // await tenantApi.updateInstance(instance.instanceId, { name: name.trim() });
};
```

### 9.2 InstanceChat.tsx

```typescript
// WebSocket 连接管理需要完善：
// 1. 连接失败重试机制
// 2. 心跳检测
// 3. 断线自动重连
// 4. 消息队列（离线消息缓存）
```

---

## 10. 测试清单

### 10.1 配置功能

- [ ] 可以输入 WebSocket 地址
- [ ] 可以输入认证 Token
- [ ] 可以选择用户角色（operator/node）
- [ ] 点击"保存配置"后，刷新页面配置保留
- [ ] 不同实例的配置互不干扰

### 10.2 连接功能

- [ ] 点击"连接"按钮，连接状态变为"连接中..."
- [ ] 连接成功后，状态变为"已连接"，按钮变为"断开"
- [ ] 连接失败时，显示错误提示
- [ ] 点击"断开"按钮，连接关闭

### 10.3 聊天功能

- [ ] 未配置时显示"请先配置连接"提示
- [ ] 点击"前往设置"按钮，打开设置抽屉
- [ ] 连接后可以发送消息
- [ ] 收到 AI 响应后自动显示
- [ ] 未连接时，输入框和发送按钮禁用

### 10.4 设置功能

- [ ] 可以修改实例名称
- [ ] 可以查看实例信息（ID、类型、健康状态等）
- [ ] 可以删除实例（带确认提示）

---

## 11. 部署注意事项

### 11.1 环境变量

无需新增环境变量，使用现有的 Vite 配置。

### 11.2 浏览器兼容性

- WebSocket API 需要 IE10+ 或现代浏览器
- localStorage 需要启用
- CustomEvent 需要IE9+

### 11.3 网络要求

- Gateway WebSocket 端口需要可访问（默认 18789）
- 支持 `ws://` 和 `wss://` 协议
- 防火墙需要允许 WebSocket 连接

---

## 12. 后续优化建议

### 12.1 用户体验优化

1. **连接测试**：在保存配置前测试连接是否可用
2. **配置模板**：提供常用配置模板（如本地开发、生产环境）
3. **快速配置**：从实例信息自动推断 WebSocket URL
4. **配置导入导出**：支持配置的导入导出功能

### 12.2 功能增强

1. **多语言支持**：i18n 翻译所有配置项
2. **连接日志**：显示详细的连接日志（调试用）
3. **消息历史**：持久化聊天消息到 localStorage
4. **文件传输**：支持通过 WebSocket 发送文件

### 12.3 安全性增强

1. **Token 加密存储**：使用加密方式存储敏感信息
2. **Token 过期提醒**：检测 Token 是否过期
3. **连接限制**：限制同时连接的实例数量

---

## 13. 常见问题 FAQ

### Q1: 为什么看不到 Token 配置选项？

**A**: Token 配置在"Gateway 连接"区块中，需要先点击实例详情页的"设置"按钮打开底部抽屉，然后向下滚动到"Gateway 连接"部分。

### Q2: 配置保存后刷新页面丢失？

**A**: 检查浏览器是否允许 localStorage，且没有隐私模式。配置存储在 `localStorage` 中，key 为 `instance-{instanceId}`。

### Q3: 连接后无法发送消息？

**A**:
1. 检查 WebSocket 连接状态（顶部状态栏）
2. 确认后端 Gateway 服务正在运行
3. 检查控制台是否有错误信息

### Q4: 原有的 Settings 功能还在吗？

**A**: 原有的主题切换功能已移除（新实现固定使用 A2UI 深色主题），其他 Gateway 连接相关功能都已迁移到新的 InstanceSettings 中。

### Q5: 如何在不同实例间切换配置？

**A**: 每个实例有独立的配置存储，切换实例时会自动加载对应的配置。配置不会跨实例共享。

---

## 14. 相关文件路径

### 新增文件
- `/src/hooks/useWebSocket.ts` - WebSocket 管理 Hook

### 修改文件
- `/src/pages/instances/InstanceDetailPage.tsx` - 添加事件监听
- `/src/pages/instances/components/InstanceSettings.tsx` - 添加 Gateway 配置
- `/src/pages/instances/components/InstanceChat.tsx` - 集成 WebSocket

### 备份文件
- `/docs/original-design-backup/ChatPage.tsx` - 原始聊天页面
- `/docs/original-design-backup/ChatPage.css` - 原始聊天样式
- `/docs/original-design-backup/SettingsPage.tsx` - 原始设置页面
- `/docs/original-design-backup/SettingsPage.css` - 原始设置样式

### 文档文件
- `/docs/original-chat-settings-design-spec.md` - 原始设计规范
- `/docs/implementation-summary.md` - 本文档

---

## 15. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2025-02-28 | 初始版本，完整实现实例级 Chat + Settings 架构 |

---

## 16. 联系方式

如有问题或建议，请联系开发团队。
