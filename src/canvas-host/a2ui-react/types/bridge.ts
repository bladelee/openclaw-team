/**
 * Bridge Type Definitions
 * For native/H5 communication
 */

/** User action sent to native/backend */
export interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string; // ISO 8601
  context: Record<string, unknown>;
}

/** Action status received from native/backend */
export interface ActionStatus {
  id: string; // Corresponds to UserAction.id
  ok: boolean;
  error?: string;
}

/** Pending action state */
export interface PendingAction {
  id: string;
  name: string;
  phase: 'sending' | 'sent' | 'error';
  startedAt: number;
  error?: string;
}

/** Bridge message result */
export interface BridgeResult {
  ok: boolean;
  error?: string;
}

/** Platform detection result */
export interface PlatformInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isPureH5: boolean;
  userAgent: string;
}

/** Native bridge interfaces */
export interface WebKitMessageHandlers {
  openclawCanvasA2UIAction?: {
    postMessage(message: { userAction: UserAction }): void;
  };
  openclawLogger?: {
    postMessage(message: string): void;
  };
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: WebKitMessageHandlers;
    };
    openclawCanvasA2UIAction?: {
      postMessage(message: string): void;
    };
    openclawLogger?: {
      postMessage(message: string): void;
    };
  }
}

/** Global A2UI API */
export interface OpenClawA2UIAPI {
  applyMessages(messages: unknown[]): Promise<{ ok: boolean; surfaces: string[] }>;
  reset(): Promise<{ ok: boolean }>;
  getSurfaces(): string[];
}

declare global {
  interface Window {
    openclawA2UI?: OpenClawA2UIAPI;
  }
}
