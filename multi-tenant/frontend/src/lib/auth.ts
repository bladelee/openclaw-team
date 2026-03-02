/**
 * Liuma Authentication SDK Instance
 *
 * Provides centralized authentication using @liuma/auth-sdk
 */

import { LiumaAuth } from '@liuma/auth-sdk';

const LIUMA_URL = process.env.NEXT_PUBLIC_LIUMA_URL || 'https://auth.liuma.app';
const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'openclaw-pc';

// Get the redirect URI based on environment
const getRedirectUri = () => {
  if (typeof window === 'undefined') {
    return `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
};

/**
 * Liuma Auth Instance
 *
 * This instance is used throughout the application for authentication.
 * It supports OAuth login (Google, GitHub, Microsoft, WeChat) and
 * automatic token management.
 */
export const auth = new LiumaAuth({
  authCenterUrl: LIUMA_URL,
  appId: APP_ID,
  redirectUri: getRedirectUri(),
  debug: process.env.NODE_ENV === 'development',
  autoRefreshToken: true,
  storagePrefix: 'openclaw',
});

/**
 * Export types from @liuma/auth-sdk for convenience
 */
export type { User, Session, LiumaAuthConfig, OAuthProvider } from '@liuma/auth-sdk';
