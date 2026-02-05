/**
 * Chat 聊天服务
 * 负责消息收发和历史管理
 */

import { GatewayService, GatewayMessage } from '../gateway';
import { ChatMessage, MessageListener } from './ChatTypes';

export class ChatService {
  private sessionId: string;
  private messages: ChatMessage[] = [];
  private listeners: Set<MessageListener> = new Set();
  private pendingResponse: { text: string; runId: string } | null = null;

  constructor(
    private gateway: GatewayService,
    sessionId: string = 'main'
  ) {
    this.sessionId = sessionId;

    // 监听 Gateway 消息
    this.gateway.on('message', (message: GatewayMessage) => {
      // 处理 res 响应（chat.history 等）
      if (message.type === 'res') {
        this.handleResponse(message);
        return;
      }

      // 处理 chat 事件（delta + final）
      if (message.type === 'event' && (message as { event?: string }).event === 'chat') {
        this.handleChatEvent(message);
        return;
      }

      // 处理 agent 事件（lifecycle，用于调试）
      if (message.type === 'event' && (message as { event?: string }).event === 'agent') {
        this.handleAgentEvent(message);
        return;
      }

      // 处理旧格式 chat 消息（兼容）
      if (message.type === 'chat') {
        this.handleChatMessage(message);
      }
    });
  }

  /**
   * 发送文本消息
   */
  async sendText(text: string): Promise<void> {
    if (!text.trim()) {
      throw new Error('消息内容不能为空');
    }

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

    // 发送到 Gateway（使用正确的协议格式）
    const reqId = `chat-${Date.now()}`;
    const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.gateway.send({
      type: 'req',
      id: reqId,
      method: 'chat.send',
      params: {
        sessionKey: this.sessionId,
        message: text,
        idempotencyKey: idempotencyKey
      }
    } as unknown as GatewayMessage);

    // 延迟更新状态为已发送（模拟网络延迟）
    setTimeout(() => {
      this.updateMessageStatus(message.id, 'sent');
    }, 100);
  }

  /**
   * 获取消息列表
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 切换会话
   */
  switchSession(sessionId: string): void {
    if (this.sessionId === sessionId) {
      return;
    }

    this.sessionId = sessionId;
    this.messages = [];
    this.notifyListeners();
  }

  /**
   * 清空消息
   */
  clearMessages(): void {
    this.messages = [];
    this.notifyListeners();
  }

  /**
   * 删除单条消息
   */
  deleteMessage(messageId: string): void {
    this.messages = this.messages.filter(m => m.id !== messageId);
    this.notifyListeners();
  }

  /**
   * 订阅消息更新
   */
  subscribe(callback: MessageListener): () => void {
    this.listeners.add(callback);
    // 立即触发一次回调，返回当前消息列表
    callback([...this.messages]);
    return () => this.listeners.delete(callback);
  }

  /**
   * 处理 agent 事件（lifecycle，用于调试）
   */
  private handleAgentEvent(gatewayMessage: GatewayMessage): void {
    const payload = gatewayMessage.payload as {
      runId?: string;
      stream?: string;
      data?: { text?: string; phase?: string };
    };

    // 只处理 lifecycle 事件（用于调试）
    if (payload.stream === 'lifecycle') {
      console.log('[ChatService] lifecycle event:', payload.data?.phase, 'runId:', payload.runId);
    }
  }

  /**
   * 处理 chat 事件（delta + final）
   *
   * 协议（与 Web 端保持一致）：
   * 1. delta 事件：流式文本，直接替换 stream（不累积）
   * 2. final 事件：清除 stream，总是调用 history
   */
  private handleChatEvent(gatewayMessage: GatewayMessage): void {
    const payload = gatewayMessage.payload as {
      state?: string;
      runId?: string;
      sessionKey?: string;
      message?: {
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
        timestamp?: number;
        stopReason?: string;
      };
    };

    console.log('[ChatService] handleChatEvent:', {
      state: payload.state,
      runId: payload.runId,
      sessionKey: payload.sessionKey,
      currentSessionId: this.sessionId
    });

    // 检查是否属于当前会话
    if (payload.sessionKey && payload.sessionKey !== this.sessionId) {
      console.log('[ChatService] 跳过其他会话的事件');
      return;
    }

    // 处理 delta 事件（流式文本）
    if (payload.state === 'delta') {
      const deltaText = payload.message?.content?.[0]?.text || '';

      // 直接替换（不累积！）
      if (deltaText) {
        this.pendingResponse = { text: deltaText, runId: payload.runId || '' };
        console.log('[ChatService] 更新 stream, 长度:', deltaText.length);
        this.updatePendingMessage();
      }
      return;
    }

    // 处理 final 事件（完成）
    if (payload.state === 'final') {
      console.log('[ChatService] 收到 final 状态，清除 stream，请求 history');

      // 清除 stream 状态
      this.removePendingMessage();
      this.pendingResponse = null;

      // 总是调用 history（与 Web 端保持一致）
      this.fetchHistory();
      return;
    }

    // 处理 error 事件
    if (payload.state === 'error') {
      console.log('[ChatService] 收到 error 状态');

      const message: ChatMessage = {
        id: this.generateId(),
        sessionId: this.sessionId,
        role: 'assistant',
        content: '(发生错误)',
        timestamp: Date.now(),
        status: 'error',
        error: 'AI 处理出错'
      };

      this.addMessage(message);
      this.pendingResponse = null;
    }
  }

  /**
   * 处理来自 Gateway 的聊天消息（兼容旧格式）
   */
  private handleChatMessage(gatewayMessage: GatewayMessage): void {
    // 处理旧格式的 chat 消息
    if (gatewayMessage.type === 'chat') {
      const payload = gatewayMessage.payload as {
        sessionId?: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: number;
      };

      // 检查是否属于当前会话
      if (payload.sessionId && payload.sessionId !== this.sessionId) {
        return;
      }

      const message: ChatMessage = {
        id: this.generateId(),
        sessionId: payload.sessionId || this.sessionId,
        role: payload.role,
        content: payload.content,
        timestamp: payload.timestamp,
        status: 'sent'
      };

      this.addMessage(message);
    }
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
  private updateMessageStatus(
    id: string,
    status: 'sending' | 'sent' | 'error',
    error?: string
  ): void {
    const message = this.messages.find(m => m.id === id);
    if (message) {
      message.status = status;
      if (error) {
        message.error = error;
      }
      this.notifyListeners();
    }
  }

  /**
   * 更新待显示的 pending 消息（用于流式显示）
   */
  private updatePendingMessage(): void {
    if (!this.pendingResponse || !this.pendingResponse.text) {
      return;
    }

    // 查找或创建 pending 消息
    let pendingMsg = this.messages.find(m => m.status === 'pending');

    if (!pendingMsg) {
      pendingMsg = {
        id: this.generateId(),
        sessionId: this.sessionId,
        role: 'assistant',
        content: this.pendingResponse.text,
        timestamp: Date.now(),
        status: 'pending'
      };
      this.messages.push(pendingMsg);
    } else {
      pendingMsg.content = this.pendingResponse.text;
    }

    this.notifyListeners();
  }

  /**
   * 通知所有订阅者
   */
  private notifyListeners(): void {
    const messagesCopy = [...this.messages];
    this.listeners.forEach(callback => callback(messagesCopy));
  }

  /**
   * 处理 Gateway 响应（chat.history 等）
   */
  private handleResponse(message: GatewayMessage): void {
    const response = message as {
      id?: string;
      ok?: boolean;
      payload?: unknown;
    };

    console.log('[ChatService] handleResponse:', {
      id: response.id,
      ok: response.ok
    });

    // 只处理成功的响应
    if (!response.ok || !response.payload) {
      return;
    }

    const payload = response.payload as {
      sessionKey?: string;
      sessionId?: string;
      messages?: Array<{
        role: string;
        content: Array<{ type: string; text: string }>;
        timestamp: number;
      }>;
    };

    // 处理 chat.history 响应
    if (payload.messages) {
      console.log('[ChatService] 收到 chat.history 响应, 消息数:', payload.messages.length);
      this.handleHistoryResponse(payload.messages);
    }
  }

  /**
   * 处理 chat.history 响应
   *
   * 与 Web 端保持一致：完全替换消息列表
   */
  private handleHistoryResponse(
    historyMessages: Array<{
      role: string;
      content: Array<{ type: string; text: string }>;
      timestamp: number;
      stopReason?: string;
      usage?: { input: number; output: number; totalTokens: number };
    }>
  ): void {
    console.log('[ChatService] 收到 chat.history 响应, 消息数:', historyMessages.length);

    // 将 history 消息转换为 ChatMessage 格式
    const convertedMessages: ChatMessage[] = historyMessages.map(msg => {
      const content = msg.content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text || '')
        .join('\n\n')
        .trim();

      return {
        id: this.generateId(),
        sessionId: this.sessionId,
        role: msg.role as 'user' | 'assistant' | 'system',
        content,
        timestamp: msg.timestamp || Date.now(),
        status: 'sent'
      };
    });

    // 完全替换消息列表（与 Web 端保持一致）
    console.log('[ChatService] 替换消息列表, 新数量:', convertedMessages.length);
    this.messages = convertedMessages;
    this.notifyListeners();
  }

  /**
   * 请求聊天历史
   */
  private fetchHistory(): void {
    const reqId = `history-${Date.now()}`;

    console.log('[ChatService] 请求 chat.history');

    this.gateway.send({
      type: 'req',
      id: reqId,
      method: 'chat.history',
      params: {
        sessionKey: this.sessionId,
        limit: 200  // 与 Web 端保持一致
      }
    } as unknown as GatewayMessage);
  }

  /**
   * 移除 pending 状态的消息
   */
  private removePendingMessage(): void {
    const pendingIndex = this.messages.findIndex(m => m.status === 'pending');
    if (pendingIndex !== -1) {
      console.log('[ChatService] 移除 pending 消息');
      this.messages.splice(pendingIndex, 1);
      this.notifyListeners();
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
