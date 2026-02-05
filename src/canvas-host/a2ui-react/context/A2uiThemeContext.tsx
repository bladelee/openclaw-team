/**
 * A2UI Theme Context
 * Manages theme and platform detection with dark mode support
 */

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import type { A2uiTheme, Platform, ThemeMode } from '../types';

// Dark theme (default - already dark)
const darkTheme: A2uiTheme = {
  colors: {
    primary: '#06b6d4',
    primaryAndroid: '#06b6d4',
    primaryIOS: '#0891b2',
    secondary: '#0891b2',
    background: '#071016',
    surface: '#0f1720',
    text: '#ffffff',
    textSecondary: '#94a3b8',
    statusOk: '#10b981',
    statusError: '#ef4444',
    statusWarning: '#f59e0b'
  },
  platform: {
    android: {
      shadow: '0 2px 10px rgba(6, 182, 212, 0.14)',
      blur: '10px'
    },
    ios: {
      shadow: '0 10px 25px rgba(6, 182, 212, 0.18)',
      blur: '14px'
    }
  },
  components: {
    Button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '500'
    },
    Card: {
      padding: '16px',
      borderRadius: '12px',
      backgroundColor: 'rgba(15, 23, 32, 0.8)'
    },
    Text: {
      small: { fontSize: '14px' },
      medium: { fontSize: '16px' },
      large: { fontSize: '18px' },
      xlarge: { fontSize: '20px' }
    },
    TextField: {
      padding: '12px',
      borderRadius: '8px',
      backgroundColor: 'rgba(15, 23, 32, 0.8)',
      fontSize: '16px'
    }
  },
  cssVars: {
    '--openclaw-primary': '#06b6d4',
    '--openclaw-background': '#071016',
    '--openclaw-surface': '#0f1720',
    '--openclaw-text': '#ffffff'
  }
};

// Light theme
const lightTheme: A2uiTheme = {
  ...darkTheme,
  colors: {
    primary: '#06b6d4',
    primaryAndroid: '#06b6d4',
    primaryIOS: '#0891b2',
    secondary: '#0891b2',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    statusOk: '#10b981',
    statusError: '#ef4444',
    statusWarning: '#f59e0b'
  },
  cssVars: {
    '--openclaw-primary': '#06b6d4',
    '--openclaw-background': '#ffffff',
    '--openclaw-surface': '#f8fafc',
    '--openclaw-text': '#1e293b'
  }
};

interface A2uiThemeContextValue {
  theme: A2uiTheme;
  platform: Platform;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const A2uiThemeContext = createContext<A2uiThemeContextValue | undefined>(undefined);

export const A2uiThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const platform = useMemo((): Platform => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'ios';
    }
    if (/Android/i.test(ua)) {
      return 'android';
    }
    return 'unknown';
  }, []);

  // Detect system theme preference
  const [systemTheme, setSystemTheme] = useState<ThemeMode>('dark');

  // Current mode (can be manually set or auto)
  const [mode, setModeState] = useState<ThemeMode>('auto');

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Set initial value
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Determine actual theme based on mode
  const theme = useMemo(() => {
    const actualMode = mode === 'auto' ? systemTheme : mode;
    return actualMode === 'dark' ? darkTheme : lightTheme;
  }, [mode, systemTheme]);

  // Set mode function
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    const vars = theme.cssVars;

    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });

    // Add theme class to root
    root.setAttribute('data-theme', mode === 'auto' ? systemTheme : mode);
  }, [theme, mode, systemTheme]);

  const contextValue = useMemo(() => ({
    theme,
    platform,
    mode,
    setMode
  }), [theme, platform, mode, setMode]);

  return (
    <A2uiThemeContext.Provider value={contextValue}>
      {children}
    </A2uiThemeContext.Provider>
  );
};

export const useA2uiTheme = () => {
  const context = useContext(A2uiThemeContext);
  if (!context) {
    throw new Error('useA2uiTheme 必须在 A2uiThemeProvider 内使用');
  }
  return context;
};
