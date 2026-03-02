/**
 * WebSocket 连接 Hook
 * 用于实例聊天功能，实现 Gateway 握手协议
 */

import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  type?: string;
  content?: string;
  role?: "user" | "assistant";
  data?: any;
}

interface UseWebSocketOptions {
  url: string;
  token?: string;
  role?: "operator" | "node";
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWebSocket({
  url,
  token,
  role = "operator",
  onMessage,
  onConnected,
  onDisconnected,
  onError,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const handshakeCompleteRef = useRef(false);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  // 使用 ref 存储回调函数，避免 connect 频繁变化
  const callbacksRef = useRef({
    onMessage,
    onConnected,
    onDisconnected,
    onError,
  });

  // 更新回调 ref
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onConnected,
      onDisconnected,
      onError,
    };
  }, [onMessage, onConnected, onDisconnected, onError]);

  // 发送 connect 请求（握手）
  const sendConnect = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("[Gateway] WebSocket 未连接，无法发送 connect 请求");
      return;
    }

    // 构建客户端信息
    const clientInfo = {
      id: "webchat-ui",
      displayName: "OpenClaw H5 Client",
      version: "1.0.0",
      platform: "web",
      mode: "webchat",
    };

    // 构建认证信息
    const auth: { token?: string } = {};
    if (token) {
      auth.token = token;
    }

    // 构建 params 对象
    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: clientInfo,
      role: role,
      scopes:
        role === "operator" ? ["operator.read", "operator.write"] : ["node.read", "node.write"],
      locale: "zh-CN",
      userAgent: "openclaw-h5/1.0.0",
    };

    // 如果有 token，添加认证
    if (token) {
      params.auth = auth;
    }

    const connectRequest = {
      type: "req",
      id: "connect-" + Date.now(),
      method: "connect",
      params: params,
    };

    console.log("[Gateway] 发送 connect 请求:", JSON.stringify(connectRequest, null, 2));
    ws.send(JSON.stringify(connectRequest));
  }, [token, role]);

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (!url) {
      console.warn("[WebSocket] No URL provided");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.debug("[WebSocket] Already connected");
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    handshakeCompleteRef.current = false;

    try {
      console.log("[Gateway] 连接到", url);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Gateway] WebSocket 已连接，等待握手...");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // 打印所有消息类型
          console.log("[Gateway] 收到消息:", message.type);

          // 处理 connect.challenge 事件
          if (message.type === "event" && message.event === "connect.challenge") {
            console.log("[Gateway] 收到 connect.challenge, nonce:", message.payload?.nonce);
            sendConnect();
            return;
          }

          // 处理 connect 响应
          if (message.type === "res") {
            if (message.id?.startsWith("connect-")) {
              if (message.ok) {
                console.log("[Gateway] connect 成功，握手完成");
                handshakeCompleteRef.current = true;
                setState({ isConnected: true, isConnecting: false, error: null });
                callbacksRef.current.onConnected?.();
              } else {
                console.error("[Gateway] connect 失败:", message.error);
                setState((prev) => ({ ...prev, isConnecting: false, error: "连接失败" }));
              }
              return;
            }
          }

          // 握手完成后，转发其他消息给应用层
          if (handshakeCompleteRef.current) {
            // 处理 chat 事件（delta + final）
            if (message.type === "event" && message.event === "chat") {
              const payload = message.payload || {};

              // delta 事件：流式文本更新
              if (payload.state === "delta") {
                const content = payload.message?.content?.[0]?.text || "";
                if (content) {
                  const chatMessage: WebSocketMessage = {
                    content: content,
                    role: "assistant",
                  };
                  callbacksRef.current.onMessage?.(chatMessage);
                }
              }
              // final 事件：完成
              else if (payload.state === "final") {
                console.log("[Gateway] Chat message final state");
              }
            }
            // 处理响应（如 chat.send 的响应）
            else if (message.type === "res") {
              if (!message.ok) {
                console.error("[Gateway] 请求失败:", message.id, message.error);
              } else {
                console.log("[Gateway] 响应成功:", message.id);

                // 处理 chat.send 响应（包含消息历史）
                const payload = message.payload;
                if (payload && payload.messages && Array.isArray(payload.messages)) {
                  console.log("[Gateway] 收到消息历史, 数量:", payload.messages.length);

                  // 提取最后一条 assistant 消息并显示
                  const lastAssistantMsg = [...payload.messages]
                    .reverse()
                    .find((msg) => msg.role === "assistant");
                  if (lastAssistantMsg && lastAssistantMsg.content) {
                    // 解析 content 数组，提取所有文本
                    const textParts = lastAssistantMsg.content
                      .filter((c: { type?: string }) => c.type === "text")
                      .map((c: { text?: string }) => c.text || "")
                      .filter(Boolean);

                    const fullText = textParts.join("\n\n").trim();
                    if (fullText) {
                      const chatMessage: WebSocketMessage = {
                        content: fullText,
                        role: "assistant",
                      };
                      console.log("[Gateway] 显示 AI 响应:", fullText.substring(0, 100) + "...");
                      callbacksRef.current.onMessage?.(chatMessage);
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("[Gateway] 消息解析错误:", error);
        }
      };

      ws.onerror = (event) => {
        console.error("[Gateway] WebSocket 错误:", event);
        setState((prev) => ({ ...prev, error: "Connection error" }));
        callbacksRef.current.onError?.(event);
      };

      ws.onclose = () => {
        console.log("[Gateway] WebSocket 已关闭");
        setState({ isConnected: false, isConnecting: false, error: null });
        wsRef.current = null;
        handshakeCompleteRef.current = false;
        callbacksRef.current.onDisconnected?.();
      };
    } catch (error) {
      console.error("[Gateway] 连接失败:", error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, [url, sendConnect]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      console.log("[Gateway] 断开连接");
      wsRef.current.close();
      wsRef.current = null;
    }

    handshakeCompleteRef.current = false;
    setState({ isConnected: false, isConnecting: false, error: null });
  }, []);

  // 发送消息
  const send = useCallback((message: WebSocketMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !handshakeCompleteRef.current) {
      console.warn("[Gateway] 未连接或握手未完成，无法发送消息");
      return false;
    }

    try {
      const reqId = "chat-" + Date.now();
      const idempotencyKey = "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

      const chatRequest = {
        type: "req",
        id: reqId,
        method: "chat.send", // 注意：是 chat.send 不是 chat
        params: {
          sessionKey: "main",
          message: message.content,
          idempotencyKey: idempotencyKey,
        },
      };

      const data = JSON.stringify(chatRequest);
      ws.send(data);
      console.log("[Gateway] 发送聊天消息:", chatRequest);
      return true;
    } catch (error) {
      console.error("[Gateway] 发送消息失败:", error);
      return false;
    }
  }, []);

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // 当 URL 变化时自动连接
  useEffect(() => {
    if (url) {
      console.log("[Gateway] URL 可用，开始连接...");
      connect();
    } else {
      // 当 URL 清空时断开连接
      if (state.isConnected) {
        disconnect();
      }
    }
    // 只在 URL 变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    ...state,
    connect,
    disconnect,
    send,
  };
}
