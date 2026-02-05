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
  private pendingHistoryRequests: Set<string> = new Set(); // 记录等待 history 的 runId

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
   * 协议：
   * 1. delta 事件：流式文本片段，累积到 buffer
   * 2. final 事件：完成标记，message 可能为 undefined
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
      currentSessionId: this.sessionId,
      hasMessage: !!payload.message,
      messageContentLength: payload.message?.content?.[0]?.text?.length || 0
    });

    // 检查是否属于当前会话
    if (payload.sessionKey && payload.sessionKey !== this.sessionId) {
      console.log('[ChatService] 跳过其他会话的事件');
      return;
    }

    // 处理 delta 事件（流式文本）
    if (payload.state === 'delta') {
      const deltaText = payload.message?.content?.[0]?.text || '';
      if (deltaText) {
        // 累积到 buffer
        if (!this.pendingResponse || this.pendingResponse.runId !== payload.runId) {
          this.pendingResponse = { text: deltaText, runId: payload.runId || '' };
          console.log('[ChatService] 初始化 buffer, 长度:', deltaText.length);
        } else {
          this.pendingResponse.text += deltaText;
          console.log('[ChatService] 追加 delta, 当前长度:', this.pendingResponse.text.length);
        }

        // 实时更新 UI（显示累积的文本）
        this.updatePendingMessage();
      }
      return;
    }

    // 处理 final 事件（完成）
    if (payload.state === 'final') {
      console.log('[ChatService] 收到 final 状态');

      let content = '';

      // 优先级 1：使用 payload.message 中的内容
      if (payload.message?.content) {
        const textParts = payload.message.content
          .filter(c => c.type === 'text' && c.text)
          .map(c => c.text || '');

        content = textParts.join('\n\n').trim();
        console.log('[ChatService] 从 message 提取文本, 长度:', content.length);
      }

      // 优先级 2：使用累积的 buffer（从 delta 收集）
      if (!content && this.pendingResponse?.text) {
        content = this.pendingResponse.text.trim();
        console.log('[ChatService] 使用 buffer 文本, 长度:', content.length);
      }

      // 优先级 3：通过 chat.history 获取完整内容
      if (!content) {
        console.log('[ChatService] message 和 buffer 都为空，请求 chat.history');
        // 记录这个 runId，等待 history 响应
        if (payload.runId) {
          this.pendingHistoryRequests.add(payload.runId);
        }
        // 移除 pending 消息（如果存在）
        this.removePendingMessage();
        // 发送 history 请求
        this.fetchHistory();
        this.pendingResponse = null;
        return;
      }

      const message: ChatMessage = {
        id: this.generateId(),
        sessionId: this.sessionId,
        role: 'assistant',
        content,
        timestamp: payload.message?.timestamp || Date.now(),
        status: 'sent'
      };

      console.log('[ChatService] 添加 AI 回复消息:', {
        id: message.id,
        contentLength: content.length,
        preview: content.substring(0, 50)
      });

      this.addMessage(message);
      this.pendingResponse = null;
      return;
    }

    // 处理 error 事件
    if (payload.state === 'error') {
      console.log('[ChatService] 收到 error 状态');

      const message: ChatMessage = {
        id: this.generateId(),
        sessionId: this.sessionId,
        role: 'assistant',
        content: payload.message?.content?.[0]?.text || '(发生错误)',
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
   */
  private handleHistoryResponse(
    historyMessages: Array<{
      role: string;
      content: Array<{ type: string; text: string }>;
      timestamp: number;
    }>
  ): void {
    // 查找最新的 assistant 消息
    const assistantMessages = historyMessages.filter(m => m.role === 'assistant');

    if (assistantMessages.length === 0) {
      console.log('[ChatService] history 中没有 assistant 消息');
      return;
    }

    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];
    const content = lastAssistantMsg.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text || '')
      .join('\n\n')
      .trim();

    console.log('[ChatService] 从 history 提取最新 assistant 消息, 长度:', content.length);

    // 如果有内容，添加到消息列表
    if (content) {
      // 检查是否已经存在（避免重复）
      const lastMsg = this.messages[this.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content === content) {
        console.log('[ChatService] 消息已存在，跳过添加');
        return;
      }

      const message: ChatMessage = {
        id: this.generateId(),
        sessionId: this.sessionId,
        role: 'assistant',
        content,
        timestamp: lastAssistantMsg.timestamp || Date.now(),
        status: 'sent'
      };

      console.log('[ChatService] 从 history 添加 AI 回复消息');

      this.addMessage(message);
    } else {
      console.log('[ChatService] history 消息内容为空');
    }
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
        limit: 10  // 只获取最近 10 条消息
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
