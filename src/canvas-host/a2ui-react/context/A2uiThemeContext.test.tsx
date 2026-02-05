/**
 * A2uiThemeContext Component Tests
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { A2uiThemeProvider, useA2uiTheme } from './A2uiThemeContext';

describe('A2uiThemeContext', () => {
  afterEach(() => {
    // Reset theme attribute after each test
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-theme');
    }
  });

  it('should provide default theme', () => {
    const { result } = renderHook(() => useA2uiTheme(), {
      wrapper: ({ children }) => <A2uiThemeProvider>{children}</A2uiThemeProvider>,
    });

    expect(result.current.theme).toBeDefined();
    expect(result.current.theme.colors).toBeDefined();
    expect(result.current.theme.colors.primary).toBe('#06b6d4');
  });

  it('should detect iOS platform', () => {
    // Mock iOS user agent
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useA2uiTheme(), {
      wrapper: ({ children }) => <A2uiThemeProvider>{children}</A2uiThemeProvider>,
    });

    expect(result.current.platform).toBe('ios');

    // Restore
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      writable: true,
      configurable: true,
    });
  });

  it('should detect Android platform', () => {
    // Mock Android user agent
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10)',
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useA2uiTheme(), {
      wrapper: ({ children }) => <A2uiThemeProvider>{children}</A2uiThemeProvider>,
    });

    expect(result.current.platform).toBe('android');

    // Restore
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUA,
      writable: true,
      configurable: true,
    });
  });

  it('should set mode to light', () => {
    const { result } = renderHook(() => useA2uiTheme(), {
      wrapper: ({ children }) => <A2uiThemeProvider>{children}</A2uiThemeProvider>,
    });

    act(() => {
      result.current.setMode('light');
    });

    expect(result.current.mode).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should set mode to dark', () => {
    const { result } = renderHook(() => useA2uiTheme(), {
      wrapper: ({ children }) => <A2uiThemeProvider>{children}</A2uiThemeProvider>,
    });

    act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should set mode to auto', () => {
    const { result } = renderHook(() => useA2uiTheme(), {
      wrapper: ({ children }) => <A2uiThemeProvider>{children}</A2uiThemeProvider>,
    });

    act(() => {
      result.current.setMode('auto');
    });

    expect(result.current.mode).toBe('auto');
  });
});
