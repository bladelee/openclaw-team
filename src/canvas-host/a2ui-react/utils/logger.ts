/**
 * Logger Utility
 * Safe logging with circular reference protection
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  [key: string]: unknown;
  timestamp: string;
  actionId?: string;
  platform?: string;
}

/**
 * Safely stringify data (prevents circular reference errors)
 */
function safeStringify(data: unknown): string {
  const cache = new WeakSet();
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular]';
      }
      cache.add(value);
    }
    return value;
  });
}

/**
 * Check if running in production
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';
}

/**
 * Logger with multi-environment support
 */
export const logger = {
  log: (level: LogLevel, message: string, data: LogData = {}): void => {
    const logInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      ...data
    };

    // Console output in development
    if (!isProduction()) {
      switch (level) {
        case 'info':
          console.log('[OpenClaw INFO]', logInfo);
          break;
        case 'warn':
          console.warn('[OpenClaw WARN]', logInfo);
          break;
        case 'error':
          console.error('[OpenClaw ERROR]', logInfo);
          break;
        case 'debug':
          console.debug('[OpenClaw DEBUG]', logInfo);
          break;
      }
    }

    // In production, send to native/backend
    if (isProduction()) {
      try {
        const bridge = window.webkit?.messageHandlers?.openclawLogger || window.openclawLogger;
        if (bridge?.postMessage) {
          bridge.postMessage(safeStringify(logInfo));
        } else {
          // Fallback: send to backend
          fetch('/api/a2ui/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: safeStringify(logInfo)
          }).catch(() => {
            // Silently fail for log requests
          });
        }
      } catch {
        // Silently fail for log requests
      }
    }
  },

  info: (msg: string, data?: LogData) => logger.log('info', msg, data),
  warn: (msg: string, data?: LogData) => logger.log('warn', msg, data),
  error: (msg: string, data?: LogData) => logger.log('error', msg, data),
  debug: (msg: string, data?: LogData) => logger.log('debug', msg, data)
};
