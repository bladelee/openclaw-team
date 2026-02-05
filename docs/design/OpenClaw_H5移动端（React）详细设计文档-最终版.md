# OpenClaw H5移动端（React）详细设计文档 - 最终版

## 文档版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2024-06-10 | 初始设计文档 |
| v2.0 | 2024-06-12 | 优化版设计文档 |
| v3.0 | 2025-02-03 | 最终整合版（基于现有代码库评审） |

---

## 第一部分：现有设计评审意见

### 1.1 与现有代码库的对比分析

#### 现有实现概览（基于代码库探索）

通过探索 OpenClaw 代码库，发现已有以下 A2UI 相关实现：

1. **A2UI 核心模块** (`src/canvas-host/a2ui.ts`)
   - 提供 HTTP 服务处理 A2UI 资源
   - WebSocket 实时重载功能
   - 跨平台桥接注入（iOS/Android/H5）

2. **桥接通信**
   - iOS: `window.webkit.messageHandlers.openclawCanvasA2UIAction.postMessage`
   - Android: `window.openclawCanvasA2UIAction.postMessage`
   - 全局接口: `OpenClaw.postMessage` 和 `OpenClaw.sendUserAction`

3. **A2UI JSONL 工具** (`src/cli/nodes-cli/a2ui-jsonl.ts`)
   - 支持 v0.8 和 v0.9 版本
   - 动作类型: `beginRendering`, `surfaceUpdate`, `dataModelUpdate`, `deleteSurface`, `createSurface`
   - 验证与错误报告

4. **Canvas 工具** (`src/agents/tools/canvas-tool.ts`)
   - 支持 `a2ui_push` 和 `a2ui_reset` 动作
   - 通过 gateway 命令集成

#### 设计文档与现有实现的契合度

| 设计要点 | 现有实现状态 | 评估 |
|---------|-------------|------|
| A2UI 消息协议 | 已有 v0.8/v0.9 支持 | ✅ 契合 |
| iOS/Android 桥接 | 已实现基础桥接 | ✅ 契合 |
| 纯 H5 场景 | 有 fallback bridge | ✅ 契合 |
| 状态反馈事件 | `openclaw:a2ui-action-status` | ✅ 契合 |
| React 组件封装 | **不存在** | ❌ 需新增 |
| Context 状态管理 | **不存在** | ❌ 需新增 |
| 主题系统 | 仅 CSS 变量，无处理器 | ⚠️ 需增强 |
| Surface 管理 | 基础支持 | ⚠️ 需扩展 |

### 1.2 设计文档优点

1. **架构清晰**：分层设计合理，从 UI 组件到桥接层层次分明
2. **Context 拆分优化**：最终版将 ActionContext 拆分为 PendingActionContext 和 ToastContext，降低重渲染
3. **性能考虑**：使用 useMemo/useCallback 缓存，避免不必要的重渲染
4. **兼容性设计**：UUID 降级、多平台检测、低版本系统适配
5. **容错机制**：桥接重试、超时处理、参数验证
6. **测试覆盖全面**：单元测试、集成测试、真机测试方案完整

### 1.3 设计文档改进建议

#### 1.3.1 与现有代码库集成

**问题**：设计文档未充分考虑与现有 `src/canvas-host/a2ui.ts` 的集成

**建议**：
- React H5 端应复用现有 `src/canvas-host/a2ui.ts` 的桥接注入逻辑
- A2UI 消息处理器应兼容现有的 v0.8/v0.9 JSONL 格式
- 考虑直接使用现有的 `a2ui-jsonl.ts` 工具而非重新实现

**修改建议**：
```typescript
// 修改前：完全重新实现消息处理器
export class A2uiMessageProcessor {
  processMessages(messages: A2uiMessage[]) {
    // 自定义实现...
  }
}

// 修改后：复用现有实现
import { A2uiJsonlProcessor } from 'openclaw/a2ui-jsonl';
// 扩展而非重写
export class ReactA2uiProcessor extends A2uiJsonlProcessor {
  // React 特定的状态同步逻辑
}
```

#### 1.3.2 主题系统设计

**问题**：主题协议定义不完整，缺少与现有 CSS 变量的映射

**建议**：
- 明确现有 CSS 变量列表（从 A2UI index.html 提取）
- 定义主题变量与 React Context 的同步机制
- 考虑使用 CSS-in-JS 方案（如 styled-components）而非纯 CSS Modules

**修改建议**：
```typescript
// 补充完整的主题类型定义
interface OpenClawTheme {
  // 基础颜色
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
  };
  // 平台差异
  platform: {
    android: PlatformStyle;
    ios: PlatformStyle;
  };
  // 组件样式
  components: {
    Button: ButtonStyles;
    Card: CardStyles;
    // ... 其他组件
  };
  // CSS 变量映射
  cssVars: Record<string, string>;
}
```

#### 1.3.3 目录结构调整

**问题**：`common` 目录定位模糊，与现有代码库组织方式不一致

**建议**：
- 考虑将工具函数放入现有 `src/utils/` 或 `src/canvas-host/`
- 类型定义统一管理在 `src/types/`
- 遵循现有 monorepo 结构（extensions/, apps/, src/）

**修改后的目录结构**：
```
src/
├── canvas-host/
│   ├── a2ui-react/          # 新增：React H5 端实现
│   │   ├── components/      # React 组件封装
│   │   ├── context/         # React Context
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── services/        # 服务层（复用现有逻辑）
│   │   └── index.ts
│   ├── a2ui.ts              # 现有：桥接注入（保持不变）
│   └── server.ts            # 现有：Canvas Host Server
├── types/
│   └── a2ui.d.ts            # 扩展：新增 React 类型
└── utils/
    └── a2ui/                # 新增：A2UI 工具函数
```

#### 1.3.4 组件实现细节

**问题**：A2UI 组件类型列表不完整，未引用现有 A2UI 规范

**建议**：
- 引用 `vendor/a2ui/specification/0.8/` 中的完整组件列表
- 明确每个组件的 props 定义与现有 A2UI 规范的映射
- 考虑使用代码生成工具从规范自动生成 TypeScript 类型

**补充组件列表**：
```typescript
// 从 vendor/a2ui/specification/0.8/ 提取的组件类型
type A2uiComponentType =
  | 'AudioPlayer'
  | 'Button'
  | 'Card'
  | 'Column'
  | 'Container'
  | 'Divider'
  | 'Image'
  | 'Markdown'
  | 'Modal'
  | 'Progress'
  | 'Row'
  | 'Text'
  | 'TextField'
  | 'VideoPlayer';
```

#### 1.3.5 测试与验证

**问题**：未明确如何验证与现有 A2UI 实现的兼容性

**建议**：
- 添加兼容性测试：使用现有 `a2ui-jsonl.ts` 生成的消息测试 React 渲染
- 添加桥接测试：模拟 iOS/Android 原生环境测试通信
- 添加性能测试：对比现有实现与 React 实现的渲染性能

---

## 第二部分：最终详细设计文档

### 2.1 项目概述

#### 2.1.1 目标

基于现有 OpenClaw A2UI 基础设施，开发 React H5 移动端，实现：

1. **协议兼容**：完全兼容现有 A2UI v0.8/v0.9 消息协议
2. **桥接复用**：复用现有 iOS/Android/H5 桥接逻辑
3. **组件增强**：提供 React 组件封装，保留现有 A2UI 组件能力
4. **状态管理**：基于 React Context 实现全局状态管理
5. **性能优化**：优化渲染性能，降低不必要的重渲染
6. **可扩展性**：为未来小程序/桌面端扩展预留空间

#### 2.1.2 技术栈

| 类别 | 技术选型 | 说明 |
|------|---------|------|
| 前端框架 | React 18+ | 支持 Concurrent Mode |
| 语言 | TypeScript 5+ | 严格类型检查 |
| 构建工具 | Vite | 快速开发构建 |
| 样式方案 | CSS Modules + CSS Variables | 隔离与主题支持 |
| 测试框架 | Vitest + React Testing Library | 与现有测试体系一致 |
| 包管理 | pnpm | 与项目一致 |

### 2.2 核心协议与接口

#### 2.2.1 A2UI 消息协议（复用现有 v0.8/v0.9）

**现有实现位置**：`src/cli/nodes-cli/a2ui-jsonl.ts`

**支持的消息类型**：
```typescript
type A2uiMessage =
  | { type: 'beginRendering'; payload: A2uiRoot }
  | { type: 'surfaceUpdate'; surfaceId: string; payload: A2uiSurface }
  | { type: 'dataModelUpdate'; surfaceId: string; payload: DataModel }
  | { type: 'deleteSurface'; surfaceId: string }
  | { type: 'createSurface'; surfaceId: string; payload: A2uiSurface };
```

**React 适配接口**：
```typescript
// 全局 API（与现有 bootstrap.js 一致）
window.openclawA2UI = {
  applyMessages(messages: A2uiMessage[]): Promise<{ ok: boolean; surfaces: string[] }>;
  reset(): Promise<{ ok: boolean }>;
  getSurfaces(): string[];
};
```

#### 2.2.2 前端-原生桥接协议（复用现有）

**现有实现位置**：`src/canvas-host/a2ui.ts`

**接口定义**：
```typescript
// iOS 桥接
interface WebKitMessageHandler {
  openclawCanvasA2UIAction: {
    postMessage(message: { userAction: UserAction }): void;
  };
}

// Android 桥接
interface AndroidBridge {
  postMessage(message: string): void; // JSON 字符串
}

// 用户动作结构
interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string; // ISO 8601
  context: Record<string, any>;
}
```

#### 2.2.3 状态通信协议

**事件名称**：`openclaw:a2ui-action-status`

**事件数据**：
```typescript
interface ActionStatusEvent {
  id: string; // 对应 UserAction.id
  ok: boolean;
  error?: string;
}
```

### 2.3 整体架构设计

#### 2.3.1 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (App.tsx)                      │
├─────────────────────────────────────────────────────────┤
│              React 组件层 (A2UI Components)              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
│  │ A2uiSurface │ │ A2uiButton  │ │ ...其他组件         │ │
│  └─────────────┘ └─────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                    状态管理层 (Contexts)                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ MessageContext│ │ThemeContext │ │ ActionContext    │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────────────┤
│              A2UI 消息处理层 (复用现有逻辑)              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  A2uiJsonlProcessor (来自 a2ui-jsonl.ts)           │ │
│  │  + React 状态同步适配层                              │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                  桥接适配层 (复用现有)                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  CanvasHostA2UI (来自 canvas-host/a2ui.ts)          │ │
│  │  + React 事件监听适配                                │ │
│  └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                   基础设施层                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ 工具函数     │ │ 类型定义     │ │ 样式系统         │ │
│  └──────────────┘ └──────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### 2.3.2 数据流向

**UI 渲染流程**：
```
原生/后端 → A2UI 消息 (JSONL)
    ↓
openclawA2UI.applyMessages()
    ↓
A2uiJsonlProcessor 解析消息
    ↓
React Context 更新状态
    ↓
组件重新渲染
```

**交互动作流程**：
```
用户点击组件
    ↓
生成 UserAction
    ↓
桥接层发送 (iOS/Android/H5)
    ↓
原生/后端处理
    ↓
触发 openclaw:a2ui-action-status 事件
    ↓
React Context 更新状态
    ↓
UI 反馈 (Toast/状态提示)
```

### 2.4 目录结构设计

#### 2.4.1 完整目录结构

```
src/canvas-host/a2ui-react/          # React H5 端根目录
├── components/                      # 组件层
│   ├── surfaces/                    # Surface 容器组件
│   │   ├── A2uiSurface.tsx          # Surface 核心
│   │   ├── A2uiSurfaceRoot.tsx      # 根 Surface
│   │   └── EmptySurface.tsx         # 空状态
│   ├── elements/                    # A2UI 基础组件
│   │   ├── A2uiAudioPlayer.tsx
│   │   ├── A2uiButton.tsx
│   │   ├── A2uiCard.tsx
│   │   ├── A2uiColumn.tsx
│   │   ├── A2uiContainer.tsx
│   │   ├── A2uiDivider.tsx
│   │   ├── A2uiImage.tsx
│   │   ├── A2uiMarkdown.tsx
│   │   ├── A2uiModal.tsx
│   │   ├── A2uiProgress.tsx
│   │   ├── A2uiRow.tsx
│   │   ├── A2uiText.tsx
│   │   ├── A2uiTextField.tsx
│   │   ├── A2uiVideoPlayer.tsx
│   │   └── index.ts
│   ├── feedback/                    # 反馈组件
│   │   ├── Toast.tsx
│   │   ├── Spinner.tsx
│   │   ├── Status.tsx
│   │   └── index.ts
│   └── A2uiHost.tsx                 # A2UI 根容器
├── context/                         # React Context
│   ├── A2uiMessageContext.tsx       # 消息状态管理
│   ├── A2uiThemeContext.tsx         # 主题管理
│   ├── A2uiActionContext.tsx        # 动作状态管理
│   └── index.ts
├── hooks/                           # 自定义 Hooks
│   ├── useA2uiMessages.ts
│   ├── useA2uiAction.ts
│   ├── useA2uiTheme.ts
│   ├── useMobileAdapt.ts
│   └── index.ts
├── services/                        # 服务层
│   ├── messageAdapter.ts            # 消息适配器（连接现有 a2ui-jsonl）
│   ├── bridgeAdapter.ts             # 桥接适配器（连接现有 canvas-host）
│   ├── actionService.ts             # 动作服务
│   └── index.ts
├── styles/                          # 样式
│   ├── theme.css                    # 全局 CSS 变量
│   ├── reset.css                    # 样式重置
│   └── mobile.css                   # 移动端适配
├── utils/                           # 工具函数
│   ├── deviceDetect.ts
│   ├── uuid.ts
│   ├── logger.ts
│   └── index.ts
├── types/                           # 类型定义
│   ├── a2ui.ts                      # A2UI 类型（扩展 vendor/a2ui/specification）
│   ├── bridge.ts                    # 桥接类型
│   ├── theme.ts                     # 主题类型
│   └── index.ts
├── App.tsx                          # 应用入口
└── index.ts                         # 导出入口
```

#### 2.4.2 与现有代码库的关系

```
现有代码库                          新增 React H5
├── src/
│   ├── canvas-host/               ├── src/canvas-host/a2ui-react/  (新增)
│   │   ├── a2ui.ts                │       └── services/
│   │   └── server.ts              │           ├── messageAdapter.ts (引用 a2ui-jsonl.ts)
│   ├── cli/nodes-cli/             │           └── bridgeAdapter.ts  (引用 a2ui.ts)
│   │   └── a2ui-jsonl.ts          └── src/types/
│   └── vendor/a2u/                     └── a2ui.ts (扩展 specification)
│       └── specification/0.8/
```

### 2.5 核心模块详细设计

#### 2.5.1 消息适配器（复用现有逻辑）

```typescript
// src/canvas-host/a2ui-react/services/messageAdapter.ts
import { A2uiJsonlProcessor } from '../../cli/nodes-cli/a2ui-jsonl';
import type { A2uiMessage, Surface } from './types';

/**
 * A2UI 消息适配器
 * 复用现有的 A2uiJsonlProcessor，添加 React 状态同步
 */
export class ReactMessageAdapter {
  private processor: A2uiJsonlProcessor;
  private listeners: Set<(surfaces: Map<string, Surface>) => void> = new Set();

  constructor() {
    this.processor = new A2uiJsonlProcessor();
  }

  /**
   * 处理 A2UI 消息
   */
  async applyMessages(messages: A2uiMessage[]): Promise<{ ok: boolean; surfaces: string[] }> {
    try {
      // 复用现有处理逻辑
      for (const msg of messages) {
        await this.processor.processAction(msg);
      }

      // 获取更新后的 Surface
      const surfaces = this.processor.getSurfaces();

      // 通知监听器（React Context）
      this.notifyListeners(surfaces);

      return {
        ok: true,
        surfaces: Array.from(surfaces.keys())
      };
    } catch (error) {
      console.error('A2UI 消息处理失败:', error);
      return { ok: false, surfaces: [] };
    }
  }

  /**
   * 重置所有 Surface
   */
  reset(): { ok: boolean } {
    this.processor.reset();
    this.notifyListeners(new Map());
    return { ok: true };
  }

  /**
   * 获取 Surface 列表
   */
  getSurfaces(): string[] {
    return Array.from(this.processor.getSurfaces().keys());
  }

  /**
   * 订阅 Surface 变更
   */
  subscribe(listener: (surfaces: Map<string, Surface>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(surfaces: Map<string, Surface>) {
    this.listeners.forEach(listener => listener(surfaces));
  }
}
```

#### 2.5.2 桥接适配器（复用现有）

```typescript
// src/canvas-host/a2ui-react/services/bridgeAdapter.ts
import type { UserAction } from './types';

/**
 * 桥接适配器
 * 复用现有的 CanvasHostA2UI 桥接逻辑
 */
export class ReactBridgeAdapter {
  private isAndroid: boolean;
  private isIOS: boolean;
  private isPureH5: boolean;

  constructor() {
    const ua = navigator.userAgent;
    this.isAndroid = /Android/i.test(ua);
    this.isIOS = /iPhone|iPad|iPod/i.test(ua);
    this.isPureH5 = !this.isAndroid && !this.isIOS;
  }

  /**
   * 发送用户动作
   */
  async postMessage(userAction: UserAction): Promise<{ ok: boolean; error?: string }> {
    try {
      if (this.isPureH5) {
        // 纯 H5 场景：调用后端接口
        return await this.postToBackend(userAction);
      }

      // 原生桥接场景
      const bridge = this.getBridge();
      if (!bridge) {
        throw new Error('原生桥接未找到');
      }

      const payload = this.isAndroid
        ? JSON.stringify({ userAction })
        : { userAction };

      bridge.postMessage(payload);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取原生桥接对象
   */
  private getBridge() {
    if (this.isIOS) {
      return window.webkit?.messageHandlers?.openclawCanvasA2UIAction;
    }
    return window.openclawCanvasA2UIAction;
  }

  /**
   * 纯 H5 场景：发送到后端
   */
  private async postToBackend(userAction: UserAction): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch('/api/a2ui/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAction })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '网络请求失败'
      };
    }
  }
}

// 全局桥接实例（单例）
let bridgeInstance: ReactBridgeAdapter | null = null;

export const getBridgeAdapter = () => {
  if (!bridgeInstance) {
    bridgeInstance = new ReactBridgeAdapter();
  }
  return bridgeInstance;
};
```

#### 2.5.3 React Context 设计

```typescript
// src/canvas-host/a2ui-react/context/A2uiMessageContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { ReactMessageAdapter } from '../services/messageAdapter';
import type { A2uiMessage, Surface } from '../types';

interface A2uiMessageContextValue {
  surfaces: Map<string, Surface>;
  applyMessages: (messages: A2uiMessage[]) => Promise<{ ok: boolean; surfaces: string[] }>;
  reset: () => { ok: boolean };
  getSurfaces: () => string[];
}

const A2uiMessageContext = createContext<A2uiMessageContextValue | undefined>(undefined);

export const A2uiMessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adapter] = useState(() => new ReactMessageAdapter());
  const [surfaces, setSurfaces] = useState<Map<string, Surface>>(new Map());

  useEffect(() => {
    // 订阅 Surface 变更
    const unsubscribe = adapter.subscribe((newSurfaces) => {
      setSurfaces(new Map(newSurfaces));
    });

    return unsubscribe;
  }, [adapter]);

  const applyMessages = useCallback(async (messages: A2uiMessage[]) => {
    return await adapter.applyMessages(messages);
  }, [adapter]);

  const reset = useCallback(() => {
    return adapter.reset();
  }, [adapter]);

  const getSurfaces = useCallback(() => {
    return adapter.getSurfaces();
  }, [adapter]);

  const contextValue = useMemo(() => ({
    surfaces,
    applyMessages,
    reset,
    getSurfaces
  }), [surfaces, applyMessages, reset, getSurfaces]);

  return (
    <A2uiMessageContext.Provider value={contextValue}>
      {children}
    </A2uiMessageContext.Provider>
  );
};

export const useA2uiMessages = () => {
  const context = useContext(A2uiMessageContext);
  if (!context) {
    throw new Error('useA2uiMessages 必须在 A2uiMessageProvider 内使用');
  }
  return context;
};
```

#### 2.5.4 主题系统设计

```typescript
// src/canvas-host/a2ui-react/context/A2uiThemeContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import type { A2uiTheme } from '../types';

// 默认主题（从现有 A2UI index.html 提取）
const defaultTheme: A2uiTheme = {
  colors: {
    primary: '#06b6d4',
    secondary: '#0891b2',
    background: '#071016',
    surface: '#0f1720',
    text: '#ffffff',
    textSecondary: '#94a3b8'
  },
  platform: {
    android: {
      shadow: '0 2px 10px rgba(6, 182, 212, 0.14)',
      blur: '10px'
    },
    ios: {
      shadow: '0 10px 25px rgba(6, 182, 212, 0.18)',
      blur: '14px'
    }
  },
  components: {
    Button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '500'
    },
    Card: {
      padding: '16px',
      borderRadius: '12px',
      backgroundColor: 'rgba(15, 23, 32, 0.8)'
    }
  },
  cssVars: {
    '--openclaw-primary': '#06b6d4',
    '--openclaw-background': '#071016',
    '--openclaw-surface': '#0f1720',
    '--openclaw-text': '#ffffff',
    '--openclaw-a2ui-inset-top': '0px',
    '--openclaw-a2ui-inset-bottom': '0px'
  }
};

interface A2uiThemeContextValue {
  theme: A2uiTheme;
  platform: 'ios' | 'android' | 'unknown';
}

const A2uiThemeContext = createContext<A2uiThemeContextValue | undefined>(undefined);

export const A2uiThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 检测平台
  const platform = useMemo(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios' as const;
    if (/Android/i.test(ua)) return 'android' as const;
    return 'unknown' as const;
  }, []);

  const contextValue = useMemo(() => ({
    theme: defaultTheme,
    platform
  }), [platform]);

  return (
    <A2uiThemeContext.Provider value={contextValue}>
      {children}
    </A2uiThemeContext.Provider>
  );
};

export const useA2uiTheme = () => {
  const context = useContext(A2uiThemeContext);
  if (!context) {
    throw new Error('useA2uiTheme 必须在 A2uiThemeProvider 内使用');
  }
  return context;
};
```

#### 2.5.5 组件实现示例（Button）

```typescript
// src/canvas-host/a2ui-react/components/elements/A2uiButton.tsx
import React, { useCallback, useContext } from 'react';
import { useA2uiTheme } from '../../context/A2uiThemeContext';
import { useA2uiAction } from '../../context/A2uiActionContext';
import { getActionId } from '../../utils/uuid';
import { getBridgeAdapter } from '../../services/bridgeAdapter';
import type { A2uiButtonProps } from '../../types';
import styles from './A2uiButton.module.css';

export const A2uiButton: React.FC<A2uiButtonProps> = ({
  id,
  text,
  action,
  style,
  disabled = false,
  isLoading = false
}) => {
  const { theme, platform } = useA2uiTheme();
  const { setPendingAction } = useA2uiAction();

  // 合并样式（主题 + 平台差异 + 自定义）
  const buttonStyle = {
    ...theme.components.Button,
    ...style,
    boxShadow: platform === 'android'
      ? theme.platform.android.shadow
      : theme.platform.ios.shadow
  };

  // 处理点击
  const handleClick = useCallback(async () => {
    if (disabled || isLoading || !action) return;

    const actionId = getActionId();
    setPendingAction({
      id: actionId,
      name: action.name,
      phase: 'sending',
      startedAt: Date.now()
    });

    const userAction = {
      id: actionId,
      name: action.name,
      surfaceId: action.surfaceId || 'main',
      sourceComponentId: id,
      timestamp: new Date().toISOString(),
      context: action.context || {}
    };

    const bridge = getBridgeAdapter();
    const result = await bridge.postMessage(userAction);

    if (result.ok) {
      setPendingAction({
        id: actionId,
        name: action.name,
        phase: 'sent',
        startedAt: Date.now()
      });
    } else {
      setPendingAction({
        id: actionId,
        name: action.name,
        phase: 'error',
        error: result.error,
        startedAt: Date.now()
      });
    }
  }, [disabled, isLoading, action, id, setPendingAction]);

  // 处理触摸（解决 300ms 延迟）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleClick();
  }, [handleClick]);

  return (
    <button
      id={id}
      className={`${styles.button} ${platform} ${isLoading ? styles.loading : ''}`}
      style={buttonStyle}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      disabled={disabled || isLoading}
    >
      {isLoading && <span className={styles.spinner} />}
      {text}
    </button>
  );
};
```

### 2.6 移动端适配

#### 2.6.1 视口适配

```html
<!-- public/index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

#### 2.6.2 安全区域适配（刘海屏）

```css
/* src/canvas-host/a2ui-react/styles/mobile.css */
:root {
  --openclaw-a2ui-inset-top: env(safe-area-inset-top, 0px);
  --openclaw-a2ui-inset-bottom: env(safe-area-inset-bottom, 0px);
  --openclaw-a2ui-inset-left: env(safe-area-inset-left, 0px);
  --openclaw-a2ui-inset-right: env(safe-area-inset-right, 0px);
}

.a2ui-root {
  padding-top: var(--openclaw-a2ui-inset-top);
  padding-bottom: var(--openclaw-a2ui-inset-bottom);
  padding-left: var(--openclaw-a2ui-inset-left);
  padding-right: var(--openclaw-a2ui-inset-right);
}
```

#### 2.6.3 触摸优化

```css
/* 禁用点击高亮 */
* {
  -webkit-tap-highlight-color: transparent;
}

/* 优化触摸响应 */
.a2ui-button,
.a2ui-card {
  touch-action: manipulation;
}

/* 禁用文本选择（UI 元素） */
.a2ui-button,
.a2ui-card {
  user-select: none;
  -webkit-user-select: none;
}
```

### 2.7 类型定义

#### 2.7.1 A2UI 类型（扩展现有规范）

```typescript
// src/canvas-host/a2ui-react/types/a2ui.ts
// 基础：扩展 vendor/a2ui/specification/0.8/ 中的类型

import type { A2uiComponent as BaseA2uiComponent } from '../../../vendor/a2ui/specification/0.8/types';

/** A2UI 组件类型（完整列表） */
export type A2uiComponentType =
  | 'AudioPlayer'
  | 'Button'
  | 'Card'
  | 'Column'
  | 'Container'
  | 'Divider'
  | 'Image'
  | 'Markdown'
  | 'Modal'
  | 'Progress'
  | 'Row'
  | 'Text'
  | 'TextField'
  | 'VideoPlayer';

/** A2UI 消息类型 */
export type A2uiMessage =
  | { type: 'beginRendering'; payload: A2uiRoot }
  | { type: 'surfaceUpdate'; surfaceId: string; payload: A2uiSurface }
  | { type: 'dataModelUpdate'; surfaceId: string; payload: DataModel }
  | { type: 'deleteSurface'; surfaceId: string }
  | { type: 'createSurface'; surfaceId: string; payload: A2uiSurface };

/** Surface 数据结构 */
export interface Surface {
  id: string;
  components: Map<string, A2uiComponent>;
  dataModel?: DataModel;
}

/** A2UI 组件 */
export interface A2uiComponent extends BaseA2uiComponent {
  id: string;
  type: A2uiComponentType;
  props: Record<string, any>;
  action?: ComponentAction;
}

/** 组件动作 */
export interface ComponentAction {
  name: string;
  surfaceId: string;
  context: ActionContext[];
}

/** 动作上下文 */
export interface ActionContext {
  key: string;
  value:
    | { literalString: string }
    | { literalNumber: number }
    | { literalBoolean: boolean }
    | { path: string };
}

/** 数据模型 */
export interface DataModel {
  [key: string]: any;
}

/** A2UI 根 */
export interface A2uiRoot {
  surfaces: A2uiSurface[];
}

/** A2UI Surface */
export interface A2uiSurface {
  id: string;
  components: A2uiComponent[];
  dataModel?: DataModel;
}
```

#### 2.7.2 桥接类型

```typescript
// src/canvas-host/a2ui-react/types/bridge.ts

/** 用户动作 */
export interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string; // ISO 8601
  context: Record<string, any>;
}

/** 动作状态 */
export interface ActionStatus {
  id: string;
  ok: boolean;
  error?: string;
}

/** 处理中的动作 */
export interface PendingAction {
  id: string;
  name: string;
  phase: 'sending' | 'sent' | 'error';
  startedAt: number;
  error?: string;
}
```

#### 2.7.3 主题类型

```typescript
// src/canvas-host/a2ui-react/types/theme.ts

/** A2UI 主题 */
export interface A2uiTheme {
  colors: ThemeColors;
  platform: PlatformStyles;
  components: ComponentStyles;
  cssVars: Record<string, string>;
}

/** 主题颜色 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
}

/** 平台样式 */
export interface PlatformStyles {
  android: PlatformStyle;
  ios: PlatformStyle;
}

export interface PlatformStyle {
  shadow: string;
  blur: string;
}

/** 组件样式 */
export interface ComponentStyles {
  Button: ButtonStyles;
  Card: CardStyles;
  // ... 其他组件
}

export interface ButtonStyles {
  padding: string;
  borderRadius: string;
  fontSize: string;
  fontWeight: string;
  backgroundColor?: string;
}

export interface CardStyles {
  padding: string;
  borderRadius: string;
  backgroundColor: string;
}
```

### 2.8 测试方案

#### 2.8.1 单元测试（Vitest）

```typescript
// src/canvas-host/a2ui-react/services/messageAdapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ReactMessageAdapter } from './messageAdapter';
import type { A2uiMessage } from '../types';

describe('ReactMessageAdapter', () => {
  let adapter: ReactMessageAdapter;

  beforeEach(() => {
    adapter = new ReactMessageAdapter();
  });

  it('应该正确处理 surface.create 消息', async () => {
    const message: A2uiMessage = {
      type: 'createSurface',
      surfaceId: 'main',
      payload: {
        id: 'main',
        components: [],
        dataModel: {}
      }
    };

    const result = await adapter.applyMessages([message]);

    expect(result.ok).toBe(true);
    expect(result.surfaces).toContain('main');
  });

  it('应该正确重置所有 Surface', () => {
    const result = adapter.reset();

    expect(result.ok).toBe(true);
    expect(adapter.getSurfaces()).toHaveLength(0);
  });
});
```

#### 2.8.2 组件测试（React Testing Library）

```typescript
// src/canvas-host/a2ui-react/components/elements/A2uiButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { A2uiButton } from './A2uiButton';
import { A2uiThemeProvider } from '../../context/A2uiThemeContext';
import { A2uiActionProvider } from '../../context/A2uiActionContext';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <A2uiThemeProvider>
      <A2uiActionProvider>
        {component}
      </A2uiActionProvider>
    </A2uiThemeProvider>
  );
};

describe('A2uiButton', () => {
  it('应该渲染按钮文本', () => {
    renderWithProviders(<A2uiButton id="btn1" text="点击我" action={{ name: 'test', surfaceId: 'main', context: [] }} />);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });

  it('点击时应该触发动作', async () => {
    const mockPostMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.mock('../../services/bridgeAdapter', () => ({
      getBridgeAdapter: () => ({ postMessage: mockPostMessage })
    }));

    renderWithProviders(<A2uiButton id="btn1" text="点击" action={{ name: 'test', surfaceId: 'main', context: [] }} />);

    const button = screen.getByText('点击');
    fireEvent.click(button);

    expect(mockPostMessage).toHaveBeenCalled();
  });
});
```

#### 2.8.3 真机测试检查清单

| 测试项 | iOS | Android | 纯 H5 |
|-------|-----|---------|-------|
| 桥接通信 | ✅ | ✅ | ✅ |
| 触摸响应 | ✅ | ✅ | ✅ |
| 样式一致性 | ✅ | ✅ | ✅ |
| 安全区域 | ✅ | N/A | N/A |
| 低版本兼容 | iOS 13+ | Android 8+ | Chrome 80+ |

### 2.9 构建与部署

#### 2.9.1 构建配置（Vite）

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@a2ui-react': path.resolve(__dirname, './src/canvas-host/a2ui-react'),
      '@a2ui-spec': path.resolve(__dirname, './vendor/a2ui/specification')
    }
  },
  build: {
    outDir: 'dist/a2ui-react',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'a2ui-core': ['./src/canvas-host/a2ui-react/services']
        }
      }
    }
  },
  server: {
    port: 18789,
    strictPort: true
  }
});
```

#### 2.9.2 与现有 Canvas Host 集成

```typescript
// src/canvas-host/a2ui.ts (修改现有文件)
import { serveA2uiReact } from './a2ui-react/server';

// 在现有 HTTP 服务器中添加 React 路由
app.get('/__openclaw__/a2ui/react', (req, res) => {
  serveA2uiReact(req, res);
});
```

### 2.10 实施路线图

#### Phase 1: 基础设施（1-2 周）
- [ ] 创建目录结构
- [ ] 配置 Vite 构建环境
- [ ] 定义类型（复用现有规范）
- [ ] 实现消息适配器（连接 a2ui-jsonl.ts）
- [ ] 实现桥接适配器（连接 canvas-host/a2ui.ts）

#### Phase 2: 核心功能（2-3 周）
- [ ] 实现 React Context
- [ ] 实现核心组件（Surface, Button, Text, Card）
- [ ] 实现主题系统
- [ ] 移动端适配（视口、安全区域、触摸）

#### Phase 3: 完善组件（2-3 周）
- [ ] 实现剩余 A2UI 组件
- [ ] 实现反馈组件（Toast, Spinner）
- [ ] 实现动作状态管理

#### Phase 4: 测试与优化（1-2 周）
- [ ] 单元测试覆盖
- [ ] 集成测试覆盖
- [ ] 性能优化
- [ ] 真机测试

#### Phase 5: 集成与部署（1 周）
- [ ] 与现有 Canvas Host 集成
- [ ] 文档编写
- [ ] 部署上线

### 2.11 风险与应对

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| 与现有 A2UI 规范不兼容 | 高 | 严格基于 vendor/a2ui/specification 实现，添加兼容性测试 |
| 性能问题（React 重渲染） | 中 | 使用 Context 拆分、useMemo/useCallback 优化 |
| 桥接通信不稳定 | 高 | 复用现有桥接逻辑，添加重试机制 |
| 移动端兼容性问题 | 中 | 覆盖主流机型测试，提供降级方案 |

---

## 第三部分：附录

### 附录 A：与现有设计文档的主要差异

| 方面 | 原设计文档 | 最终设计 |
|-----|----------|---------|
| 消息处理器 | 完全重新实现 | 复用现有 `a2ui-jsonl.ts` |
| 桥接层 | 新建桥接服务 | 复用现有 `canvas-host/a2ui.ts` |
| 目录结构 | 独立 `common/` 目录 | 整合到现有 `src/canvas-host/` |
| 组件列表 | 部分列举 | 完整列表（基于 specification） |
| 类型定义 | 自定义类型 | 扩展现有 `vendor/a2ui/specification` |
| 实施路线图 | 无 | 分 5 个阶段，共 7-11 周 |

### 附录 B：关键文件路径索引

| 功能 | 文件路径 |
|-----|---------|
| 现有 A2UI 消息处理 | `src/cli/nodes-cli/a2ui-jsonl.ts` |
| 现有桥接注入 | `src/canvas-host/a2ui.ts` |
| A2UI 规范 | `vendor/a2ui/specification/0.8/` |
| Canvas 服务器 | `src/canvas-host/server.ts` |
| Canvas 工具 | `src/agents/tools/canvas-tool.ts` |

### 附录 C：参考资料

1. **现有代码库**：
   - `src/canvas-host/a2ui.ts` - A2UI 桥接注入
   - `src/cli/nodes-cli/a2ui-jsonl.ts` - A2UI JSONL 处理
   - `vendor/a2ui/specification/0.8/` - A2UI 规范

2. **设计文档**：
   - `docs/design/OpenClaw H5移动端（React）开发：协议接口与功能详细设计.md`
   - `docs/design/OpenClaw H5移动端（React）开发：协议接口与功能详细设计（最终版）.md`

3. **外部参考**：
   - React 官方文档：https://react.dev/
   - CSS Modules：https://github.com/css-modules/css-modules
   - Vite 文档：https://vitejs.dev/

---

## 文档变更历史

| 日期 | 版本 | 变更说明 |
|------|------|---------|
| 2025-02-03 | v3.0 | 基于现有代码库评审，整合为最终版 |
| 2024-06-12 | v2.0 | 优化版（Context 拆分、性能优化） |
| 2024-06-10 | v1.0 | 初始版本 |

---

**文档状态**：✅ 最终版 - 待审核

**下一步行动**：
1. 技术评审会议
2. 确认实施路线图
3. 分配开发资源
4. 启动 Phase 1 开发
