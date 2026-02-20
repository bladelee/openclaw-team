/**
 * Canvas/A2UI 页面
 * 用于显示 A2UI 渲染的组件
 */

import React, { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import './CanvasPage.css';

// A2UI React types (从 a2ui-react 导入)
interface A2UIMessage {
  surfaceUpdate?: {
    surfaceId: string;
    components: unknown[];
  };
  beginRendering?: {
    surfaceId: string;
    root: string;
  };
  dataModelUpdate?: {
    surfaceId: string;
    contents: Array<{ key: string; valueString?: string; valueNumber?: number; valueBoolean?: boolean }>;
  };
  deleteSurface?: {
    surfaceId: string;
  };
}

export const CanvasPage: React.FC = () => {
  const { gateway, setCurrentPage } = useApp();
  const a2uiContainerRef = useRef<HTMLDivElement>(null);
  const messagesQueueRef = useRef<A2UIMessage[]>([]);

  useEffect(() => {
    if (!gateway) {
      return;
    }

    // 监听 Gateway 消息
    const handleMessage = (message: { type?: string; event?: string; payload?: unknown }) => {
      // 检查是否是 a2ui 事件
      if (message.type === 'event' && message.event === 'a2ui') {
        console.log('[CanvasPage] 收到 A2UI 消息:', message.payload);

        const payload = message.payload as { messages?: A2UIMessage[] } | undefined;
        if (payload?.messages) {
          // 添加到消息队列
          messagesQueueRef.current.push(...payload.messages);

          // 将消息应用到 A2UI React
          applyA2UIMessages(payload.messages);
        }
      }
    };

    gateway.on('message', handleMessage);

    return () => {
      // 清理（GatewayService 的 on 方法不支持移除监听器）
      // 在实际实现中可能需要改进
    };
  }, [gateway]);

  // 应用 A2UI 消息到 a2ui-react
  const applyA2UIMessages = (messages: A2UIMessage[]) => {
    // 检查 a2ui-react API 是否可用
    const api = (window as unknown as { openclawA2UI?: { applyMessages: (msgs: unknown[]) => void } }).openclawA2UI;

    if (!api) {
      console.warn('[CanvasPage] A2UI API 不可用，请确保 a2ui-react 已加载');
      return;
    }

    try {
      api.applyMessages(messages);
      console.log('[CanvasPage] 已应用', messages.length, '条 A2UI 消息');
    } catch (error) {
      console.error('[CanvasPage] 应用 A2UI 消息失败:', error);
    }
  };

  // 返回聊天页面
  const handleBackToChat = () => {
    setCurrentPage('chat');
  };

  return (
    <div className="canvas-page">
      {/* 头部 */}
      <header className="canvas-header">
        <button
          className="back-button"
          onClick={handleBackToChat}
          aria-label="返回聊天"
        >
          ← 返回聊天
        </button>
        <h1>🖼️ Canvas</h1>
        <div className={`connection-status ${gateway?.isConnected ? 'connected' : 'disconnected'}`}>
          {gateway?.isConnected ? '● 已连接' : '○ 未连接'}
        </div>
      </header>

      {/* A2UI 渲染容器 */}
      <div className="a2ui-container" ref={a2uiContainerRef}>
        {/* 加载 a2ui-react 的 iframe */}
        <iframe
          src="/__openclaw__/a2ui/react"
          className="a2ui-iframe"
          title="A2UI Renderer"
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      </div>

      {/* 提示信息 */}
      {messagesQueueRef.current.length === 0 && (
        <div className="empty-state">
          <p className="emoji">🎨</p>
          <p className="title">等待 A2UI 内容</p>
          <p className="hint">
            当 AI 需要显示界面时，A2UI 内容会自动显示在这里。
          </p>
          <p className="hint">你也可以对 AI 说："显示一个按钮和进度条"</p>
        </div>
      )}
    </div>
  );
};
