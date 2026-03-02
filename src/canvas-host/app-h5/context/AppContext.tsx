/**
 * App 全局状态管理
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { GatewayService } from "../services/gateway";
import { storage } from "../utils/storage";

type Theme = "light" | "dark" | "auto";

interface AppContextType {
  gateway: GatewayService | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  currentPage: "chat" | "settings" | "canvas";
  setCurrentPage: (page: "chat" | "settings" | "canvas") => void;
  updateGatewayConfig: (config: { token?: string; role?: "operator" | "node" }) => void;
}

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
  children: ReactNode;
  gatewayUrl?: string;
  gateway?: GatewayService; // 新增：支持传入已创建的 gateway 实例
}

export function AppProvider({
  children,
  gatewayUrl = "ws://localhost:18789",
  gateway: providedGateway,
}: AppProviderProps) {
  // 使用 state 存储 gateway，以便变化时触发重新渲染
  const [gateway, setGateway] = useState<GatewayService | null>(() => {
    // 初始化时：只有提供了 gateway 才使用，否则等待
    if (providedGateway) {
      console.log("[AppProvider] 初始化使用传入的 gateway 实例, URL:", providedGateway.getUrl());
      return providedGateway;
    }

    // 不创建新实例，等待 LegacyChatPage 提供
    console.log("[AppProvider] 初始化时没有提供 gateway，等待传入");
    return null;
  });

  // 监听 providedGateway 变化并更新
  useEffect(() => {
    if (providedGateway) {
      console.log("[AppProvider] useEffect 检测到 providedGateway, URL:", providedGateway.getUrl());

      // 使用函数式更新，避免依赖 gateway
      setGateway((currentGateway) => {
        if (currentGateway !== providedGateway) {
          console.log(
            "[AppProvider] 更新 gateway 从",
            currentGateway?.getUrl() || "null",
            "到",
            providedGateway.getUrl(),
          );

          // 如果当前有连接的实例，先断开
          if (currentGateway && currentGateway.isConnected) {
            console.log("[AppProvider] 断开旧的 gateway 连接");
            currentGateway.disconnect();
          }

          return providedGateway;
        }

        console.log("[AppProvider] gateway 未变化，保持:", providedGateway.getUrl());
        return currentGateway;
      });
    }
  }, [providedGateway]);

  console.log("[AppProvider] 当前 gateway 实例:", gateway?.getUrl() || "null");
  const [theme, setThemeState] = useState<Theme>(() => {
    return storage.get<Theme>("app-theme", "auto");
  });
  const [currentPage, setCurrentPage] = useState<"chat" | "settings" | "canvas">("chat");

  // 保存主题设置
  useEffect(() => {
    storage.set("app-theme", theme);
    applyTheme(theme);
  }, [theme]);

  // 应用主题到 DOM
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const updateGatewayConfig = (config: { token?: string; role?: "operator" | "node" }) => {
    if (!gateway) {
      return;
    }
    if (config.token !== undefined) {
      gateway.setToken(config.token || undefined);
    }
    if (config.role !== undefined) {
      gateway.setRole(config.role);
    }
  };

  return (
    <AppContext.Provider
      value={{
        gateway,
        theme,
        setTheme,
        currentPage,
        setCurrentPage,
        updateGatewayConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

/**
 * 应用主题到 DOM
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // 移除所有主题类
  root.removeAttribute("data-theme");

  if (theme === "auto") {
    // 跟随系统主题
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}
