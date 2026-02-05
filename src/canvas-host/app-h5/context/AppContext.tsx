/**
 * App 全局状态管理
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GatewayService } from '../services/gateway';
import { storage } from '../utils/storage';

type Theme = 'light' | 'dark' | 'auto';

interface AppContextType {
  gateway: GatewayService | null;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  currentPage: 'chat' | 'settings' | 'canvas';
  setCurrentPage: (page: 'chat' | 'settings' | 'canvas') => void;
  updateGatewayConfig: (config: { token?: string; role?: 'operator' | 'node' }) => void;
}

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
  children: ReactNode;
  gatewayUrl?: string;
}

export function AppProvider({ children, gatewayUrl = 'ws://localhost:18789' }: AppProviderProps) {
  const [gateway] = useState(() => {
    const token = storage.get<string | null>('gateway-token', null);
    const role = storage.get<'operator' | 'node'>('gateway-role', 'operator');
    return new GatewayService({ url: gatewayUrl, token: token || undefined, role });
  });
  const [theme, setThemeState] = useState<Theme>(() => {
    return storage.get<Theme>('app-theme', 'auto');
  });
  const [currentPage, setCurrentPage] = useState<'chat' | 'settings' | 'canvas'>('chat');

  // 保存主题设置
  useEffect(() => {
    storage.set('app-theme', theme);
    applyTheme(theme);
  }, [theme]);

  // 应用主题到 DOM
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const updateGatewayConfig = (config: { token?: string; role?: 'operator' | 'node' }) => {
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
        updateGatewayConfig
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

/**
 * 应用主题到 DOM
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  // 移除所有主题类
  root.removeAttribute('data-theme');

  if (theme === 'auto') {
    // 跟随系统主题
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
