/**
 * Bridge Adapter
 * Handles communication with native (iOS/Android) or H5 backend
 */

import type { UserAction, BridgeResult, PlatformInfo } from '../types';

/** Bridge configuration */
const BRIDGE_TIMEOUT = 10000; // 10 seconds

/**
 * Bridge Adapter for native/H5 communication
 */
export class BridgeAdapter {
  private platform: PlatformInfo;

  constructor() {
    this.platform = this.detectPlatform();
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): PlatformInfo {
    const ua = navigator.userAgent;
    return {
      isAndroid: /Android/i.test(ua),
      isIOS: /iPhone|iPad|iPod/i.test(ua),
      isPureH5: !/Android|iPhone|iPad|iPod/i.test(ua),
      userAgent: ua
    };
  }

  /**
   * Get platform info
   */
  getPlatform(): PlatformInfo {
    return this.platform;
  }

  /**
   * Send user action to native/backend
   */
  async postMessage(userAction: UserAction): Promise<BridgeResult> {
    // Validate required fields
    if (!userAction.id || !userAction.name || !userAction.surfaceId || !userAction.sourceComponentId) {
      return {
        ok: false,
        error: '用户动作缺少必填字段'
      };
    }

    try {
      if (this.platform.isPureH5) {
        return await this.postToBackend(userAction);
      }

      return await this.postToNative(userAction);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * Post to native bridge (iOS/Android)
   */
  private async postToNative(userAction: UserAction): Promise<BridgeResult> {
    const bridge = this.getNativeBridge();

    if (!bridge?.postMessage) {
      return {
        ok: false,
        error: '原生桥接未找到'
      };
    }

    try {
      // iOS: post object, Android: post JSON string
      const payload = this.platform.isIOS
        ? { userAction }
        : JSON.stringify({ userAction });

      bridge.postMessage(payload);

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '桥接调用失败'
      };
    }
  }

  /**
   * Get native bridge object
   */
  private getNativeBridge() {
    if (this.platform.isIOS) {
      return window.webkit?.messageHandlers?.openclawCanvasA2UIAction;
    }
    return window.openclawCanvasA2UIAction;
  }

  /**
   * Post to backend (pure H5 mode)
   */
  private async postToBackend(userAction: UserAction): Promise<BridgeResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT);

    try {
      const response = await fetch('/api/a2ui/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userAction }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return { ok: true };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            ok: false,
            error: `请求超时 (${BRIDGE_TIMEOUT}ms)`
          };
        }
        return {
          ok: false,
          error: error.message
        };
      }

      return {
        ok: false,
        error: '网络请求失败'
      };
    }
  }

  /**
   * Send log to native/backend
   */
  async log(level: string, message: string, data: Record<string, unknown>): Promise<void> {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };

    try {
      const bridge = this.platform.isIOS
        ? window.webkit?.messageHandlers?.openclawLogger
        : window.openclawLogger;

      if (bridge?.postMessage) {
        bridge.postMessage(JSON.stringify(logEntry));
      } else {
        // Fallback: send to backend
        await fetch('/api/a2ui/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry)
        }).catch(() => {
          // Silently fail for log requests
        });
      }
    } catch {
      // Silently fail for log requests
    }
  }
}

/** Global bridge instance */
let bridgeInstance: BridgeAdapter | null = null;

/**
 * Get bridge adapter singleton
 */
export function getBridgeAdapter(): BridgeAdapter {
  if (!bridgeInstance) {
    bridgeInstance = new BridgeAdapter();
  }
  return bridgeInstance;
}
