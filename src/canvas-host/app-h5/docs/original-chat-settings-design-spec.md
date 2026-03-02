# 原 Chat/Settings 页面设计规范文档

> 本文档记录了原有的 Chat 和 Settings 页面的设计规范，作为学习参考保留。
> 备份文件位于：`docs/original-design-backup/`

## 创建信息

- **创建日期**: 2026-02-28
- **备份原因**: 重构为 A2UI 设计规范前的原始实现
- **文件位置**:
  - ChatPage: `/src/canvas-host/app-h5/pages/chat/`
  - SettingsPage: `/src/canvas-host/app-h5/pages/settings/`

---

## 1. 设计概述

### 1.1 设计原则

原有 Chat 和 Settings 页面采用**自定义设计**，主要特点：

- ✅ **简洁轻量**：使用纯 HTML 元素，不依赖组件库
- ✅ **响应式优先**：移动端优化，支持小屏幕
- ✅ **主题可切换**：支持浅色/深色/自动主题
- ✅ **CSS 变量系统**：使用 CSS 自定义属性实现主题化
- ❌ **不遵循 A2UI**：独立的设计语言

### 1.2 技术栈

```json
{
  "框架": "React (函数组件)",
  "样式": "CSS (独立 .css 文件)",
  "主题": "CSS 变量 + data-theme 属性",
  "状态管理": "React Hooks (useState, useEffect)",
  "布局": "Flexbox",
  "响应式": "Media Queries"
}
```

---

## 2. 色彩系统

### 2.1 颜色变量定义

```css
/* 主色调 */
--accent-color: #3b82f6;        /* 蓝色 - 主按钮、链接 */
--accent-hover: #2563eb;        /* 深蓝 - 悬停状态 */

/* 背景色（浅色主题） */
--bg-primary: #ffffff;          /* 主背景 - 纯白 */
--bg-secondary: #f9fafb;        /* 次级背景 - 浅灰 */
--bg-tertiary: #f3f4f6;         /* 第三级背景 - 更浅灰 */

/* 文字色（浅色主题） */
--text-primary: #111827;        /* 主要文字 - 深灰黑 */
--text-secondary: #6b7280;      /* 次要文字 - 中灰 */
--text-tertiary: #9ca3af;       /* 辅助文字 - 浅灰 */

/* 状态色 */
--success-color: #10b981;       /* 成功 - 绿色 */
--error-color: #ef4444;         /* 错误 - 红色 */
--warning-color: #f59e0b;       /* 警告 - 黄色 */
--info-color: #3b82f6;          /* 信息 - 蓝色 */

/* 边框色 */
--border-color: #e5e7eb;        /* 边框 - 浅灰 */
```

### 2.2 深色主题覆盖

```css
[data-theme='dark'] {
  --bg-primary: #111827;        /* 深色背景 */
  --text-primary: #f9fafb;      /* 浅色文字 */
  --bg-secondary: #1f2937;
  --bg-tertiary: #374151;
}
```

### 2.3 与 A2UI 色彩对比

| 元素 | 原 Chat/Settings | A2UI 规范 |
|------|-----------------|-----------|
| **主色调** | `#3b82f6` (蓝色) | `#06b6d4` (青色) |
| **主背景** | `#ffffff` (白色) | `#071016` (深蓝黑) |
| **次背景** | `#f9fafb` (浅灰) | `#0f1720` (深色) |
| **主要文字** | `#111827` (深灰) | `#ffffff` (白色) |
| **次要文字** | `#6b7280` (中灰) | `#94a3b8` (灰) |
| **边框** | `#e5e7eb` (浅灰) | `#1e293b` (深灰) |

---

## 3. 组件样式规范

### 3.1 页面容器

```css
.chat-page, .settings-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--bg-primary, #ffffff);
  color: var(--text-primary, #111827);
}
```

**设计要点**：
- 全屏垂直布局
- 最大宽度 800px（桌面端居中）
- 使用 CSS 变量带 fallback 值

### 3.2 头部 (Header)

```css
.chat-header, .settings-header {
  padding: 16px;
  background-color: var(--bg-secondary, #f9fafb);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;  /* 防止被压缩 */
}

.chat-header h1, .settings-header h1 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}
```

**设计要点**：
- 固定高度，不随内容滚动
- 浅灰背景区分
- 底部边框分隔

### 3.3 按钮 (Button)

#### 主按钮
```css
.button-primary, .send-button {
  padding: 12px 24px;
  background-color: var(--accent-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.button-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.button-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.button-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### 次要按钮（边框按钮）
```css
.settings-button, .canvas-button {
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  color: var(--text-primary, #111827);
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.settings-button:hover {
  background-color: var(--bg-tertiary, #f3f4f6);
  border-color: var(--accent-color, #3b82f6);
}
```

**设计要点**：
- 圆角 8px
- 点击缩放效果 (scale(0.98))
- 悬停透明度变化或背景色变化
- 禁用状态半透明

### 3.4 输入框 (Input)

```css
.input, .message-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  background-color: var(--bg-primary, #ffffff);
  color: var(--text-primary, #111827);
  font-size: 1rem;
  font-family: inherit;
  line-height: 1.5;
}

.input:focus, .message-input:focus {
  outline: none;
  border-color: var(--accent-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input:disabled, .message-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

**设计要点**：
- focus 时蓝色边框 + 蓝色光晕
- 禁用时半透明
- 保持系统字体

### 3.5 卡片 (Card)

```css
.status-card, .config-card, .theme-card, .about-card {
  background-color: var(--bg-secondary, #f9fafb);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

**设计要点**：
- 圆角 12px（比按钮稍大）
- 内边距 16px
- 子元素间距 12px

### 3.6 消息气泡 (Message Bubble)

```css
.message-item {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  animation: fadeIn 0.2s ease-in;
}

.user-message {
  align-self: flex-end;  /* 右对齐 */
}

.ai-message {
  align-self: flex-start;  /* 左对齐 */
}

.message-content {
  padding: 12px;
  border-radius: 12px;
  background-color: var(--bg-tertiary, #f3f4f6);
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.user-message .message-content {
  background-color: var(--accent-color, #3b82f6);
  color: white;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**设计要点**：
- 用户消息右侧 + 蓝色背景
- AI 消息左侧 + 浅灰背景
- 淡入动画效果

---

## 4. 布局模式

### 4.1 Chat 页面布局

```
+--------------------------------------+
|  头部 (固定高度)                      |
|  +----------------------------------+ |
|  | 💬 OpenClaw 聊天  🎨 Canvas  ⚙️  | |
+--------------------------------------+
|  消息列表 (flex: 1, 可滚动)            |
|  +----------------------------------+ |
|  |  AI: 你好！                      | |
|  |  User: 帮我写代码                 | |
|  |  [空白区域 - 可滚动]               | |
|  +----------------------------------+ |
+--------------------------------------+
|  输入框 (固定高度)                    |
|  +----------------------------------+ |
|  | [输入框...]              [发送] | |
+--------------------------------------+
```

**CSS 实现**：
```css
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;  /* 重要：允许 flex 子元素缩小 */
}

.input-container {
  flex-shrink: 0;  /* 防止被压缩 */
}
```

### 4.2 Settings 页面布局

```
+--------------------------------------+
|  头部 (固定高度)                      |
|  +----------------------------------+ |
|  | ← 返回    ⚙️ 设置         [占位] | |
+--------------------------------------+
|  设置内容 (flex: 1, 可滚动)           |
|  +----------------------------------+ |
|  | 🔌 Gateway 连接                  | |
|  |  [状态卡片]                       | |
|  |                                  | |
|  | 🔧 连接配置                      | |
|  |  [配置表单]                       | |
|  |                                  | |
|  | 🎨 外观                          | |
|  |  [主题选择]                       | |
|  +----------------------------------+ |
+--------------------------------------+
```

---

## 5. 响应式设计

### 5.1 断点

```css
@media (max-width: 640px) {
  /* 小屏幕优化 */
  .chat-page, .settings-page {
    max-width: 100%;
  }

  .message-item {
    max-width: 90%;  /* 消息气泡更宽 */
  }

  .chat-header, .settings-header {
    padding: 12px 16px;  /* 减少内边距 */
  }

  .input-container {
    padding: 12px 16px;
  }
}
```

### 5.2 移动端优化要点

1. **减少内边距**：节省屏幕空间
2. **增大点击区域**：按钮最小 44px 高度
3. **横向布局改为纵向**：Settings 操作按钮在小屏幕堆叠

```css
@media (max-width: 640px) {
  .action-buttons {
    flex-direction: column;  /* 横向改纵向 */
  }
}
```

---

## 6. 交互设计

### 6.1 状态反馈

#### 连接状态
```tsx
<div className={`connection-status ${gateway?.isConnected ? 'connected' : 'disconnected'}`}>
  {gateway?.isConnected ? '● 已连接' : '○ 未连接'}
</div>
```

```css
.connection-status.connected {
  color: var(--success-color, #10b981);
}

.connection-status.disconnected {
  color: var(--error-color, #ef4444);
}
```

#### 加载状态
```tsx
<button disabled={isLoading}>
  {isLoading ? '连接中...' : '连接'}
</button>
```

#### 成功提示
```tsx
<button onClick={handleSaveConfig}>
  {saveConfig ? '✓ 已保存' : '保存配置'}
</button>

// 2秒后自动隐藏
setTimeout(() => setSaveConfig(false), 2000);
```

### 6.2 手势支持

- **Enter 发送消息**：`Shift+Enter` 换行
- **点击缩放效果**：`:active { transform: scale(0.98); }`
- **禁用状态反馈**：透明度降低 + `cursor: not-allowed`

### 6.3 自动滚动

```tsx
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);  // 消息变化时自动滚动到底部
```

---

## 7. 主题系统

### 7.1 主题切换实现

```tsx
// AppContext.tsx
const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

useEffect(() => {
  const applyTheme = () => {
    let effectiveTheme: 'light' | 'dark';

    if (theme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      effectiveTheme = theme;
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
  };

  applyTheme();

  if (theme === 'auto') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }
}, [theme]);
```

### 7.2 CSS 主题变量

```css
/* 默认（浅色主题） */
:root {
  --accent-color: #3b82f6;
  --bg-primary: #ffffff;
  --text-primary: #111827;
  /* ... */
}

/* 深色主题覆盖 */
[data-theme='dark'] {
  --bg-primary: #111827;
  --text-primary: #f9fafb;
  --bg-secondary: #1f2937;
  /* ... */
}
```

---

## 8. React Hooks 使用

### 8.1 状态管理

```tsx
// 本地状态
const [inputText, setInputText] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [theme, setTheme] = useState<'light' | 'dark'>('auto');

// Context 状态
const { gateway, setCurrentPage } = useApp();

// 自定义 Hook
const { messages, sendText, isLoading } = useChat(gateway);
```

### 8.2 副作用处理

```tsx
// 组件挂载时执行
useEffect(() => {
  const token = storage.get<string | null>('gateway-token', null);
  if (token) setAuthToken(token);
}, []);

// 监听特定状态变化
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// 清理副作用
useEffect(() => {
  const handleMessage = (message) => { /* ... */ };
  gateway.on('message', handleMessage);
  return () => gateway.off('message', handleMessage);  // 清理
}, [gateway]);
```

---

## 9. 核心功能实现

### 9.1 Chat 页面核心功能

#### 发送消息
```tsx
const handleSend = async () => {
  if (!inputText.trim() || isLoading) return;

  try {
    await sendText(inputText);
    setInputText('');  // 清空输入框
  } catch (error) {
    console.error('发送失败:', error);
  }
};
```

#### 键盘快捷键
```tsx
const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void handleSend();  // Enter 发送
  }
  // Shift+Enter 默认换行
};
```

#### A2UI 消息监听
```tsx
useEffect(() => {
  const handleMessage = (message: { type?: string; event?: string }) => {
    if (message.type === 'event' && message.event === 'a2ui') {
      console.log('[ChatPage] 检测到 A2UI 消息，自动切换到 Canvas 页面');
      setCurrentPage('canvas');
    }
  };

  gateway.on('message', handleMessage);
  return () => gateway.off('message', handleMessage);
}, [gateway, setCurrentPage]);
```

### 9.2 Settings 页面核心功能

#### Gateway 连接
```tsx
const handleConnect = () => {
  if (!gateway) return;

  setIsConnecting(true);
  try {
    gateway.setUrl(gatewayUrl);
    gateway.connect();
  } finally {
    setTimeout(() => setIsConnecting(false), 500);
  }
};

const handleDisconnect = () => {
  gateway?.disconnect();
};
```

#### 配置保存
```tsx
const handleSaveConfig = () => {
  // 保存到 localStorage
  if (authToken) {
    storage.set('gateway-token', authToken);
  } else {
    storage.remove('gateway-token');
  }
  storage.set('gateway-role', userRole);

  // 立即更新运行时配置
  updateGatewayConfig({
    token: authToken || undefined,
    role: userRole
  });

  // 显示成功提示
  setSaveConfig(true);
  setTimeout(() => setSaveConfig(false), 2000);
};
```

---

## 10. 性能优化

### 10.1 防抖和节流

```tsx
// 搜索输入防抖
const [searchTerm, setSearchTerm] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm);
  }, 300);

  return () => clearTimeout(timer);
}, [searchTerm]);
```

### 10.2 懒加载和代码分割

```tsx
// 路由级别的代码分割
const ChatPage = lazy(() => import('./pages/chat/ChatPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

// 使用 Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Routes>
</Suspense>
```

### 10.3 条件渲染优化

```tsx
// 避免不必要的渲染
{messages.length === 0 && (
  <div className="empty-state">
    <p>开始对话吧！</p>
  </div>
)}

{messages.map((message) => (
  <div key={message.id}>
    {/* 消息内容 */}
  </div>
))}
```

---

## 11. 可访问性 (A11y)

### 11.1 语义化 HTML

```tsx
<header className="chat-header">
  <h1>💬 OpenClaw 聊天</h1>
</header>

<main className="messages-container">
  <article className="message-item">
    <header className="message-header">
      <span className="message-role">AI</span>
      <time className="message-time">14:30</time>
    </header>
    <p className="message-content">你好！</p>
  </article>
</main>

<footer className="input-container">
  <label htmlFor="message-input" className="visually-hidden">
    输入消息
  </label>
  <textarea
    id="message-input"
    className="message-input"
    placeholder="输入消息..."
    aria-label="消息输入框"
  />
</footer>
```

### 11.2 ARIA 属性

```tsx
<button
  onClick={() => setCurrentPage('canvas')}
  aria-label="Canvas"
  title="查看 Canvas/A2UI 界面"
>
  🎨 Canvas
</button>

<div
  className={`connection-status ${gateway?.isConnected ? 'connected' : 'disconnected'}`}
  role="status"
  aria-live="polite"
>
  {gateway?.isConnected ? '● 已连接' : '○ 未连接'}
</div>
```

### 11.3 键盘导航

```tsx
// Enter 发送消息
onKeyPress={(e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void handleSend();
  }
}}

// Escape 关闭模态框
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [onClose]);
```

---

## 12. 调试技巧

### 12.1 Console 日志

```tsx
console.log('[ChatPage] 检测到 A2UI 消息，自动切换到 Canvas 页面');
console.error('发送失败:', error);
console.debug('[SettingsPage] 配置已保存', { authToken, userRole });
```

### 12.2 错误边界

```tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>出错了: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}
```

---

## 13. 与 A2UI 迁移对照

### 13.1 组件映射

| 原 Chat/Settings | A2UI 对应组件 | 迁移说明 |
|-----------------|--------------|---------|
| `div.chat-page` | `A2uiColumn` | 垂直布局容器 |
| `div.status-card` | `A2uiCard` | 卡片容器 |
| `button.button-primary` | `A2uiButton variant="primary"` | 主按钮 |
| `button.settings-button` | `A2uiButton variant="secondary"` | 次要按钮 |
| `input.input` | `A2uiTextField` | 输入框 |
| `textarea.message-input` | `A2uiTextField multiline` | 多行输入 |
| `div.message-item` | `A2uiCard` (with custom props) | 消息气泡 |
| `div.settings-section` | `A2uiColumn` | 区块容器 |

### 13.2 样式映射

| 原 CSS 属性 | A2UI 对应 |
|------------|----------|
| `--accent-color: #3b82f6` | `--openclaw-primary: #06b6d4` |
| `--bg-primary: #ffffff` | `--openclaw-background: #071016` |
| `--text-primary: #111827` | `--openclaw-text: #ffffff` |
| `border-radius: 8px` | `border-radius: var(--radius-sm)` |
| `padding: 12px` | `padding: var(--spacing-md)` |

### 13.3 迁移步骤

1. **引入 A2UI 组件**
   ```tsx
   import { A2uiCard, A2uiButton, A2uiTextField } from '@openclaw/a2ui-react';
   ```

2. **替换 HTML 元素**
   ```tsx
   // Before
   <div className="status-card">...</div>

   // After
   <A2uiCard>...</A2uiCard>
   ```

3. **应用深色主题**
   ```tsx
   // AppContext.tsx
   <A2uiThemeProvider theme="dark">
     <App />
   </A2uiThemeProvider>
   ```

4. **删除自定义 CSS**
   - 移除 `.css` 文件
   - 移除 CSS 变量定义
   - 使用 A2UI 主题变量

---

## 14. 备份文件清单

```
docs/original-design-backup/
├── ChatPage.tsx          (4505 字节)
├── ChatPage.css          (4962 字节)
├── SettingsPage.tsx      (7064 字节)
└── SettingsPage.css      (4718 字节)
```

### 文件内容概要

#### ChatPage.tsx
- 149 行代码
- 聊天界面实现
- WebSocket 消息通信
- A2UI 消息监听

#### ChatPage.css
- 285 行代码
- 完整的聊天界面样式
- 浅色/深色主题支持

#### SettingsPage.tsx
- 211 行代码
- Gateway 连接管理
- 配置保存
- 主题切换

#### SettingsPage.css
- 272 行代码
- 设置界面样式
- 表单样式
- 主题选项样式

---

## 15. 学习要点总结

### ✅ 优点

1. **简单直观**：纯 HTML/CSS，易于理解
2. **响应式设计**：移动端优先，适配小屏幕
3. **主题系统**：CSS 变量 + data-theme，易于扩展
4. **渐进增强**：使用 CSS 变量 fallback
5. **性能优化**：懒加载、条件渲染

### ⚠️ 局限性

1. **不一致性**：与其他页面风格不同
2. **维护成本**：自定义组件，无复用
3. **浅色主题**：默认白色背景，缺乏科技感
4. **无组件库**：缺少统一的组件规范

### 📚 可借鉴的设计

1. **布局模式**：Flexbox 垂直布局，固定头部/底部，中间滚动
2. **状态反馈**：连接状态、加载状态、成功提示
3. **交互细节**：点击缩放、悬停效果、自动滚动
4. **主题切换**：自动跟随系统主题
5. **响应式断点**：640px 断点，移动端优化

---

## 16. 迁移到新规范

新的实现将遵循以下原则：

1. **使用 A2UI 组件库**：统一的设计语言
2. **深色主题**：科技感的深蓝黑背景 (#071016)
3. **青色主色**：与 A2UI 一致的青色 (#06b6d4)
4. **实例融合设计**：每个实例独立的 Chat + Settings

详见：
- **设计文档**: `docs/mobile-ui-design-spec.md`
- **组件规范**: `docs/a2ui-components-spec.md`
- **功能设计**: `docs/instance-chat-settings-design.md`

---

**文档版本**: 1.0
**最后更新**: 2026-02-28
**维护者**: OpenClaw Team
