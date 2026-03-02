/**
 * 主题切换组件
 * 让用户可以选择浅色、蓝色渐变、深色主题
 */

import { useTheme } from "../contexts/ThemeContext";
import { type ThemeType } from "../styles/theme";

interface ThemeOption {
  value: ThemeType;
  name: string;
  description: string;
  preview: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    name: "浅色主题",
    description: "清爽简洁，适合商务场景",
    preview: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
  },
  {
    value: "blue",
    name: "蓝色渐变",
    description: "现代科技感，视觉冲击力强",
    preview: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
  },
  {
    value: "dark",
    name: "深色主题",
    description: "A2UI 原版，深蓝黑色调",
    preview: "linear-gradient(135deg, #071016 0%, #0f1720 100%)",
  },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
        主题风格
      </label>
      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="relative rounded-xl p-3 text-left transition-all hover:scale-105 active:scale-95"
            style={{
              border: `2px solid ${theme === option.value ? "var(--color-primary)" : "var(--color-border)"}`,
              backgroundColor: "var(--color-surface)",
              boxShadow: theme === option.value ? "0 0 0 2px var(--color-primary-light)" : "none",
            }}
          >
            {/* 主题预览色块 */}
            <div
              className="w-full h-12 rounded-lg mb-2"
              style={{
                background: option.preview,
              }}
            />

            {/* 主题名称 */}
            <div className="text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
              {option.name}
              {theme === option.value && (
                <span className="ml-1" style={{ color: "var(--color-primary)" }}>
                  ✓
                </span>
              )}
            </div>

            {/* 主题描述 */}
            <div className="text-xs leading-tight" style={{ color: "var(--color-text-tertiary)" }}>
              {option.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
