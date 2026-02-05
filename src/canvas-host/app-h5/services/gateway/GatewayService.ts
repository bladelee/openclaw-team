/**
 * Gateway WebSocket 服务
 * 负责与 Gateway 的 WebSocket 连接和消息收发
 */

import {
  GatewayMessage,
  GatewayConfig,
  ConnectionStatus,
  GatewayListeners
} from './GatewayTypes';

const DEFAULT_CONFIG: Required<Omit<GatewayConfig, 'token' | 'role'>> & { token?: string; role?: 'operator' | 'node' } = {
  url: 'ws://localhost:18789',
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  token: undefined,
  role: 'operator'
};

export class GatewayService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private messageQueue: GatewayMessage[] = [];
  private status: ConnectionStatus = 'disconnected';
  private listeners: GatewayListeners = {};
  private url: string;
  private connectNonce: string | null = null;
  private handshakeComplete = false;
  private token?: string;
  private role: 'operator' | 'node';

  constructor(config: Partial<GatewayConfig> = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    this.url = finalConfig.url;
    this.reconnectDelay = finalConfig.reconnectDelay;
    this.maxReconnectDelay = finalConfig.maxReconnectDelay;
    this.token = finalConfig.token;
    this.role = finalConfig.role || 'operator';
  }

  /**
   * 连接到 Gateway
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.warn('[Gateway] 已经连接或正在连接');
      return;
    }

    console.log(`[Gateway] 连接到 ${this.url}`);
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      // eslint-disable-next-line unicorn/prefer-add-event-listener
      this.ws.onopen = () => {
        console.log('[Gateway] WebSocket 已连接');
        this.reconnectDelay = DEFAULT_CONFIG.reconnectDelay;
        // 等待 connect.challenge 事件...
        this.setStatus('connecting');
      };

      // eslint-disable-next-line unicorn/prefer-add-event-listener
      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data) as GatewayMessage;

          // 详细打印所有消息
          if (message.type === 'event') {
            const evtMsg = message as { event?: string; payload?: unknown };
            console.log('[Gateway] 收到 event:', evtMsg.event, evtMsg.payload);
          } else if (message.type === 'res') {
            const resMsg = message as { id?: string; ok?: boolean; payload?: unknown };
            console.log('[Gateway] 收到 res:', resMsg.id, 'ok:', resMsg.ok);
          } else {
            console.log('[Gateway] 收到消息:', message.type);
          }

          // 处理 connect.challenge 事件
          if (message.type === 'event' && (message as { event?: string }).event === 'connect.challenge') {
            this.handleConnectChallenge(message.payload as { nonce: string; ts: number });
            return;
          }

          // 处理 connect 响应
          if (message.type === 'res') {
            const response = message as { id?: string; ok?: boolean; payload?: unknown };
            if (response.id?.startsWith('connect-') && response.ok) {
              console.log('[Gateway] connect 成功');
              this.handshakeComplete = true;
              this.setStatus('connected');
              this.flushMessageQueue();
              this.listeners.onOpen?.();
            }
          }

          this.listeners.onMessage?.(message);
        } catch (error) {
          console.error('[Gateway] 消息解析错误:', error);
        }
      };

      // eslint-disable-next-line unicorn/prefer-add-event-listener
      this.ws.onerror = (error: Event) => {
        console.error('[Gateway] WebSocket 错误:', error);
        this.setStatus('error');
        this.listeners.onError?.(error);
      };

      // eslint-disable-next-line unicorn/prefer-add-event-listener
      this.ws.onclose = () => {
        console.log('[Gateway] WebSocket 已关闭');
        this.ws = null;
        this.setStatus('disconnected');
        this.listeners.onClose?.();
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[Gateway] 连接失败:', error);
      this.setStatus('error');
    }
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

    this.messageQueue = [];
    this.connectNonce = null;
    this.handshakeComplete = false;
    console.log('[Gateway] 已断开连接');
  }

  /**
   * 发送消息到 Gateway
   */
  send(message: GatewayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[Gateway] 发送消息:', message.type);
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
        console.log('[Gateway] 发送队列消息:', message.type);
      }
    }
  }

  /**
   * 自动重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

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
  on(event: 'open', callback: () => void): void;
  on(event: 'message', callback: (message: GatewayMessage) => void): void;
  on(event: 'error', callback: (error: Event) => void): void;
  on(event: 'close', callback: () => void): void;
  on(event: string, callback: unknown): void {
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
   * 设置连接状态
   */
  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.listeners.onStatusChange?.(status);
    }
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 获取当前状态
   */
  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 获取 Gateway URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * 更新 Gateway URL
   */
  setUrl(url: string): void {
    if (this.isConnected) {
      this.disconnect();
    }
    this.url = url;
  }

  /**
   * 更新认证 Token
   */
  setToken(token: string | undefined): void {
    this.token = token;
  }

  /**
   * 更新客户端角色
   */
  setRole(role: 'operator' | 'node'): void {
    this.role = role;
  }

  /**
   * 处理 connect.challenge 事件
   */
  private handleConnectChallenge(payload: { nonce: string; ts: number }): void {
    console.log('[Gateway] 收到 connect.challenge, nonce:', payload.nonce);
    this.connectNonce = payload.nonce;
    this.sendConnect();
  }

  /**
   * 发送 connect 请求
   */
  private sendConnect(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[Gateway] WebSocket 未连接，无法发送 connect 请求');
      return;
    }

    // 构建客户端信息 - 使用 Gateway 认可的固定值
    const clientInfo = {
      id: 'webchat-ui',  // Gateway 认可的客户端 ID
      displayName: 'OpenClaw H5 Client',
      version: '1.0.0',
      platform: 'web',
      mode: 'webchat'  // Gateway 认可的客户端模式
    };

    // 构建认证信息
    const auth: { token?: string } = {};
    if (this.token) {
      auth.token = this.token;
    }

    // 构建 params 对象（不是 JSON 字符串）
    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: clientInfo,
      role: this.role,
      scopes: this.role === 'operator' ? ['operator.read', 'operator.write'] : ['node.read', 'node.write'],
      locale: 'zh-CN',
      userAgent: 'openclaw-h5/1.0.0'
    };

    // 如果有 token，添加认证
    if (this.token) {
      params.auth = auth;
    }

    const connectRequest = {
      type: 'req',  // 使用 'req' 而不是 'request'
      id: 'connect-' + Date.now(),
      method: 'connect',
      params: params  // 直接对象，不是 JSON 字符串
    };

    console.log('[Gateway] 发送 connect 请求:', JSON.stringify(connectRequest, null, 2));
    this.ws.send(JSON.stringify(connectRequest));
  }
}
