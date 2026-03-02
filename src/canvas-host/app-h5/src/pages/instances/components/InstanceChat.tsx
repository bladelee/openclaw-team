/**
 * InstanceChat - 实例聊天界面
 * 使用 A2UI 深色主题颜色
 * 参考原 ChatPage.tsx 的布局实现
 */

import { Send, Loader2, Wifi, WifiOff } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Instance } from "../../../services/api/tenant";
import { useWebSocket } from "../../../hooks/useWebSocket";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface InstanceChatProps {
  instance: Instance;
}

export function InstanceChat({ instance }: InstanceChatProps) {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();

  // 组件挂载日志
  console.debug(
    "[InstanceChat] Component mounted, instance:",
    instance.name,
    "instanceId:",
    instance.instanceId,
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 从 localStorage 加载 WebSocket 配置
  const [wsConfig, setWsConfig] = useState<{
    url: string;
    token: string;
    role: "operator" | "node";
  } | null>(null);

  // 刷新配置的函数
  const loadConfig = useCallback(() => {
    const storageKey = `instance-${instance.instanceId}`;
    const savedConfig = localStorage.getItem(storageKey);
    console.debug("[InstanceChat] Loading config from:", storageKey, savedConfig);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        console.debug("[InstanceChat] Loaded config:", config);
        setWsConfig(config);
      } catch (e) {
        console.error("Failed to load WebSocket config:", e);
      }
    } else {
      console.debug("[InstanceChat] No config found in localStorage");
      setWsConfig(null);
    }
  }, [instance.instanceId]);

  // 组件挂载时加载配置
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 监听 localStorage 变化（当在设置页保存配置时）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `instance-${instance.instanceId}`) {
        console.debug("[InstanceChat] Config changed in localStorage, reloading...");
        loadConfig();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [instance.instanceId, loadConfig]);

  // 监听自定义配置更新事件
  useEffect(() => {
    const handleConfigUpdate = (e: CustomEvent) => {
      if (e.detail?.instanceId === instance.instanceId) {
        console.debug("[InstanceChat] Config update event received, reloading...");
        loadConfig();
      }
    };

    window.addEventListener("instance-config-updated", handleConfigUpdate as EventListener);
    return () =>
      window.removeEventListener("instance-config-updated", handleConfigUpdate as EventListener);
  }, [instance.instanceId, loadConfig]);

  // 使用 visibility change 检测页面重新激活（从设置页返回）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.debug("[InstanceChat] Page became visible, reloading config...");
        loadConfig();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadConfig]);

  // WebSocket 连接
  const { isConnected, isConnecting, send } = useWebSocket({
    url: wsConfig?.wsUrl || "",
    token: wsConfig?.authToken,
    role: wsConfig?.userRole,
    onConnected: () => {
      console.debug("[InstanceChat] WebSocket connected");
    },
    onDisconnected: () => {
      console.debug("[InstanceChat] WebSocket disconnected");
    },
    onError: (error) => {
      console.error("[InstanceChat] WebSocket error:", error);
    },
    onMessage: (message) => {
      if (message.content) {
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: message.role || "assistant",
          content: message.content,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
      }
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) {
      return;
    }

    // 检查 WebSocket 连接
    if (!isConnected) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "未连接到实例，请先在设置中配置并连接 Gateway。",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputText.trim();
    setInputText("");
    setIsLoading(true);

    try {
      // 使用 WebSocket 发送消息
      const success = send({
        type: "chat",
        content: messageToSend,
        role: "user",
      });

      if (!success) {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      setIsLoading(false);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "抱歉，消息发送失败。请检查连接状态后重试。",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* 连接状态栏 */}
      <div
        className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-500">已连接</span>
            </>
          ) : wsConfig ? (
            <>
              <WifiOff className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">{isConnecting ? "连接中..." : "未连接"}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-yellow-500">请先配置连接</span>
            </>
          )}
        </div>
        {wsConfig && !isConnected && (
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: "var(--color-card)", color: "var(--color-text-tertiary)" }}
          >
            刷新
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ display: "flex", flexDirection: "column", gap: "16px", minHeight: "0" }}
      >
        {!wsConfig ? (
          <div
            className="flex items-center justify-center"
            style={{ height: "100%", minHeight: "300px", textAlign: "center" }}
          >
            <div className="space-y-4">
              <p style={{ fontSize: "3rem" }}>🔌</p>
              <p className="text-[#94a3b8]">请先在设置中配置 Gateway 连接</p>
              <button
                onClick={() => navigate(`/instances/${instanceId}/settings`)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-text)" }}
              >
                前往设置
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{ height: "100%", minHeight: "300px" }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "3rem", marginBottom: "16px" }}>👋</p>
              <p className="text-[#94a3b8]">开始与 {instance.name} 对话吧！</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                style={{ maxWidth: "80%" }}
              >
                <div
                  className="flex items-center gap-2"
                  style={{ marginBottom: "4px", padding: "0 4px" }}
                >
                  <span
                    className="font-semibold"
                    style={{ fontSize: "14px", color: "var(--color-text-tertiary)" }}
                  >
                    {message.role === "user" ? "你" : instance.name}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-disabled)" }}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor:
                      message.role === "user" ? "var(--color-primary)" : "var(--color-surface)",
                    border: message.role === "user" ? "none" : "1px solid var(--color-border)",
                    lineHeight: 1.6,
                  }}
                >
                  <p
                    style={{
                      color: message.role === "user" ? "#ffffff" : "var(--color-text)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                    }}
                  >
                    {message.content}
                  </p>
                  {message.status === "sending" && (
                    <span style={{ fontSize: "14px", opacity: 0.7, marginLeft: "8px" }}>
                      发送中...
                    </span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
                    <span className="text-sm text-[#94a3b8]">{instance.name} 正在输入...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入框 */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <div className="flex gap-2">
          <textarea
            rows={1}
            placeholder={`发送消息给 ${instance.name}... (Enter 发送, Shift+Enter 换行)`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !isConnected}
            className="flex-1 resize-none"
            style={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "12px",
              color: "var(--color-text)",
              fontSize: "16px",
              fontFamily: "inherit",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = "var(--color-primary)";
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = "var(--color-border)";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading || !isConnected}
            className="px-4 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-text)",
              minWidth: "48px",
            }}
            aria-label="发送"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        {!isConnected && (
          <p className="text-sm mt-2" style={{ color: "var(--color-error)" }}>
            ⚠️ {wsConfig ? "未连接到实例，请刷新页面" : "请先在设置中配置 Gateway 连接"}
          </p>
        )}
      </div>
    </div>
  );
}
