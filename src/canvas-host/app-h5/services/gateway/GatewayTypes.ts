/**
 * Gateway 服务类型定义
 */

/**
 * Gateway 消息类型
 */
export interface GatewayMessage {
  type: 'req' | 'res' | 'event' | 'chat' | 'a2ui' | 'action' | 'error';
  event?: string;  // event 类型的事件名（如 'connect.challenge'）
  method?: string;  // req/res 的方法名
  payload: unknown;
  timestamp?: number;
  sessionId?: string;
  id?: string;
}

/**
 * 聊天消息负载
 */
export interface ChatMessagePayload {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * A2UI 消息负载
 */
export interface A2uiMessagePayload {
  surfaceId: string;
  messages: unknown[];
}

/**
 * 连接状态
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * 连接配置
 */
export interface GatewayConfig {
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  token?: string;
  role?: 'operator' | 'node';
}

/**
 * Gateway 事件监听器
 */
export interface GatewayListeners {
  onOpen?: () => void;
  onMessage?: (message: GatewayMessage) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}
