/**
 * 旧版 Chat 页面 - 用于测试和对比
 * 使用之前可工作的 chat 实现
 */

import { ArrowLeft } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppProvider } from "../../../context/AppContext";
import { GatewayService } from "../../../services/gateway";

// 动态导入 ChatPage，避免循环依赖
const ChatPageComponent = React.lazy(() =>
  import("../../../pages/chat/ChatPage").then((m) => ({ default: m.ChatPage })),
);

// 模块级别的单例，确保整个应用只有一个Gateway实例
let singletonGateway: GatewayService | null = null;
let singletonInstanceId: string | null = null;

export function LegacyChatPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();

  const [gateway, setGateway] = useState<GatewayService | null>(() => {
    // 初始化时尝试复用单例
    if (singletonGateway && singletonInstanceId === instanceId) {
      console.log("[LegacyChat] 初始化：复用单例 Gateway");
      return singletonGateway;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);

  useEffect(() => {
    // 防止StrictMode双重执行
    if (mountedRef.current) {
      console.log("[LegacyChat] StrictMode 检测，跳过重复执行");
      return;
    }
    mountedRef.current = true;

    // 如果已经有匹配的单例，直接使用
    if (singletonGateway && singletonInstanceId === instanceId) {
      console.log("[LegacyChat] 使用已存在的单例 Gateway");
      setGateway(singletonGateway);
      setLoading(false);
      return;
    }

    let gatewayService: GatewayService | null = null;

    // 从 localStorage 读取配置
    const storageKey = instanceId ? `instance-${instanceId}` : "instance-default";
    const savedConfig = localStorage.getItem(storageKey);

    console.log("[LegacyChat] 尝试从", storageKey, "读取配置...");
    console.log("[LegacyChat] localStorage 内容:", savedConfig);

    if (!savedConfig) {
      // 尝试从旧版配置读取
      const oldToken = localStorage.getItem("gateway-token");
      const oldRole = localStorage.getItem("gateway-role");
      console.log("[LegacyChat] 新版配置不存在，尝试旧版配置:", { oldToken, oldRole });

      if (oldToken) {
        // 使用旧版配置
        gatewayService = new GatewayService({
          url: "ws://127.0.0.1:18789",
          token: oldToken || undefined,
          role: (oldRole as "operator" | "node") || "operator",
        });
        console.log("[LegacyChat] 使用旧版配置创建 Gateway");
        gatewayService.connect();

        // 保存为单例
        singletonGateway = gatewayService;
        singletonInstanceId = instanceId || null;

        setGateway(gatewayService);
        console.log(
          "[LegacyChat] ✓ gateway 已设置到 state (旧版配置), isConnected:",
          gatewayService.isConnected,
        );
        setLoading(false);
        return;
      }

      setError("未找到配置，请先在设置页配置并保存 Gateway 连接");
      setLoading(false);
      return;
    }

    try {
      const config = JSON.parse(savedConfig);
      console.log("[LegacyChat] 新版配置:", config);

      // 检查新版配置格式
      if (!config.wsUrl) {
        setError("配置中缺少 WebSocket URL");
        setLoading(false);
        return;
      }

      // 创建 GatewayService（使用新版的配置）
      const gatewayConfig = {
        url: config.wsUrl,
        token: config.authToken,
        role: config.userRole || "operator",
      };

      console.log("[LegacyChat] Gateway 配置:", gatewayConfig);
      gatewayService = new GatewayService(gatewayConfig);

      console.log("[LegacyChat] Gateway 创建完成，开始连接...");
      gatewayService.connect();

      // 保存为单例
      singletonGateway = gatewayService;
      singletonInstanceId = instanceId || null;

      setGateway(gatewayService);
      console.log(
        "[LegacyChat] ✓ gateway 已设置到 state, isConnected:",
        gatewayService.isConnected,
      );
      setLoading(false);
    } catch (e) {
      console.error("[LegacyChat] 配置解析失败:", e);
      setError("配置解析失败: " + (e instanceof Error ? e.message : String(e)));
      setLoading(false);
    }

    // 清理函数：只在真正卸载时断开连接（不是StrictMode）
    return () => {
      console.log("[LegacyChat] useEffect cleanup");
      // 不在这里断开，让用户主动关闭或页面关闭时自动断开
    };
  }, [instanceId]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-text-secondary)]">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !gateway) {
    return (
      <div
        className="flex items-center justify-center h-screen p-4"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <div
          className="rounded-xl p-6 text-center"
          style={{
            maxWidth: 400,
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-lg font-semibold text-[var(--color-text)] mb-2">无法加载聊天</p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error || "未知错误"}</p>
          <Link to="/instances">
            <button
              className="px-6 py-3 rounded-lg font-medium"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-text)" }}
            >
              返回实例列表
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 顶部导航栏 */}
      <header
        className="flex items-center gap-3 px-4 py-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Link
          to={`/instances/${instanceId || ""}`}
          className="p-2 rounded-lg hover:bg-[var(--color-card)] transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: "var(--color-text)" }} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
            旧版聊天测试
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            使用 GatewayService 的原始实现
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            gateway?.isConnected ? "bg-green-500 text-white" : "bg-gray-500 text-white"
          }`}
        >
          {gateway?.isConnected ? "● 已连接" : "○ 未连接"}
        </div>
      </header>

      {/* Chat 页面内容 */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {/* 创建自定义 AppProvider，传入已连接的 gateway 实例 */}
        {gateway && (
          <AppProvider gateway={gateway}>
            <ChatPageComponent />
          </AppProvider>
        )}
      </div>
    </div>
  );
}
