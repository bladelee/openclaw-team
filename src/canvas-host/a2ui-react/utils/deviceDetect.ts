/**
 * Device Detection Utilities
 */

export interface DeviceInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  userAgent: string;
}

/**
 * Detect device information from user agent
 */
export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = /Mobile|Tablet|iPhone|iPad|iPod|Android/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua);

  return {
    isAndroid,
    isIOS,
    isMobile,
    isTablet,
    isDesktop: !isMobile,
    userAgent: ua
  };
}

/**
 * Shorthand device detection
 */
export const deviceDetect = detectDevice;
