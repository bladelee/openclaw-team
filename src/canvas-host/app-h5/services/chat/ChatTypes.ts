/**
 * Chat 服务类型定义
 */

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error' | 'pending';
  error?: string;
}

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 消息监听器
 */
export type MessageListener = (messages: ChatMessage[]) => void;
