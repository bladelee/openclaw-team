# 嵌入 OpenClaw Web UI Chat 界面 - 实现方案对比

## 概述

本文档分析如何在自己的 Web 客户端中嵌入 OpenClaw Web UI 的 Chat 界面，提供多种实现方案并进行对比分析。

---

## 方案概览

| 方案 | 复杂度 | 灵活性 | 维护成本 | 推荐度 |
|------|--------|--------|----------|--------|
| 1. iframe 嵌入 | 低 | 低 | 低 | ⭐⭐⭐ |
| 2. Web Components | 中 | 高 | 中 | ⭐⭐⭐⭐⭐ |
| 3. 直接集成 Lit 组件 | 高 | 最高 | 高 | ⭐⭐⭐⭐ |
| 4. 反向代理 + 重写 | 中 | 低 | 中 | ⭐⭐ |
| 5. 独立微前端 | 高 | 高 | 高 | ⭐⭐⭐ |

---

## 方案 1: iframe 嵌入

### 实现方式

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App - Chat</title>
  <style>
    #chat-container {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div id="app">
    <h1>My Application</h1>
    <!-- 其他内容 -->

    <iframe
      id="chat-container"
      src="http://localhost:18789/__openclaw__/ui"
      allow="clipboard-write; clipboard-read"
    ></iframe>
  </div>

  <script>
    // 可选：与 iframe 通信
    const iframe = document.getElementById('chat-container');

    // 监听 iframe 消息
    window.addEventListener('message', (event) => {
      // 验证来源
      if (event.origin !== 'http://localhost:18789') return;

      console.log('Chat event:', event.data);
    });

    // 向 iframe 发送消息（如果支持）
    function sendToChat(message) {
      iframe.contentWindow.postMessage({
        type: 'chat',
        message
      }, 'http://localhost:18789');
    }
  </script>
</body>
</html>
```

### 优点

- ✅ **实现简单**：一行 HTML 即可
- ✅ **样式隔离**：CSS 不会冲突
- ✅ **安全隔离**：独立的 JavaScript 上下文
- ✅ **易于部署**：不需要修改 OpenClaw 代码

### 缺点

- ❌ **样式控制有限**：难以深度定制外观
- ❌ **通信复杂**：需要 postMessage 传递数据
- ❌ **响应式受限**：iframe 尺寸调整不够灵活
- ❌ **SEO 不友好**：搜索引擎无法索引 iframe 内容
- ❌ **用户体验**：可能的滚动条和边界感

### 适用场景

- 快速原型验证
- 不需要深度定制的场景
- 作为独立功能模块嵌入

---

## 方案 2: Web Components 封装

### 实现方式

#### Step 1: 创建 Web Component

```typescript
// openclaw-chat.ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('openclaw-chat')
export class OpenClawChat extends LitElement {
  @property({ type: String })
  gatewayUrl = 'ws://localhost:18789';

  @property({ type: String })
  token = '';

  @property({ type: String })
  sessionKey = 'main';

  private client: GatewayBrowserClient | null = null;
  private messages: unknown[] = [];
  private connected = false;

  override connectedCallback() {
    super.connectedCallback();
    this.initGateway();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.client?.stop();
  }

  private async initGateway() {
    const { GatewayBrowserClient } = await import('./gateway-browser-client.js');

    this.client = new GatewayBrowserClient({
      url: this.gatewayUrl,
      token: this.token,
      clientName: 'my-app',
      clientVersion: '1.0.0',
      mode: 'webchat',
      onHello: (hello) => {
        this.connected = true;
        this.loadHistory();
      },
      onEvent: (evt) => {
        if (evt.event === 'chat') {
          this.handleChatEvent(evt.payload);
        }
      },
    });

    this.client.start();
  }

  private async loadHistory() {
    if (!this.client) return;

    const res = await this.client.request('chat.history', {
      sessionKey: this.sessionKey,
      limit: 200,
    });

    this.messages = res.messages || [];
    this.requestUpdate();
  }

  private handleChatEvent(payload: any) {
    // 处理 chat 事件
    this.requestUpdate();
  }

  async sendMessage(text: string) {
    if (!this.client) return;

    await this.client.request('chat.send', {
      sessionKey: this.sessionKey,
      message: text,
      idempotencyKey: `msg-${Date.now()}`,
    });
  }

  override render() {
    return html`
      <div class="chat-container">
        <div class="messages">
          ${this.messages.map(msg => html`
            <div class="message">${JSON.stringify(msg)}</div>
          `)}
        </div>
        <div class="input">
          <textarea id="input"></textarea>
          <button @click=${this.handleSend}>Send</button>
        </div>
      </div>
    `;
  }

  private handleSend() {
    const input = this.shadowRoot?.getElementById('input') as HTMLTextAreaElement;
    if (input?.value) {
      this.sendMessage(input.value);
      input.value = '';
    }
  }

  static styles = `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }
    .input {
      display: flex;
      padding: 1rem;
      border-top: 1px solid #ccc;
    }
    .input textarea {
      flex: 1;
      resize: none;
    }
  `;
}
```

#### Step 2: 使用 Web Component

```html
<!DOCTYPE html>
<html>
<head>
  <title>My App - Chat</title>
  <script type="module" src="./openclaw-chat.js"></script>
  <style>
    openclaw-chat {
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <h1>My Application</h1>

  <!-- 声明式使用 -->
  <openclaw-chat
    gateway-url="ws://localhost:18789"
    token="your-token"
    session-key="main"
  ></openclaw-chat>

  <!-- 或编程式使用 -->
  <div id="chat-container"></div>

  <script type="module">
    import { OpenClawChat } from './openclaw-chat.js';

    // 编程式创建
    const chat = new OpenClawChat();
    chat.gatewayUrl = 'ws://localhost:18789';
    chat.token = 'your-token';
    chat.sessionKey = 'main';

    document.getElementById('chat-container')?.appendChild(chat);

    // 调用方法
    chat.sendMessage('Hello from outside!');
  </script>
</body>
</html>
```

### 优点

- ✅ **封装良好**：隐藏实现细节
- ✅ **可重用**：多个页面共享组件
- ✅ **灵活定制**：通过属性和方法控制
- ✅ **框架无关**：适用于任何前端框架
- ✅ **样式隔离**：Shadow DOM 隔离样式

### 缺点

- ❌ **开发成本**：需要封装和测试
- ❌ **浏览器支持**：需要现代浏览器支持 Web Components
- ❌ **调试复杂**：Shadow DOM 调试稍复杂

### 适用场景

- 需要在多个项目中复用
- 需要深度定制 UI
- 团队熟悉 Web Components

---

## 方案 3: 直接集成 Lit 组件

### 实现方式

#### Step 1: 安装依赖

```bash
npm install lit
npm install -D typescript
```

#### Step 2: 集成 OpenClaw 组件

```typescript
// my-chat-app.ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

// 直接复用 OpenClaw 的组件
import {
  renderChat,
  type ChatProps
} from '@openclaw/ui/views/chat.js';

import {
  type ChatState,
  loadChatHistory,
  sendChatMessage,
  handleChatEvent
} from '@openclaw/ui/controllers/chat.js';

import { GatewayBrowserClient } from '@openclaw/ui/gateway.js';

@customElement('my-chat-app')
export class MyChatApp extends LitElement {
  @state()
  private chatState: Partial<ChatState> = {
    connected: false,
    sessionKey: 'main',
    chatMessages: [],
    chatLoading: false,
    chatSending: false,
    chatMessage: '',
    chatAttachments: [],
    chatRunId: null,
    chatStream: null,
    lastError: null,
  };

  private client: GatewayBrowserClient | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.initGateway();
  }

  private async initGateway() {
    this.client = new GatewayBrowserClient({
      url: 'ws://localhost:18789',
      token: 'your-token',
      clientName: 'my-app',
      mode: 'webchat',
      onHello: async () => {
        this.chatState.connected = true;
        await this.loadHistory();
      },
      onEvent: (evt) => {
        if (evt.event === 'chat') {
          handleChatEvent(this.chatState as ChatState, evt.payload);
          this.requestUpdate();
        }
      },
    });

    this.client.start();
  }

  private async loadHistory() {
    await loadChatHistory(this.chatState as ChatState);
    this.requestUpdate();
  }

  private async handleSend() {
    const message = this.chatState.chatMessage;
    if (!message || !this.client) return;

    await sendChatMessage(this.chatState as ChatState, message, this.chatState.chatAttachments);
    this.chatState.chatMessage = '';
    this.requestUpdate();
  }

  override render() {
    // 直接使用 OpenClaw 的渲染函数
    return renderChat({
      sessionKey: this.chatState.sessionKey ?? 'main',
      messages: this.chatState.chatMessages ?? [],
      stream: this.chatState.chatStream,
      streamStartedAt: null,
      loading: this.chatState.chatLoading ?? false,
      sending: this.chatState.sending ?? false,
      connected: this.chatState.connected ?? false,
      canSend: true,
      disabledReason: this.chatState.lastError,
      error: this.chatState.lastError,
      sessions: null,
      thinkingLevel: null,
      showThinking: false,
      focusMode: false,
      assistantName: 'OpenClaw',
      assistantAvatar: null,
      draft: this.chatState.chatMessage ?? '',
      queue: [],
      attachments: this.chatState.chatAttachments ?? [],

      // 事件处理
      onRefresh: () => this.loadHistory(),
      onDraftChange: (text) => {
        this.chatState.chatMessage = text;
        this.requestUpdate();
      },
      onSend: () => this.handleSend(),
      onToggleFocusMode: () => {},
      onNewSession: () => {},
      onQueueRemove: () => {},
    });
  }
}
```

### 优点

- ✅ **完全控制**：可访问所有组件和功能
- ✅ **类型安全**：TypeScript 类型检查
- ✅ **高度定制**：可以修改任何部分
- ✅ **性能最优**：无中间层开销

### 缺点

- ❌ **复杂度高**：需要理解整个 OpenClaw 架构
- ❌ **维护成本**：OpenClaw 更新可能需要适配
- ❌ **打包体积**：需要打包整个 UI 库
- ❌ **学习曲线**：需要熟悉 Lit 框架

### 适用场景

- 需要深度定制功能
- 需要最佳性能
- 团队熟悉 Lit 和 TypeScript

---

## 方案 4: 反向代理 + 路径重写

### 实现方式

#### Step 1: 配置反向代理

**Nginx 配置**:
```nginx
server {
    listen 80;
    server_name myapp.example.com;

    # 你的应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # OpenClaw UI（路径重写）
    location /chat {
        proxy_pass http://localhost:18789/__openclaw__/ui/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 重写响应中的路径
        sub_filter '__openclaw__/ui' '/chat';
        sub_filter_once off;
    }

    # OpenClaw WebSocket（路径重写）
    location /chat/ws {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Node.js (http-proxy-middleware)**:
```javascript
// express.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// OpenClaw UI 代理
app.use('/chat', createProxyMiddleware({
  target: 'http://localhost:18789/__openclaw__/ui',
  changeOrigin: true,
  pathRewrite: {
    '^/chat': '',
  },
  onProxyRes: function(proxyRes, req, res) {
    // 重写响应中的路径
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      body = body.replace(/__openclaw__\/ui/g, '/chat');
      res.send(body);
    });
  },
}));

// OpenClaw WebSocket 代理
app.use('/chat/ws', createProxyMiddleware({
  target: 'ws://localhost:18789',
  ws: true,
  pathRewrite: {
    '^/chat/ws': '',
  },
}));

app.listen(3000);
```

#### Step 2: 在应用中链接

```html
<!-- 直接链接到嵌入的路径 -->
<a href="/chat" target="_blank">Open Chat</a>

<!-- 或在新窗口打开 -->
<button onclick="window.open('/chat', '_blank')">
  Open Chat
</button>
```

### 优点

- ✅ **透明集成**：用户感觉不到切换
- ✅ **独立部署**：OpenClaw 独立运行
- ✅ **URL 简洁**：自定义路径
- ✅ **缓存友好**：可单独配置缓存策略

### 缺点

- ❌ **跨域限制**：需要处理 CORS
- ❌ **WebSocket 复杂**：需要特殊配置
- ❌ **路径重写**：可能影响资源加载
- ❌ **SSL 证书**：需要配置证书

### 适用场景

- 需要保持独立域名但统一路径
- 需要独立的部署和更新
- 企业内网环境

---

## 方案 5: 独立微前端架构

### 实现方式

#### 使用 qiankun (微前端框架)

**主应用**:
```javascript
// main-app.js
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'openclaw-chat',
    entry: '//localhost:18789/__openclaw__/ui',
    container: '#chat-container',
    activeRule: '/chat',
    props: {
      gatewayUrl: 'ws://localhost:18789',
      token: 'shared-token',
    }
  }
]);

start();

// 路由控制
function navigateToChat() {
  history.pushState({}, '', '/chat');
}
```

**OpenClaw 适配**（需要修改 OpenClaw）:
```javascript
// 在 OpenClaw 的入口添加 qiankun 生命周期
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}

let instance = null;

export async function bootstrap() {
  console.log('[OpenClaw] bootstrap');
}

export async function mount(props) {
  console.log('[OpenClaw] mount', props);
  instance = createOpenClawApp(props);
  instance.render('#app');
}

export async function unmount() {
  console.log('[OpenClaw] unmount');
  instance?.unmount();
}
```

#### 使用 Module Federation

**主应用 webpack.config.js**:
```javascript
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'main_app',
      remotes: {
        openclaw: 'openclaw@http://localhost:18789/remoteEntry.js',
      },
      shared: {
        lit: { singleton: true },
      },
    }),
  ],
};
```

**使用**:
```javascript
// 动态导入 OpenClaw 组件
const { renderChat, ChatController } = await import('openclaw/Chat');

// 在应用中使用
const controller = new ChatController({
  gatewayUrl: 'ws://localhost:18789',
  token: 'my-token',
});

render('#chat-container', {
  controller,
  onMessage: (msg) => console.log(msg),
});
```

### 优点

- ✅ **完全独立**：独立开发、部署、更新
- ✅ **技术栈无关**：可以使用不同框架
- ✅ **版本管理**：多版本并存
- ✅ **团队协作**：不同团队独立维护

### 缺点

- ❌ **架构复杂**：需要微前端基础设施
- ❌ **性能开销**：加载多个运行时
- ❌ **调试困难**：跨应用调试复杂
- ❌ **学习成本**：团队需要学习微前端

### 适用场景

- 大型企业应用
- 多团队协作
- 需要独立部署和版本管理

---

## 对比分析

### 功能对比

| 功能 | iframe | Web Components | Lit 集成 | 反向代理 | 微前端 |
|------|--------|----------------|----------|----------|--------|
| 样式定制 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 数据共享 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 性能 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 实现难度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| 维护成本 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 灵活性 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

### 场景推荐

#### 快速原型
**推荐**: iframe
- 一行代码集成
- 立即可用
- 无需修改代码

#### 生产环境（中等定制）
**推荐**: Web Components
- 良好的封装
- 框架无关
- 易于维护

#### 生产环境（深度定制）
**推荐**: Lit 组件直接集成
- 完全控制
- 最佳性能
- 类型安全

#### 企业应用（多团队）
**推荐**: 微前端架构
- 独立部署
- 团队协作
- 版本管理

#### 统一路径（用户体验）
**推荐**: 反向代理
- URL 简洁
- 透明集成
- 独立部署

---

## 实施建议

### 阶段 1: 评估（1-2 天）

1. **明确需求**
   - 需要哪些定制？
   - 数据如何共享？
   - 性能要求？

2. **技术选型**
   - 团队技术栈
   - 开发和维护成本
   - 长期规划

### 阶段 2: 原型（3-5 天）

1. **快速验证**
   - 用 iframe 验证集成可行性
   - 测试数据流和通信

2. **方案选择**
   - 根据原型结果选择最终方案
   - 权衡利弊

### 阶段 3: 开发（1-2 周）

1. **组件封装**（如果选择 Web Components 或 Lit）
   - 封装核心功能
   - 添加必要属性和方法
   - 编写文档和示例

2. **集成测试**
   - 端到端测试
   - 性能测试
   - 兼容性测试

### 阶段 4: 部署（1 周）

1. **配置部署**
   - 反向代理配置
   - SSL 证书
   - 监控和日志

2. **灰度发布**
   - 内部测试
   - 小范围用户测试
   - 全量发布

---

## 常见问题

### Q1: 如何处理认证？

**A**:
```javascript
// 方案 1: URL 参数
const chatUrl = `http://localhost:18789/__openclaw__/ui?token=${encodeURIComponent(token)}`;

// 方案 2: localStorage
localStorage.setItem('openclaw-token', token);

// 方案 3: postMessage
iframe.contentWindow.postMessage({
  type: 'auth',
  token
}, 'http://localhost:18789');
```

### Q2: 如何共享用户数据？

**A**:
```javascript
// 方案 1: 通过属性传递
<openclaw-chat
  user-id="user-123"
  user-name="John"
  user-email="john@example.com"
></openclaw-chat>

// 方案 2: 通过事件
chat.addEventListener('user-data-request', (e) => {
  e.detail.user = { id: 'user-123', name: 'John' };
});

// 方案 3: 通过共享状态管理（如 Zustand）
```

### Q3: 如何处理响应式？

**A**:
```css
/* 容器响应式 */
.chat-container {
  width: 100%;
  height: 100%;
  max-width: 800px;
}

/* 媒体查询 */
@media (max-width: 768px) {
  .chat-container {
    height: 100vh;
    max-width: 100%;
  }
}
```

### Q4: 如何处理移动端？

**A**:
- **推荐**: 使用 Web Components 或 Lit 集成
- 避免使用 iframe（滚动和触摸体验差）
- 使用 Viewport Meta 标签
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

---

## 参考资源

- [Web Components MDN](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [Lit 文档](https://lit.dev/)
- [qiankun 文档](https://qiankun.umijs.org/)
- [Module Federation 文档](https://webpack.js.org/concepts/module-federation/)

---

**文档版本**：1.0
**创建日期**：2026-02-05
**最后更新**：2026-02-05
