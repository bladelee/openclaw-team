/**
 * useChat Hook
 * 用于聊天功能
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatService, ChatMessage } from '../services/chat';
import { GatewayService } from '../services/gateway';

export function useChat(gateway: GatewayService, sessionId: string = 'main') {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 使用 ref 保存 ChatService 实例，确保所有操作使用同一个实例
  const chatServiceRef = useRef<ChatService | null>(null);

  useEffect(() => {
    console.log('[useChat] 创建 ChatService 实例, sessionId:', sessionId);
    // 创建 ChatService 实例（只创建一次）
    if (!chatServiceRef.current) {
      chatServiceRef.current = new ChatService(gateway, sessionId);
    }

    const chatService = chatServiceRef.current;

    // 订阅消息更新
    const unsubscribe = chatService.subscribe((updatedMessages) => {
      console.log('[useChat] 收到消息更新, 数量:', updatedMessages.length);
      setMessages(updatedMessages);
    });

    // 初始化消息列表
    setMessages(chatService.getMessages());

    return () => {
      console.log('[useChat] 清理订阅');
      unsubscribe();
    };
  }, [gateway, sessionId]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) {
      return;
    }

    console.log('[useChat] 发送消息:', text);
    setIsLoading(true);
    try {
      // 使用同一个 ChatService 实例
      if (!chatServiceRef.current) {
        throw new Error('ChatService 未初始化');
      }
      await chatServiceRef.current.sendText(text);
      console.log('[useChat] 发送成功');
    } catch (error) {
      console.error('[useChat] 发送消息失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    console.log('[useChat] 清空消息');
    chatServiceRef.current?.clearMessages();
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    console.log('[useChat] 删除消息:', messageId);
    chatServiceRef.current?.deleteMessage(messageId);
  }, []);

  return {
    messages,
    sendText,
    clearMessages,
    deleteMessage,
    isLoading,
    messageCount: messages.length
  };
}
