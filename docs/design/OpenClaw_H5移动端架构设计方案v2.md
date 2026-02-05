# OpenClaw H5 移动端架构设计方案 v2.0

## 目录

1. [架构设计原则](#架构设计原则)
2. [分层架构](#分层架构)
3. [Chat MVP 设计](#chat-mvp-设计)
4. [技术实现](#技术实现)
5. [实施计划](#实施计划)

---

## 架构设计原则

### 核心理念

**分离关注点**：清晰区分 A2UI 渲染引擎和应用业务逻辑

| 层级 | 职责 | 技术栈 |
|------|------|--------|
| **A2UI 渲染引擎层** | 渲染 AI 动态生成的 UI | React + A2UI 协议 |
| **应用业务层** | 固定的应用页面和功能 | React（普通组件） |
| **服务层** | WebSocket、多媒体、状态管理 | TypeScript Services |

### 技术选型原则

```
✅ 使用 A2UI 的场景：
- Canvas 页面：AI 发送 A2UI 消息 → 渲染动态 UI
- AI 生成的内容展示

❌ 不使用 A2UI 的场景：
- 设置页面：固定的表单和配置
- 聊天页面：固定的消息列表和输入框
- 语音助手：固定的交互界面
```

---

## 分层架构

### 目录结构

```
src/canvas-host/
├── a2ui-react/                      # A2UI 渲染引擎（独立可复用）
│   ├── components/                  # 14 个 A2UI 组件
│   │   ├── elements/
│   │   │   ├── A2uiButton.tsx
│   │   │   ├── A2uiText.tsx
│   │   │   ├── A2uiCard.tsx
│   │   │   └── ...
│   │   └── feedback/
│   │       ├── A2uiToast.tsx
│   │       └── A2uiSpinner.tsx
│   ├── context/
│   │   ├── A2uiThemeContext.tsx
│   │   └── A2uiDataContext.tsx
│   ├── services/
│   │   ├── A2uiMessageAdapter.ts    # A2UI 消息解析
│   │   └── A2uiBridgeAdapter.ts     # 桥接通信
│   ├── hooks/
│   │   └── useA2ui.ts
│   ├── utils/
│   │   └── pathResolver.ts          # 数据模型路径解析
│   └── index.ts                     # 导出渲染引擎 API
│
├── app-h5/                          # H5 应用层（新增）
│   ├── App.tsx                      # 应用入口
│   ├── main.tsx                     # 启动文件
│   │
│   ├── pages/                       # 页面组件（普通 React）
│   │   ├── canvas/
│   │   │   └── CanvasPage.tsx       # Canvas 页面（使用 A2UI）
│   │   ├── chat/
│   │   │   ├── ChatPage.tsx         # 聊天页面
│   │   │   ├── MessageList.tsx      # 消息列表
│   │   │   ├── MessageInput.tsx     # 输入框
│   │   │   └── MessageItem.tsx      # 消息项
│   │   └── settings/
│   │       ├── SettingsPage.tsx     # 设置页面
│   │       ├── GatewaySection.tsx   # Gateway 配置
│   │       └── DeviceSection.tsx    # 设备信息
│   │
│   ├── services/                    # 业务服务
│   │   ├── gateway/
│   │   │   ├── GatewayService.ts    # WebSocket 连接
│   │   │   ├── GatewayConnection.ts # 连接管理
│   │   │   └── GatewayTypes.ts      # 类型定义
│   │   ├── chat/
│   │   │   ├── ChatService.ts       # 聊天服务
│   │   │   ├── MessageStore.ts      # 消息存储
│   │   │   └── ChatTypes.ts         # 聊天类型
│   │   └── multimedia/
│   │       ├── CameraService.ts     # 相机服务（Phase 2）
│   │       ├── LocationService.ts   # 位置服务（Phase 2）
│   │       └── FileService.ts       # 文件服务（Phase 2）
│   │
│   ├── hooks/                       # 自定义 Hooks
│   │   ├── useGateway.ts            # Gateway 连接
│   │   ├── useChat.ts               # 聊天功能
│   │   └── useTheme.ts              # 主题切换
│   │
│   ├── context/                     # 应用状态管理
│   │   ├── AppContext.tsx           # 全局状态
│   │   └── ThemeContext.tsx         # 主题状态
│   │
│   ├── components/                  # 通用 UI 组件
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── TabBar.tsx
│   │   │   └── PageLayout.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       └── Modal.tsx
│   │
│   ├── styles/                      # 样式文件
│   │   ├── globals.css
│   │   ├── variables.css            # CSS 变量
│   │   └── themes/
│   │       ├── light.css
│   │       └── dark.css
│   │
│   └── utils/
│       ├── storage.ts               # LocalStorage 封装
│       └── logger.ts                # 日志工具
│
└── app-web/                         # Web 客户端（未来）
    └── （复用 a2ui-renderer）
```

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenClaw H5 应用架构                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  应用层 (app-h5)                                            │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  页面层 (Pages)                                         │ │ │
│  │  │  ┌──────────────┬──────────────┬──────────────────────┐ │ │ │
│  │  │  │ Canvas Page  │  Chat Page   │  Settings Page       │ │ │ │
│  │  │  │ (使用 A2UI)  │  (普通 React)│  (普通 React)        │ │ │ │
│  │  │  └──────────────┴──────────────┴──────────────────────┘ │ │ │
│  │  │                                                             │ │ │
│  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  业务逻辑层 (Services + Hooks)                      │ │ │ │
│  │  │  │  - GatewayService (WebSocket 连接)                  │ │ │ │
│  │  │  │  - ChatService (消息收发)                           │ │ │ │
│  │  │  │  - useGateway, useChat, useTheme                   │ │ │ │
│  │  │  └─────────────────────────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  通用 UI 组件 (components/)                             │ │ │
│  │  │  - Button, Input, Card, Modal, Header, TabBar...       │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  A2UI 渲染引擎层 (a2ui-react) - 独立可复用                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  14 个 A2UI 组件                                         │ │ │
│  │  │  - Button, Text, Card, Image, TextField...             │ │ │
│  │  │                                                             │ │ │
│  │  │  A2UI 消息适配器                                         │ │ │
│  │  │  - 解析 A2UI 协议消息                                    │ │ │
│  │  │  - 数据模型绑定                                         │ │ │
│  │  │  - 桥接通信 (iOS/Android/H5)                            │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  网络通信层                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  WebSocket 连接 (GatewayService)                        │ │ │
│  │  │  - 聊天消息 (chat)                                       │ │ │
│  │  │  - A2UI 消息 (a2ui)                                      │ │ │
│  │  │  - 动作响应 (action)                                     │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Chat MVP 设计

### 功能范围（Phase 1）

**核心目标**：1-2 周完成可测试的聊天功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| **聊天页面** | P0 | 消息列表 + 输入框 + 发送按钮 |
| **WebSocket 连接** | P0 | 与 Gateway 的实时双向通信 |
| **文本消息** | P0 | 发送/接收文本消息 |
| **消息历史** | P0 | 本地存储消息历史 |
| **连接配置** | P0 | 设置页面（Gateway 地址） |
| **基础样式** | P0 | 响应式布局 + 深浅主题 |

**Phase 1 不包含**：
- ❌ 多媒体附件（图片、位置、文件）→ Phase 2
- ❌ 语音输入/输出 → Phase 3
- ❌ Canvas 页面 → Phase 2
- ❌ 多会话管理 → Phase 2

### Chat 页面 UI 设计

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 OpenClaw 聊天                                   [⚙️ 设置]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  连接状态: ● 已连接到 peters-mac-studio.local           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  消息列表                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  AI (10:30):                                         │ │   │
│  │  │  你好！我是 OpenClaw AI 助手，有什么可以帮助你的？    │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  You (10:31):                                        │ │   │
│  │  │  今天天气怎么样？                                    │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  AI (10:31):                                         │ │   │
│  │  │  我来帮你查询今天的天气情况...                      │ │   │
│  │  │  🔄 正在思考...                                      │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  输入框                                                │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  输入消息...                              [发送]     │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 设置页面 UI 设计（简化版）

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ 设置                                                 [返回] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔌 Gateway 连接                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 连接状态: ● 已连接                                  │ │   │
│  │  │ 服务器: peters-mac-studio.local                     │ │   │
│  │  │ 地址: 192.168.1.100:18789                           │ │   │
│  │  │                                                      │ │   │
│  │  │ [断开连接]                                          │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔧 连接配置                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ Gateway 地址:                                        │ │   │
│  │  │ [ws://192.168.1.100:18789]                   │   │
│  │  │                                                      │ │   │
│  │  │ [连接]                                              │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎨 外观                                                 │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 主题模式:                                             │ │   │
│  │  │  ● 自动  ○ 深色  ○ 浅色                             │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ℹ️ 关于                                                 │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 版本: v1.0.0 (build 2025-02-04)                     │ │   │
│  │  │ OpenClaw H5 Client                                   │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 技术实现

### 1. Gateway 连接管理

**文件**：`src/canvas-host/app-h5/services/gateway/GatewayService.ts`

```typescript
/**
 * Gateway WebSocket 服务
 * 负责与 Gateway 的 WebSocket 连接和消息收发
 */
export class GatewayService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000; // 1s
  private maxReconnectDelay = 30000; // 30s
  private messageQueue: GatewayMessage[] = [];

  private listeners: {
    onOpen?: () => void;
    onMessage?: (message: GatewayMessage) => void;
    onError?: (error: Event) => void;
    onClose?: () => void;
  } = {};

  constructor(private url: string) {}

  /**
   * 连接到 Gateway
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('[Gateway] 已经连接');
      return;
    }

    console.log(`[Gateway] 连接到 ${this.url}`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[Gateway] WebSocket 已连接');
      this.reconnectDelay = 1000;
      this.flushMessageQueue();
      this.listeners.onOpen?.();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as GatewayMessage;
        console.log('[Gateway] 收到消息:', message);
        this.listeners.onMessage?.(message);
      } catch (error) {
        console.error('[Gateway] 消息解析错误:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[Gateway] WebSocket 错误:', error);
      this.listeners.onError?.(error);
    };

    this.ws.onclose = () => {
      console.log('[Gateway] WebSocket 已关闭');
      this.ws = null;
      this.scheduleReconnect();
      this.listeners.onClose?.();
    };
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log('[Gateway] 已断开连接');
  }

  /**
   * 发送消息到 Gateway
   */
  send(message: GatewayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[Gateway] 发送消息:', message);
    } else {
      console.warn('[Gateway] 未连接，消息加入队列');
      this.messageQueue.push(message);
    }
  }

  /**
   * 清空消息队列
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
        console.log('[Gateway] 发送队列消息:', message);
      }
    }
  }

  /**
   * 自动重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    console.log(`[Gateway] ${this.reconnectDelay}ms 后重连...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();

      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * 监听连接事件
   */
  on(event: 'open' | 'message' | 'error' | 'close', callback: () => void): void;
  on(event: 'message', callback: (message: GatewayMessage) => void): void;
  on(event: 'error', callback: (error: Event) => void): void;
  on(event: string, callback: any): void {
    switch (event) {
      case 'open':
        this.listeners.onOpen = callback;
        break;
      case 'message':
        this.listeners.onMessage = callback;
        break;
      case 'error':
        this.listeners.onError = callback;
        break;
      case 'close':
        this.listeners.onClose = callback;
        break;
    }
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Gateway 消息类型
 */
export interface GatewayMessage {
  type: 'chat' | 'a2ui' | 'action' | 'error';
  payload: any;
  timestamp: number;
  sessionId?: string;
}

/**
 * 聊天消息
 */
export interface ChatMessagePayload {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * A2UI 消息
 */
export interface A2uiMessagePayload {
  surfaceId: string;
  messages: A2uiMessage[];
}
```

### 2. Chat 聊天服务

**文件**：`src/canvas-host/app-h5/services/chat/ChatService.ts`

```typescript
import { GatewayService, GatewayMessage, ChatMessagePayload } from '../gateway/GatewayService';

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
  error?: string;
}

/**
 * 聊天服务
 */
export class ChatService {
  private sessionId = 'main';
  private messages: ChatMessage[] = [];
  private listeners: Set<(messages: ChatMessage[]) => void> = new Set();

  constructor(private gateway: GatewayService) {
    // 监听 Gateway 消息
    this.gateway.on('message', (message: GatewayMessage) => {
      if (message.type === 'chat') {
        this.handleChatMessage(message);
      }
    });
  }

  /**
   * 发送文本消息
   */
  async sendText(text: string): Promise<void> {
    const message: ChatMessage = {
      id: this.generateId(),
      sessionId: this.sessionId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      status: 'sending'
    };

    // 添加到本地消息列表
    this.addMessage(message);

    // 发送到 Gateway
    this.gateway.send({
      type: 'chat',
      payload: {
        sessionId: this.sessionId,
        role: 'user',
        content: text,
        timestamp: message.timestamp
      } as ChatMessagePayload,
      timestamp: message.timestamp,
      sessionId: this.sessionId
    });

    // 更新状态为已发送
    this.updateMessageStatus(message.id, 'sent');
  }

  /**
   * 获取消息列表
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * 清空消息
   */
  clearMessages(): void {
    this.messages = [];
    this.notifyListeners();
  }

  /**
   * 订阅消息更新
   */
  subscribe(callback: (messages: ChatMessage[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 处理来自 Gateway 的聊天消息
   */
  private handleChatMessage(gatewayMessage: GatewayMessage): void {
    const payload = gatewayMessage.payload as ChatMessagePayload;

    const message: ChatMessage = {
      id: this.generateId(),
      sessionId: payload.sessionId || this.sessionId,
      role: payload.role,
      content: payload.content,
      timestamp: payload.timestamp
    };

    this.addMessage(message);
  }

  /**
   * 添加消息到列表
   */
  private addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.notifyListeners();
  }

  /**
   * 更新消息状态
   */
  private updateMessageStatus(id: string, status: 'sending' | 'sent' | 'error'): void {
    const message = this.messages.find(m => m.id === id);
    if (message) {
      message.status = status;
      this.notifyListeners();
    }
  }

  /**
   * 通知所有订阅者
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback([...this.messages]));
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 3. useChat Hook

**文件**：`src/canvas-host/app-h5/hooks/useChat.ts`

```typescript
import { useState, useEffect } from 'react';
import { ChatService, ChatMessage } from '../services/chat/ChatService';

/**
 * 聊天 Hook
 */
export function useChat(chatService: ChatService) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 订阅消息更新
    const unsubscribe = chatService.subscribe((updatedMessages) => {
      setMessages(updatedMessages);
    });

    // 初始化消息列表
    setMessages(chatService.getMessages());

    return unsubscribe;
  }, [chatService]);

  const sendText = async (text: string) => {
    if (!text.trim()) return;
    await chatService.sendText(text);
  };

  const clearMessages = () => {
    chatService.clearMessages();
  };

  return {
    messages,
    sendText,
    clearMessages,
    isConnected
  };
}
```

### 4. Chat 页面组件

**文件**：`src/canvas-host/app-h5/pages/chat/ChatPage.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { ChatService } from '../../services/chat/ChatService';
import { GatewayService } from '../../services/gateway/GatewayService';
import './ChatPage.css';

interface ChatPageProps {
  gateway: GatewayService;
  chatService: ChatService;
}

export const ChatPage: React.FC<ChatPageProps> = ({ gateway, chatService }) => {
  const { messages, sendText, clearMessages } = useChat(chatService);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 监听连接状态
  useEffect(() => {
    const updateConnectionStatus = () => setIsConnected(gateway.isConnected);
    updateConnectionStatus();

    gateway.on('open', updateConnectionStatus);
    gateway.on('close', updateConnectionStatus);

    return () => {
      // 清理监听器（如果需要）
    };
  }, [gateway]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    await sendText(inputText);
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="chat-page">
      {/* 头部 */}
      <header className="chat-header">
        <h1>💬 OpenClaw 聊天</h1>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● 已连接' : '○ 未连接'}
        </div>
      </header>

      {/* 消息列表 */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>👋 开始对话吧！</p>
            <p className="hint">我是 OpenClaw AI 助手，有什么可以帮助你的？</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${message.role === 'user' ? 'user-message' : 'ai-message'}`}
          >
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? 'You' : 'AI'}
              </span>
              <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>
            <div className="message-content">
              {message.content}
              {message.status === 'sending' && <span className="sending-indicator">发送中...</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="input-container">
        <textarea
          className="message-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!inputText.trim() || !isConnected}
        >
          发送
        </button>
      </div>
    </div>
  );
};
```

### 5. Chat 页面样式

**文件**：`src/canvas-host/app-h5/pages/chat/ChatPage.css`

```css
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.chat-header {
  padding: 16px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h1 {
  margin: 0;
  font-size: 1.2rem;
}

.connection-status {
  font-size: 0.875rem;
  padding: 4px 12px;
  border-radius: 16px;
  background-color: var(--bg-tertiary);
}

.connection-status.connected {
  color: #10b981;
}

.connection-status.disconnected {
  color: #ef4444;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary);
}

.empty-state .hint {
  font-size: 0.875rem;
  margin-top: 8px;
}

.message-item {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.user-message {
  align-self: flex-end;
}

.ai-message {
  align-self: flex-start;
}

.message-header {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.message-role {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.message-time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.message-content {
  padding: 12px;
  border-radius: 12px;
  background-color: var(--bg-tertiary);
  line-height: 1.5;
}

.user-message .message-content {
  background-color: var(--accent-color);
  color: white;
}

.sending-indicator {
  margin-left: 8px;
  font-size: 0.875rem;
  opacity: 0.7;
}

.input-container {
  padding: 16px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 8px;
}

.message-input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 1rem;
  resize: none;
  font-family: inherit;
}

.message-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.send-button {
  padding: 12px 24px;
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.send-button:hover:not(:disabled) {
  opacity: 0.9;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 6. 全局 CSS 变量

**文件**：`src/canvas-host/app-h5/styles/variables.css`

```css
:root {
  /* 浅色主题 */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --border-color: #e5e7eb;
  --accent-color: #3b82f6;
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
}

[data-theme='dark'] {
  /* 深色主题 */
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --bg-tertiary: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-tertiary: #9ca3af;
  --border-color: #4b5563;
  --accent-color: #60a5fa;
}
```

---

## 实施计划

### Phase 1: Chat MVP（1-2 周）

**目标**：完成可测试的聊天功能

#### Week 1: 核心功能（5 天）

| 任务 | 时间 | 说明 |
|------|------|------|
| **Day 1-2: 项目搭建** | 2 天 | - 创建目录结构<br>- 配置 Vite 构建<br>- 设置全局样式 |
| **Day 3-4: Gateway 服务** | 2 天 | - GatewayService 实现<br>- WebSocket 连接<br>- 消息队列 |
| **Day 5: Chat 服务** | 1 天 | - ChatService 实现<br>- 消息存储<br>- useChat Hook |

#### Week 2: UI 和集成（5 天）

| 任务 | 时间 | 说明 |
|------|------|------|
| **Day 1-2: Chat 页面** | 2 天 | - ChatPage 组件<br>- 消息列表<br>- 输入框 |
| **Day 3: 设置页面** | 1 天 | - Gateway 连接配置<br>- 主题切换 |
| **Day 4: 样式和响应式** | 1 天 | - CSS 变量<br>- 移动端适配 |
| **Day 5: 测试和修复** | 1 天 | - 功能测试<br>- Bug 修复 |

### Phase 2: 多媒体功能（1-2 周）

| 功能 | 时间 | 说明 |
|------|------|------|
| **相机拍照** | 2 天 | MediaDevices API |
| **位置服务** | 1 天 | Geolocation API |
| **文件上传** | 2 天 | FormData + fetch |
| **图片附件** | 2 天 | 消息中显示图片 |

### Phase 3: 语音助手（1-2 周）

| 功能 | 时间 | 说明 |
|------|------|------|
| **语音输入** | 3 天 | MediaRecorder + 云 ASR |
| **语音输出** | 2 天 | 云 TTS + Audio API |
| **语音助手页面** | 2 天 | 对话 UI |

### Phase 4: Canvas 集成（1 周）

| 功能 | 时间 | 说明 |
|------|------|------|
| **Canvas 页面** | 2 天 | 使用 A2UI 渲染 |
| **A2UI 消息处理** | 2 天 | 解析 A2UI 消息 |
| **测试** | 1 天 | 端到端测试 |

---

## 关键技术点

### 1. 状态管理

**使用 React Context + Hooks**，不需要 Redux：

```typescript
// src/canvas-host/app-h5/context/AppContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { GatewayService } from '../services/gateway/GatewayService';
import { ChatService } from '../services/chat/ChatService';

interface AppContextType {
  gateway: GatewayService;
  chatService: ChatService;
  theme: 'light' | 'dark' | 'auto';
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const gateway = new GatewayService('ws://localhost:18789');
  const chatService = new ChatService(gateway);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  return (
    <AppContext.Provider value={{ gateway, chatService, theme, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
```

### 2. 本地存储

**使用 localStorage 保存配置**：

```typescript
// src/canvas-host/app-h5/utils/storage.ts
export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  }
};
```

### 3. 路由（可选）

**使用简单的状态路由**，不需要 React Router：

```typescript
// 在 App.tsx 中
type Page = 'chat' | 'settings' | 'canvas';

const [currentPage, setCurrentPage] = useState<Page>('chat');

// 渲染当前页面
{currentPage === 'chat' && <ChatPage />}
{currentPage === 'settings' && <SettingsPage />}
{currentPage === 'canvas' && <CanvasPage />}
```

---

## 与 A2UI 的关系

### A2UI 的使用场景

**A2UI 用于 Canvas 页面**（AI 生成动态 UI）：

```typescript
// src/canvas-host/app-h5/pages/canvas/CanvasPage.tsx
import { applyMessages } from '../../../a2ui-react'; // 使用 A2UI 渲染引擎

export const CanvasPage: React.FC = () => {
  useEffect(() => {
    // 监听来自 Gateway 的 A2UI 消息
    gateway.on('message', (message) => {
      if (message.type === 'a2ui') {
        // 使用 A2UI 渲染引擎渲染动态 UI
        applyMessages(message.payload.messages);
      }
    });
  }, [gateway]);

  return (
    <div id="a2ui-canvas">
      {/* A2UI 渲染的 UI 会挂载到这里 */}
    </div>
  );
};
```

**普通页面不用 A2UI**：

```typescript
// ❌ 错误：设置页面不应该用 A2UI
const generateSettingsMessages = () => { /* ... */ }; // 不要这样做

// ✅ 正确：直接用 React 组件
export const SettingsPage: React.FC = () => {
  return (
    <div className="settings-page">
      <h1>⚙️ 设置</h1>
      {/* ... */}
    </div>
  );
};
```

### A2UI 渲染引擎的复用

**a2ui-react 可以被其他项目复用**：

```typescript
// 在其他项目中使用 A2UI 渲染引擎
import { applyMessages, A2uiButton, A2uiText } from '@openclaw/a2ui-react';

// 或者直接使用组件
<A2uiButton text="点击我" onClick={() => {}} />
```

---

## 总结

### 架构优势

✅ **清晰的分层**：A2UI 渲染引擎层与应用业务层分离
✅ **易于复用**：a2ui-react 可以被其他项目使用
✅ **Chat 优先**：快速交付 MVP，获得早期反馈
✅ **渐进式开发**：按阶段实现，降低风险

### 技术栈

- **UI 框架**：React 18+
- **构建工具**：Vite 6
- **状态管理**：React Context + Hooks
- **样式**：CSS 变量 + 模块化 CSS
- **通信**：WebSocket
- **类型**：TypeScript 5+

### 与原设计的对比

| 方面 | 原设计 | 新设计 |
|------|--------|--------|
| **A2UI 使用** | 所有页面都用 A2UI | 只有 Canvas 页面用 A2UI |
| **架构分层** | 混在一起 | 清晰分离（渲染引擎层 + 应用层） |
| **复用性** | 不考虑复用 | a2ui-react 可独立复用 |
| **开发优先级** | 所有功能并行 | Chat MVP 优先 |
| **技术复杂度** | 过度设计 | 简洁实用 |

---

**文档版本**: v2.0
**创建日期**: 2025-02-04
**作者**: OpenClaw Team
**状态**: 待评审
