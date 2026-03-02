/**
 * useChat Hook
 * 用于聊天功能
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatService, ChatMessage } from "../services/chat";
import { GatewayService } from "../services/gateway";

export function useChat(gateway: GatewayService | null, sessionId: string = "main") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 使用 ref 保存 ChatService 实例和 unsubscribe 函数
  const chatServiceRef = useRef<ChatService | null>(null);
  const gatewayRef = useRef<GatewayService | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // 如果没有 gateway，不创建 ChatService
    if (!gateway) {
      console.log("[useChat] gateway 为 null，跳过 ChatService 创建");
      return;
    }

    console.log(
      "[useChat] 创建/更新 ChatService 实例, sessionId:",
      sessionId,
      "gateway URL:",
      gateway.getUrl(),
    );
    console.log("[useChat] 上一个 gateway URL:", gatewayRef.current?.getUrl() || "null");

    // 如果 gateway 变了，重新创建 ChatService
    if (gatewayRef.current !== gateway) {
      console.log("[useChat] 检测到 gateway 变化，重新创建 ChatService");

      // 清理旧的订阅
      if (unsubscribeRef.current) {
        console.log("[useChat] 清理旧的订阅");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      gatewayRef.current = gateway;
      chatServiceRef.current = new ChatService(gateway, sessionId);
    }

    const chatService = chatServiceRef.current!;

    // 只订阅一次（如果还没有订阅）
    if (!unsubscribeRef.current) {
      console.log("[useChat] 订阅消息更新");
      unsubscribeRef.current = chatService.subscribe((updatedMessages) => {
        console.log("[useChat] 收到消息更新, 数量:", updatedMessages.length);
        setMessages(updatedMessages);
      });
    }

    // 初始化消息列表
    setMessages(chatService.getMessages());

    return () => {
      console.log("[useChat] useEffect 清理");
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [gateway, sessionId]);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim()) {
      return;
    }

    console.log("[useChat] 发送消息:", text);
    setIsLoading(true);
    try {
      // 使用同一个 ChatService 实例
      if (!chatServiceRef.current) {
        throw new Error("ChatService 未初始化");
      }
      await chatServiceRef.current.sendText(text);
      console.log("[useChat] 发送成功");
    } catch (error) {
      console.error("[useChat] 发送消息失败:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    console.log("[useChat] 清空消息");
    chatServiceRef.current?.clearMessages();
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    console.log("[useChat] 删除消息:", messageId);
    chatServiceRef.current?.deleteMessage(messageId);
  }, []);

  return {
    messages,
    sendText,
    clearMessages,
    deleteMessage,
    isLoading,
    messageCount: messages.length,
  };
}
