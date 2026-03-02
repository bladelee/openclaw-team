/**
 * 主题样式辅助 Hook
 * 提供便捷的方法来使用主题颜色
 */

import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";

/**
 * 获取主题样式的快捷方法
 */
export function useThemeStyles() {
  const { themeConfig } = useTheme();

  return useMemo(() => {
    const colors = themeConfig.colors;

    return {
      // 背景色
      bg: colors.background,
      bgSurface: colors.surface,
      bgCard: colors.card,
      bgCardHover: colors.cardHover,

      // 主色
      primary: colors.primary,
      primaryHover: colors.primaryHover,
      primaryLight: colors.primaryLight,

      // 边框
      border: colors.border,
      borderLight: colors.borderLight,

      // 文字
      text: colors.text,
      textSecondary: colors.textSecondary,
      textTertiary: colors.textTertiary,
      textDisabled: colors.textDisabled,

      // 状态
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,

      // 覆盖层
      overlay: colors.overlay,

      // 阴影
      shadowSm: themeConfig.shadows.sm,
      shadowMd: themeConfig.shadows.md,
      shadowLg: themeConfig.shadows.lg,

      // 组合样式
      cardStyle: {
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: "12px",
        boxShadow: themeConfig.shadows.sm,
      },

      inputStyle: {
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "8px",
        color: colors.text,
        outline: "none",
      },

      buttonStyle: {
        backgroundColor: colors.primary,
        color: "#ffffff",
        borderRadius: "8px",
        fontWeight: "medium",
      },

      buttonHoverStyle: {
        backgroundColor: colors.primaryHover || colors.primary,
        color: "#ffffff",
      },
    };
  }, [themeConfig]);
}

/**
 * 获取 CSS 变量值
 */
export function useCSSVar(name: string): string {
  return `var(${name})`;
}

/**
 * 常用的 CSS 变量名称
 */
export const CSSVars = {
  background: "--color-background",
  surface: "--color-surface",
  card: "--color-card",
  primary: "--color-primary",
  primaryHover: "--color-primary-hover",
  border: "--color-border",
  text: "--color-text",
  textSecondary: "--color-text-secondary",
  textTertiary: "--color-text-tertiary",
  success: "--color-success",
  warning: "--color-warning",
  error: "--color-error",
  overlay: "--color-overlay",
} as const;
