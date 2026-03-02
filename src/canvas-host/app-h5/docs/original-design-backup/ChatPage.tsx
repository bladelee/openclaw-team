/**
 * Chat 聊天页面
 */

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { useChat } from "../../hooks/useChat";
import { GatewayService } from "../../services/gateway";
import "./ChatPage.css";

export const ChatPage: React.FC = () => {
  const { gateway, setCurrentPage } = useApp();
  const { messages, sendText, isLoading } = useChat(gateway);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const a2uiDetectedRef = useRef(false);

  // 监听 A2UI 消息
  useEffect(() => {
    if (!gateway) {
      return;
    }

    const handleMessage = (message: { type?: string; event?: string; payload?: unknown }) => {
      // 检查是否是 a2ui 事件
      if (message.type === "event" && message.event === "a2ui") {
        console.log("[ChatPage] 检测到 A2UI 消息，自动切换到 Canvas 页面");
        a2uiDetectedRef.current = true;
        setCurrentPage("canvas");
      }
    };

    gateway.on("message", handleMessage);
  }, [gateway, setCurrentPage]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) {
      return;
    }

    try {
      await sendText(inputText);
      setInputText("");
    } catch (error) {
      console.error("发送失败:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-page">
      {/* 头部 */}
      <header className="chat-header">
        <h1>💬 OpenClaw 聊天</h1>
        <div className="header-actions">
          <button
            className="canvas-button"
            onClick={() => setCurrentPage("canvas")}
            aria-label="Canvas"
            title="查看 Canvas/A2UI 界面"
          >
            🎨 Canvas
          </button>
          <button
            className="settings-button"
            onClick={() => setCurrentPage("settings")}
            aria-label="设置"
          >
            ⚙️ 设置
          </button>
          <div
            className={`connection-status ${gateway?.isConnected ? "connected" : "disconnected"}`}
          >
            {gateway?.isConnected ? "● 已连接" : "○ 未连接"}
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <p className="emoji">👋</p>
            <p className="title">开始对话吧！</p>
            <p className="hint">我是 OpenClaw AI 助手，有什么可以帮助你的？</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${message.role === "user" ? "user-message" : "ai-message"}`}
          >
            <div className="message-header">
              <span className="message-role">{message.role === "user" ? "You" : "AI"}</span>
              <span className="message-time">{formatTime(message.timestamp)}</span>
            </div>
            <div className="message-content">
              {message.content}
              {message.status === "sending" && <span className="sending-indicator">发送中...</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="input-container">
        <textarea
          className="message-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={1}
          disabled={!gateway?.isConnected || isLoading}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={!inputText.trim() || !gateway?.isConnected || isLoading}
        >
          {isLoading ? "发送中..." : "发送"}
        </button>
      </div>
    </div>
  );
};
