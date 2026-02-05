# OpenClaw H5移动端（React）开发：协议接口与功能详细设计（最终版）

## 一、核心支持的协议/接口体系

（原有内容不变，仅优化后续功能设计中的适配逻辑）

## 二、React H5移动端功能详细设计

### 1. 整体架构（分层设计，优化性能隔离）

```Plain Text

┌─────────────────────────────────────────┐
│ 通用UI组件层（Common/Toast/Status等）   │
├─────────────────────────────────────────┤
│ UI组件层（React封装A2UI标准组件）        │
├─────────────────────────────────────────┤
│ 状态管理层（拆分Context：Theme/Message/PendingAction/Toast） │
├─────────────────────────────────────────┤
│ A2UI消息处理层（解析/渲染/更新，性能缓存）│
├─────────────────────────────────────────┤
│ 桥接适配层（原生/后端通信，容错+重试）   │
├─────────────────────────────────────────┤
│ 基础适配层（移动端H5/样式隔离）          │
└─────────────────────────────────────────┘
```

### 2. 目录结构（React + TypeScript，优化复用性）

```Plain Text

src/
├── assets/            # 静态资源（图片/字体）
├── common/            # 多端共用核心（新增，预留小程序扩展）
│   ├── types/         # 通用类型定义（原types中多端共用部分）
│   │   ├── base.d.ts  # 基础类型（设备/通用枚举）
│   │   └── index.d.ts
│   └── utils/         # 通用工具函数（原utils中多端共用部分）
│       ├── deviceDetect.ts  # 设备检测（iOS/Android/H5）
│       ├── uuid.ts          # actionId生成（兼容低版本系统）
│       ├── logger.ts        # 日志埋点（新增，防循环引用+多环境兼容）
│       ├── requestRetry.ts  # 重试工具函数（替代违规Hook调用）
│       └── index.ts
├── components/        
│   ├── A2UI/          # A2UI组件封装（解耦UI与A2UI逻辑）
│   │   ├── surfaces/  
│   │   ├── elements/  # A2UI基础组件（Button/Card等）
│   │   ├── feedback/  
│   │   └── A2uiHost.tsx    
│   ├── Bridge/        # 桥接层（增强容错+重试）
│   ├── Common/        # 公共组件（新增，提升复用性）
│   │   ├── Toast/     # 抽离通用Toast
│   │   │   ├── Toast.tsx
│   │   │   └── Toast.module.css  # CSS Modules（新增）
│   │   ├── Status/    # 抽离通用状态提示
│   │   ├── Viewport/  # 抽离通用视口适配
│   │   └── index.ts
│   └── Layout/        
├── context/           # React上下文（拆分优化，降低重渲染）
│   ├── A2uiMessageContext.tsx  
│   ├── ThemeContext.tsx        
│   ├── PendingActionContext.tsx  # 拆分原ActionContext（仅管理pendingAction）
│   └── ToastContext.tsx          # 拆分原ActionContext（仅管理toast）
├── hooks/             # 自定义Hooks
│   ├── useA2uiMessages.ts  
│   ├── useA2uiAction.ts    # 适配拆分后的Context
│   ├── useTheme.ts         
│   ├── useMobileAdapt.ts   
│   └── useRequestRetry.ts  # 废弃：改用common/utils/requestRetry.ts
├── services/          # 服务层（增强异常/超时处理）
│   ├── a2uiMessageProcessor.ts  
│   ├── actionGenerator.ts       
│   ├── bridgeService.ts        # 新增：桥接通信封装（容错+超时+重试+参数验证）
│   └── api/                     
├── styles/            # 全局样式（新增，CSS Modules/Styled Components）
│   ├── theme.module.css      # 全局CSS变量定义（补充完整）
│   └── reset.css
├── types/             # A2UI/桥接专属类型（拆分后）
│   ├── a2ui.d.ts      
│   ├── bridge.d.ts    
│   └── index.d.ts
├── utils/             # H5专属工具函数
│   ├── styleParser.ts   
│   ├── timeoutHandler.ts  # 新增：超时处理工具
│   └── index.ts
├── App.tsx            
└── main.tsx           
```

### 3. 核心模块设计（针对评审意见优化）

#### （1）Context性能优化（核心修改）

##### ① A2uiMessageContext：缓存+减少重渲染（修复Hooks嵌套违规）

```TypeScript

// context/A2uiMessageContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { A2uiMessageProcessor } from '../services/a2uiMessageProcessor';
import type { A2uiMessage, Surface } from '../types/a2ui';

interface A2uiMessageContextType {
  surfaces: [string, Surface][];
  applyMessages: (messages: A2uiMessage[]) => { ok: boolean; surfaces: string[] };
  reset: () => { ok: boolean };
  getSurfaces: () => string[];
}

const A2uiMessageContext = createContext<A2uiMessageContextType | undefined>(undefined);

export const A2uiMessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const processor = useMemo(() => new A2uiMessageProcessor(), []); // 缓存processor，避免重复创建
  const [surfaces, setSurfaces] = useState<[string, Surface][]>([]);

  const applyMessages = useCallback((messages: A2uiMessage[]) => {
    if (!Array.isArray(messages)) throw new Error('A2UI: 期望消息数组');
    processor.processMessages(messages);
    const newSurfaces = Array.from(processor.getSurfaces().entries());
    setSurfaces(newSurfaces);
    return { ok: true, surfaces: newSurfaces.map(([id]) => id) };
  }, [processor]);

  const reset = useCallback(() => {
    processor.clearSurfaces();
    setSurfaces([]);
    return { ok: true };
  }, [processor]);

  // 修复：拆分useMemo与useCallback，避免Hooks嵌套违规
  const surfacesKeys = useMemo(() => Array.from(processor.getSurfaces().keys()), [processor]);
  const getSurfaces = useCallback(() => surfacesKeys, [surfacesKeys]);

  // 缓存上下文值，仅当依赖变化时更新
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
  if (!context) throw new Error('useA2uiMessages必须在A2uiMessageProvider内使用');
  return context;
};
```

##### ② 拆分ActionContext为PendingActionContext + ToastContext（修复Toast自动消失逻辑）

```TypeScript

// context/PendingActionContext.tsx（仅管理pendingAction）
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { PendingAction } from '../types/a2ui';

interface PendingActionContextType {
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;
}

const PendingActionContext = createContext<PendingActionContextType | undefined>(undefined);

export const PendingActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  
  // 缓存setPendingAction，避免引用变化
  const memoizedSetPendingAction = useCallback(setPendingAction, []);
  
  const contextValue = useMemo(() => ({
    pendingAction,
    setPendingAction: memoizedSetPendingAction
  }), [pendingAction, memoizedSetPendingAction]);

  return (
    <PendingActionContext.Provider value={contextValue}>
      {children}
    </PendingActionContext.Provider>
  );
};

export const usePendingAction = () => {
  const context = useContext(PendingActionContext);
  if (!context) throw new Error('usePendingAction必须在PendingActionProvider内使用');
  return context;
};

// context/ToastContext.tsx（仅管理toast，组件级别状态无需全局共享）
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { Toast } from '../types/a2ui';

interface ToastContextType {
  toast: Toast | null;
  setToast: (toast: Toast | null) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<Toast | null>(null);

  // Toast自动消失（修复：确保时长非负，移除无依据的+30补偿）
  useEffect(() => {
    if (!toast) return;
    const remainTime = Math.max(0, toast.expiresAt - Date.now()); // 避免负数导致立即消失
    const timer = setTimeout(() => setToast(null), remainTime);
    return () => clearTimeout(timer);
  }, [toast]);

  const memoizedSetToast = useCallback(setToast, []);
  
  const contextValue = useMemo(() => ({
    toast,
    setToast: memoizedSetToast
  }), [toast, memoizedSetToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast必须在ToastProvider内使用');
  return context;
};
```

#### （2）桥接适配层优化（增强容错性+参数验证+修复Hook违规）

##### ① 通用重试工具函数（替代违规Hook）

```TypeScript

// common/utils/requestRetry.ts
/**
 * 通用请求重试工具函数（替代useRequestRetry Hook，支持任意异步函数）
 * @param fn 待重试的异步函数
 * @param options 重试配置
 * @returns Promise<T>
 */
export const requestRetry = async <T>(
  fn: () => Promise<T>,
  options: { times: number; delay: number; onRetry?: (count: number) => void }
): Promise<T> => {
  let retryCount = 0;
  while (retryCount <= options.times) {
    try {
      return await fn();
    } catch (e) {
      retryCount++;
      if (retryCount > options.times) throw e;
      options.onRetry?.(retryCount);
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
  }
  throw new Error('重试次数耗尽');
};
```

##### ② 桥接通信封装（超时+重试+异常捕获+参数验证）

```TypeScript

// services/bridgeService.ts（新增）
import { logger } from '../common/utils/logger';
import { deviceDetect } from '../common/utils/deviceDetect';
import { requestRetry } from '../common/utils/requestRetry';
import type { UserAction } from '../types/bridge';

// 配置项
const BRIDGE_TIMEOUT = 10000; // 10s超时
const RETRY_TIMES = 2; // 最多重试2次
const RETRY_DELAY = 500; // 重试间隔500ms

/**
 * 用户动作参数验证（前置拦截无效参数）
 * @param action 待验证的用户动作
 * @returns boolean 验证结果
 */
const validateUserAction = (action: UserAction): boolean => {
  const required = ['id', 'name', 'surfaceId'];
  const missing = required.filter(key => !action[key]);
  if (missing.length) {
    logger.error('用户动作参数缺失', { missing, action });
    return false;
  }
  return true;
};

/**
 * 桥接通信核心方法（容错+超时+重试）
 * @param userAction 交互动作对象
 * @returns Promise<boolean>
 */
export const postBridgeMessage = async (userAction: UserAction): Promise<boolean> => {
  // 前置参数验证
  if (!validateUserAction(userAction)) throw new Error('用户动作参数不完整');
  
  const { isAndroid, isIOS, isPureH5 } = deviceDetect();
  const actionId = userAction.id;

  try {
    // 超时处理
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error(`桥接调用超时(${BRIDGE_TIMEOUT}ms)`)), BRIDGE_TIMEOUT);
    });

    // 核心通信逻辑（复用通用重试工具）
    const postPromise = requestRetry(async () => {
      let bridge: any;
      if (isPureH5) {
        // 纯H5场景：对接后端接口
        const res = await fetch('/api/a2ui/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAction })
        });
        return res.ok;
      }

      // 原生桥接场景
      bridge = isIOS ? window.webkit?.messageHandlers?.openclawCanvasA2UIAction : window.openclawCanvasA2UIAction;
      if (!bridge?.postMessage) throw new Error("原生桥接未找到");

      // 适配iOS/Android参数格式
      const postData = isAndroid ? JSON.stringify({ userAction }) : { userAction };
      bridge.postMessage(postData);
      logger.info('桥接消息发送成功', { actionId, platform: isIOS ? 'iOS' : 'Android' });
      return true;
    }, {
      times: RETRY_TIMES,
      delay: RETRY_DELAY,
      onRetry: (count) => {
        logger.warn(`桥接调用重试(${count}/${RETRY_TIMES})`, { actionId });
      }
    });

    // 超时与通信竞争
    return await Promise.race([timeoutPromise, postPromise]);
  } catch (e) {
    const errorMsg = (e as Error).message || "桥接调用失败";
    logger.error('桥接通信异常', { actionId, error: errorMsg });
    throw new Error(errorMsg);
  }
};
```

#### （3）A2UI组件优化（解耦+复用性+低版本兼容）

##### ① 兼容型UUID生成工具

```TypeScript

// common/utils/uuid.ts
/**
 * 生成唯一actionId（兼容低版本系统，替代crypto.randomUUID）
 * @returns string 唯一ID
 */
export const getActionId = (): string => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // 降级方案：时间戳 + 随机数 + 防重复
  return `a2ui_${Date.now()}_${Math.random().toString(16).slice(2)}_${Math.floor(Math.random() * 10000)}`;
};
```

##### ② A2uiButton组件（兼容UUID+补充禁用样式）

```TypeScript

// components/A2UI/elements/A2uiButton.tsx
import React, { useContext, useCallback } from 'react';
import { ThemeContext } from '../../../context/ThemeContext';
import { usePendingAction } from '../../../context/PendingActionContext';
import { useToast } from '../../../context/ToastContext';
import { deviceDetect } from '../../../common/utils/deviceDetect';
import { getActionId } from '../../../common/utils/uuid'; // 引入兼容型UUID工具
import { postBridgeMessage } from '../../../services/bridgeService';
import { logger } from '../../../common/utils/logger';
import type { ButtonProps } from '../../../types/a2ui';
import styles from './A2uiButton.module.css'; // CSS Modules（新增）

// 扩展Props：支持自定义onClick，解耦A2UI逻辑
export interface A2uiButtonProps extends ButtonProps {
  onClick?: () => void; // 自定义点击事件（非A2UI场景）
  isLoading?: boolean; // 组件级别加载状态（无需全局Context）
}

export const A2uiButton: React.FC<A2uiButtonProps> = ({ 
  text, 
  action, 
  sourceComponentId,
  onClick, // 自定义点击事件
  isLoading = false // 组件自身状态，替代全局Context
}) => {
  const { theme } = useContext(ThemeContext);
  const { setPendingAction } = usePendingAction();
  const { setToast } = useToast();
  const { isAndroid } = deviceDetect();

  // 样式：改用CSS Modules，避免污染
  const buttonClass = `${styles.btn} ${isAndroid ? styles.androidBtn : styles.iosBtn} ${isLoading ? styles.loading : ''}`;

  // A2UI动作触发逻辑（可独立拆分）
  const handleA2uiAction = useCallback(async () => {
    if (!action) return;
    const actionId = getActionId(); // 使用兼容型UUID生成器
    
    setPendingAction({ id: actionId, name: action.name, phase: "sending", startedAt: Date.now() });
    logger.info('A2UI按钮点击', { actionId, componentId: sourceComponentId });

    // 生成userAction
    const userAction = {
      id: actionId,
      name: action.name,
      surfaceId: "main",
      sourceComponentId,
      timestamp: new Date().toISOString(),
      context: {},
    };

    try {
      await postBridgeMessage(userAction);
      setPendingAction({ id: actionId, name: action.name, phase: "sent", startedAt: Date.now() });
      setToast({ text: `成功: ${action.name}`, kind: "ok", expiresAt: Date.now() + 1100 });
    } catch (e) {
      const errorMsg = (e as Error).message || "调用失败";
      setPendingAction({ id: actionId, name: action.name, phase: "error", error: errorMsg, startedAt: Date.now() });
      setToast({ text: `失败: ${errorMsg}`, kind: "error", expiresAt: Date.now() + 4500 });
    }
  }, [action, sourceComponentId, setPendingAction, setToast]);

  // 统一点击处理：优先自定义onClick，其次A2UI动作
  const handleClick = useCallback(async () => {
    if (isLoading) return;
    if (onClick) {
      onClick(); // 非A2UI场景直接调用自定义事件
      return;
    }
    await handleA2uiAction();
  }, [isLoading, onClick, handleA2uiAction]);

  // 移动端触摸适配
  const handleTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleClick();
  }, [handleClick]);

  return (
    <button
      className={buttonClass}
      onClick={handleClick}
      onTouchStart={handleTouch}
      disabled={isLoading}
    >
      {isLoading && <span className={styles.spinner} />}
      {text}
    </button>
  );
};
```

#### （4）样式管理优化（CSS Modules+完整变量定义）

##### ① 全局主题变量

```CSS

/* styles/theme.module.css */
:root {
  /* 按钮基础变量 */
  --openclaw-btn-radius: 8px;
  /* 主题色变量 */
  --openclaw-primary-android: #06b6d4;
  --openclaw-primary-ios: #0891b2;
  --openclaw-text-color: #333;
  /* 禁用态变量 */
  --openclaw-btn-disabled-opacity: 0.6;
}
```

##### ② A2uiButton样式（补充禁用状态）

```CSS

/* components/A2UI/elements/A2uiButton.module.css */
.btn {
  border: none;
  border-radius: var(--openclaw-btn-radius);
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 禁用状态样式（新增） */
.btn:disabled {
  opacity: var(--openclaw-btn-disabled-opacity);
  cursor: not-allowed;
  pointer-events: none;
}

.androidBtn {
  box-shadow: 0 2px 10px rgba(6, 182, 212, 0.14);
  background-color: var(--openclaw-primary-android);
}

.iosBtn {
  box-shadow: 0 10px 25px rgba(6, 182, 212, 0.18);
  background-color: var(--openclaw-primary-ios);
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

#### （5）日志埋点机制（优化：防循环引用+多环境兼容）

```TypeScript

// common/utils/logger.ts
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  [key: string]: any;
  timestamp: string;
  actionId?: string;
  platform?: string;
}

/**
 * 安全序列化（防循环引用）
 * @param data 待序列化数据
 * @returns string 序列化结果
 */
const safeStringify = (data: any) => {
  const cache = new WeakSet();
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) return '[Circular]';
      cache.add(value);
    }
    return value;
  });
};

/**
 * 多环境判断（兼容Vite/Webpack等构建工具）
 * @returns boolean 是否为生产环境
 */
const isProduction = () => {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';
};

/**
 * 日志埋点核心方法
 * - 开发环境：控制台输出
 * - 生产环境：上报后端/原生
 */
export const logger = {
  log: (level: LogLevel, message: string, data: LogData = {}) => {
    const logInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      ...data
    };

    // 开发环境控制台输出
    if (!isProduction()) {
      switch (level) {
        case 'info': console.log('[OpenClaw INFO]', logInfo); break;
        case 'warn': console.warn('[OpenClaw WARN]', logInfo); break;
        case 'error': console.error('[OpenClaw ERROR]', logInfo); break;
        case 'debug': console.debug('[OpenClaw DEBUG]', logInfo); break;
      }
    }

    // 生产环境：上报日志（适配原生/后端）
    if (isProduction()) {
      try {
        const bridge = window.webkit?.messageHandlers?.openclawLogger || window.openclawLogger;
        if (bridge?.postMessage) {
          bridge.postMessage(safeStringify(logInfo)); // 安全序列化
        } else {
          // 纯H5场景：上报后端日志接口
          fetch('/api/a2ui/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: safeStringify(logInfo) // 安全序列化
          }).catch(() => {}); // 日志上报失败不影响主流程
        }
      } catch (e) {
        console.error('日志上报失败', e);
      }
    }
  },
  info: (msg: string, data?: LogData) => logger.log('info', msg, data),
  warn: (msg: string, data?: LogData) => logger.log('warn', msg, data),
  error: (msg: string, data?: LogData) => logger.log('error', msg, data),
  debug: (msg: string, data?: LogData) => logger.log('debug', msg, data),
};
```

### 4. 测试方案（细化覆盖范围+补充缺失场景）

#### （1）单元测试（Jest）

|测试模块|测试重点|核心测试用例|
|---|---|---|
|A2uiMessageProcessor|消息解析、Surface管理|1. 解析surface.create/update/delete消息，验证Surface映射正确性；<br>2. 解析component.create消息，验证组件添加逻辑；<br>3. 异常消息（非数组、缺少必填字段）的错误处理；<br>4. reset/clearSurfaces方法的状态重置逻辑；<br>5. getSurfaces方法缓存有效性（多次调用返回相同引用）。|
|bridgeService|桥接通信、容错重试|1. iOS/Android参数格式适配正确性；<br>2. 桥接未找到时的异常捕获；<br>3. 10s超时场景的错误触发；<br>4. 重试机制（失败后重试2次，验证重试次数/间隔）；<br>5. 纯H5场景的后端接口调用逻辑；<br>6. 参数验证逻辑（缺失id/name/surfaceId时拦截）；<br>7. 不可恢复错误（如原生桥接未初始化）终止重试验证。|
|actionGenerator|UserAction生成|1. 生成的actionId格式正确性（UUID/时间戳+随机数）；<br>2. context参数解析（静态literalString/动态path）；<br>3. 时间戳格式（ISO 8601）验证；<br>4. 低版本系统下actionId降级生成逻辑。|
|通用工具（logger/uuid/requestRetry）|工具函数稳定性|1. logger不同级别日志的输出/上报逻辑（含循环引用数据序列化）；<br>2. uuid生成的唯一性（批量生成1000个，验证无重复）；<br>3. deviceDetect的平台识别正确性（模拟iOS/Android/H5环境）；<br>4. requestRetry重试次数/间隔/终止条件验证；<br>5. logger多环境判断（production/prod均识别为生产环境）。|
|自定义Hook（useA2uiMessages/usePendingAction/useToast）|Hook逻辑正确性|1. useA2uiMessages必须在Provider内使用的异常抛出；<br>2. useToast自动消失逻辑（非负时长、超时清除）；<br>3. usePendingAction状态缓存（多次调用setPendingAction引用不变）。|
|A2uiButton|组件核心逻辑|1. loading状态禁用点击；<br>2. 自定义onClick优先于A2UI逻辑；<br>3. 触摸事件防300ms延迟；<br>4. 禁用状态样式渲染；<br>5. 低版本系统actionId降级生成。|
#### （2）集成测试（React Testing Library）

|测试链路|测试场景|
|---|---|
|消息下发→UI渲染|1. 调用applyMessages下发创建Button的消息，验证DOM中是否渲染对应按钮；<br>2. 下发update消息修改按钮文本，验证文本更新；<br>3. 下发delete消息，验证按钮被移除；<br>4. 空消息/非法消息的渲染容错；<br>5. 频繁更新surfaces验证非关联组件不重渲染。|
|交互动作→状态反馈|1. 点击A2uiButton，验证pendingAction状态变为sending；<br>2. 模拟桥接成功，验证pendingAction变为sent，Toast显示成功提示；<br>3. 模拟桥接超时，验证pendingAction变为error，Toast显示错误提示；<br>4. 模拟openclaw:a2ui-action-status事件，验证状态更新逻辑；<br>5. 多次点击按钮验证防重复提交；<br>6. 参数缺失时验证前置拦截与错误提示。|
|Context联动|上下文状态传递、重渲染控制|
#### （3）真机测试

|测试维度|测试覆盖范围|核心验证点|
|---|---|---|
|机型/系统|iOS：iPhone 11/13/15（iOS 13/14/16/18）；<br>Android：小米11/华为Mate60/OPPO Reno8（Android 8/9/10/13）|1. 不同系统版本的桥接通信稳定性；<br>2. 样式适配（阴影、圆角、字体）的一致性；<br>3. 触摸事件（onTouchStart）的响应速度（无300ms延迟）；<br>4. iOS 13以下/Android 9以下系统UUID降级生成逻辑；<br>5. 禁用状态按钮视觉反馈。|
|浏览器|iOS：Safari；<br>Android：Chrome/系统自带浏览器；<br>纯H5：微信浏览器/QQ浏览器|1. 不同浏览器的桥接接口兼容性；<br>2. CSS Modules样式的渲染一致性；<br>3. 视口适配（viewport）的显示效果（无缩放/滚动）；<br>4. 日志上报接口在不同浏览器的兼容性。|
|异常场景|网络波动、原生桥接未初始化、参数缺失|1. 网络断开时，纯H5场景的桥接调用失败提示；<br>2. 原生桥接未初始化时，点击按钮的错误反馈；<br>3. 频繁点击按钮（防抖/重复提交）的处理；<br>4. 参数缺失时的前置拦截与日志上报；<br>5. 模拟循环引用日志数据验证序列化不报错。|
### 5. 其他优化点

#### （1）目录结构扩展

新增`src/common`目录，抽离多端共用的工具函数（deviceDetect、uuid、requestRetry、logger）、类型定义（base.d.ts），为后续扩展到小程序/桌面端预留统一入口；废弃hooks/useRequestRetry.ts，改用common/utils/requestRetry.ts保证Hooks使用合规。

#### （2）主题样式扩展

支持CSS变量+CSS Modules/Styled Components结合：

- 全局主题变量定义在`styles/theme.module.css`，补充完整变量列表；

- 组件样式通过CSS Modules隔离，避免全局污染；

- 深色模式切换时，仅更新CSS变量值，无需重渲染组件；

- 补充按钮禁用状态样式，保证用户视觉反馈。

#### （3）异常监控

结合logger日志埋点，新增关键节点的异常监控：

- 消息解析失败：记录异常消息内容、Surface ID；

- 桥接调用失败：记录设备型号、系统版本、失败原因；

- 组件渲染异常：记录组件ID、props内容、错误栈；

- 日志上报失败：记录序列化错误、桥接/接口不可用状态；

- 参数验证失败：记录缺失字段、用户动作完整内容。

## 三、总结

本次优化聚焦**合规性、性能、容错、复用性、可测试性**五大核心，主要改进点：

1. 合规性修复：解决React Hooks嵌套调用、普通函数调用Hook等违规问题，保证代码符合React规范；优化UUID生成、日志序列化等逻辑，兼容低版本系统/多构建工具。

2. Context层面：拆分高频更新状态（pendingAction/toast），修复Toast自动消失逻辑，使用useMemo缓存上下文值，大幅降低不必要的重渲染。

3. 桥接层面：增加参数前置验证、10s超时、2次重试机制，重构重试逻辑为通用工具函数，扩展异常捕获范围，提升通信稳定性。

4. 组件层面：抽离公共组件目录，A2UI组件解耦UI与业务逻辑，支持非A2UI场景复用；补充禁用状态样式，优化用户体验。

5. 工程化层面：使用CSS Modules隔离样式，完善日志埋点（防循环引用+多环境兼容），补充全局CSS变量定义，优化目录结构为多端扩展预留空间。

6. 测试层面：补充单元测试覆盖自定义Hook/工具函数，新增集成测试验证重复提交/重渲染场景，扩展真机测试覆盖低版本系统/异常场景。

优化后既保留OpenClaw原有A2UI消息驱动的核心逻辑，又解决了代码合规性、兼容性问题，提升了React H5端的可维护性、性能和用户体验，同时兼容iOS/Android/纯H5多场景的适配需求。
> （注：文档部分内容可能由 AI 生成）