/**
 * Theme Context - 主题管理
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  ThemeType,
  themes,
  getStoredTheme,
  storeTheme,
  applyThemeToDOM,
  type Theme,
} from "../styles/theme";

interface ThemeContextType {
  theme: ThemeType;
  themeConfig: Theme;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    // 初始化时从 localStorage 读取，否则使用默认
    return getStoredTheme();
  });

  // 切换主题
  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    storeTheme(newTheme);
    applyThemeToDOM(newTheme);
  };

  // 初始化时应用主题
  useEffect(() => {
    applyThemeToDOM(theme);
  }, []);

  const themeConfig = themes[theme];

  return (
    <ThemeContext.Provider value={{ theme, themeConfig, setTheme }}>
      <div className={`theme-${theme}`} style={{ height: "100%", width: "100%" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
