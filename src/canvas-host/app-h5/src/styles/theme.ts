/**
 * 主题配置
 * 提供三种主题：浅色、蓝色渐变、深色（A2UI 原版）
 */

export type ThemeType = "light" | "blue" | "dark";

export interface Theme {
  name: string;
  colors: {
    // 背景色
    background: string;
    backgroundSecondary?: string; // 用于渐变背景

    // 表面/卡片
    surface: string;
    card: string;
    cardHover?: string;

    // 主色（按钮、链接等）
    primary: string;
    primaryHover?: string;
    primaryLight?: string;

    // 边框
    border: string;
    borderLight?: string;

    // 文字
    text: string;
    textSecondary: string;
    textTertiary: string;
    textDisabled?: string;

    // 状态
    success: string;
    warning: string;
    error: string;
    info: string;

    // 覆盖层
    overlay: string;
    overlayDark?: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

/**
 * 浅色主题 - 类似原始 chat/settings
 */
export const lightTheme: Theme = {
  name: "浅色主题",
  colors: {
    background: "#f8fafc",
    surface: "#ffffff",
    card: "#ffffff",
    cardHover: "#f1f5f9",
    primary: "#3b82f6", // 蓝色
    primaryHover: "#2563eb",
    primaryLight: "#dbeafe",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    text: "#1e293b", // 深灰
    textSecondary: "#64748b",
    textTertiary: "#94a3b8",
    textDisabled: "#cbd5e1",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  },
};

/**
 * 蓝色渐变主题 - 现代科技感
 */
export const blueTheme: Theme = {
  name: "蓝色渐变",
  colors: {
    background: "#0f172a", // 深蓝背景
    backgroundSecondary: "#1e3a8a", // 渐变辅助色
    surface: "#1e293b",
    card: "rgba(30, 41, 59, 0.8)", // 半透明卡片
    cardHover: "rgba(30, 41, 59, 0.95)",
    primary: "#3b82f6", // 亮蓝色
    primaryHover: "#60a5fa",
    primaryLight: "rgba(59, 130, 246, 0.1)",
    border: "#334155",
    borderLight: "#475569",
    text: "#ffffff",
    textSecondary: "#cbd5e1",
    textTertiary: "#94a3b8",
    textDisabled: "#64748b",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
    overlay: "rgba(15, 23, 42, 0.8)",
    overlayDark: "rgba(0, 0, 0, 0.9)",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
  },
};

/**
 * 深色主题 - A2UI 原版（太黑，客户不太接受）
 */
export const darkTheme: Theme = {
  name: "深色主题",
  colors: {
    background: "#071016",
    surface: "#0f1720",
    card: "#1e293b",
    cardHover: "#334155",
    primary: "#06b6d4", // 青色
    primaryHover: "#0891b2",
    primaryLight: "rgba(6, 182, 212, 0.1)",
    border: "#1e293b",
    borderLight: "#334155",
    text: "#ffffff",
    textSecondary: "#94a3b8",
    textTertiary: "#64748b",
    textDisabled: "#475569",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#06b6d4",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
  },
};

/**
 * 主题映射
 */
export const themes: Record<ThemeType, Theme> = {
  light: lightTheme,
  blue: blueTheme,
  dark: darkTheme,
};

/**
 * 获取默认主题
 */
export const getDefaultTheme = (): ThemeType => {
  return "light"; // 默认使用浅色主题
};

/**
 * 从 localStorage 获取主题
 */
export const getStoredTheme = (): ThemeType => {
  if (typeof window === "undefined") return "light";

  try {
    const stored = localStorage.getItem("app-theme");
    if (stored && stored in themes) {
      return stored as ThemeType;
    }
  } catch (e) {
    console.error("Failed to load theme from localStorage:", e);
  }

  return "light";
};

/**
 * 保存主题到 localStorage
 */
export const storeTheme = (theme: ThemeType): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("app-theme", theme);
  } catch (e) {
    console.error("Failed to save theme to localStorage:", e);
  }
};

/**
 * 应用主题到 DOM（添加 CSS 类）
 */
export const applyThemeToDOM = (theme: ThemeType): void => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // 移除所有主题类
  root.classList.remove("theme-light", "theme-blue", "theme-dark");

  // 添加当前主题类
  root.classList.add(`theme-${theme}`);

  // 应用背景渐变（蓝色主题）
  if (theme === "blue") {
    root.style.background = `linear-gradient(135deg, ${blueTheme.colors.background} 0%, ${blueTheme.colors.backgroundSecondary || blueTheme.colors.background} 100%)`;
  } else {
    root.style.background = "";
  }
};
