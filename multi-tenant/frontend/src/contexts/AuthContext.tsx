/**
 * Liuma Authentication Context Provider
 *
 * Provides auth state and functions to all components
 * Integrates with @liuma/auth-sdk
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth as authInstance } from '@/lib/auth';
import type { User, Session } from '@liuma/auth-sdk';

interface AuthContextType {
  auth: typeof authInstance;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authMethod: 'liuma' | 'legacy' | null;
  login: (provider?: 'google' | 'github' | 'microsoft' | 'wechat' | 'email') => Promise<void>;
  loginWithLegacy: (email: string, password: string) => Promise<void>;
  loginWithDevMode: (userId: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'liuma' | 'legacy' | null>(null);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = await authInstance.getSession();
        if (sessionData) {
          setSession(sessionData);
          setUser(sessionData.user);
          setAuthMethod('liuma');
        }
      } catch (error) {
        console.error('Failed to load session:', error);

        // Check for legacy token in localStorage
        const legacyToken = localStorage.getItem('token');
        const legacyUser = localStorage.getItem('user');
        if (legacyToken && legacyUser) {
          try {
            const user = JSON.parse(legacyUser);
            setUser(user as unknown as User);
            setAuthMethod('legacy');
          } catch {
            // Invalid legacy data, clear it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, []);

  const login = async (
    provider: 'google' | 'github' | 'microsoft' | 'wechat' | 'email' = 'google',
  ) => {
    await authInstance.login(provider);
  };

  const loginWithLegacy = async (email: string, password: string) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    // Store in legacy format
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({ userId: data.userId, email: data.email }));
    localStorage.setItem('refreshToken', data.refreshToken);

    setUser({ userId: data.userId, email: data.email } as unknown as User);
    setAuthMethod('legacy');
  };

  const loginWithDevMode = async (userId: string, email: string) => {
    // Generate signature for Shared Secret auth
    const timestamp = Date.now();
    const signature = await generateSignature(userId, timestamp);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/auth/signature/${userId}`,
      {
        headers: {
          'X-User-Email': email,
          'X-User-Signature': signature,
        },
      },
    );

    if (!response.ok) {
      throw new Error('Dev login failed');
    }

    // Store as legacy token
    const token = await response.text();
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ userId, email }));
    localStorage.setItem('signature', signature);

    setUser({ userId, email } as unknown as User);
    setAuthMethod('legacy');
  };

  const logout = async () => {
    try {
      // Logout from Liuma
      await authInstance.logout();
    } catch {
      // Ignore logout errors
    }

    // Clear legacy data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('signature');
    localStorage.removeItem('openclaw-auth-storage');

    setSession(null);
    setUser(null);
    setAuthMethod(null);
  };

  const refreshSession = async () => {
    try {
      const sessionData = await authInstance.getSession();
      if (sessionData) {
        setSession(sessionData);
        setUser(sessionData.user);
        setAuthMethod('liuma');
      } else {
        // Check legacy
        const legacyToken = localStorage.getItem('token');
        const legacyUser = localStorage.getItem('user');
        if (legacyToken && legacyUser) {
          const user = JSON.parse(legacyUser);
          setUser(user as unknown as User);
          setAuthMethod('legacy');
        }
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  const value: AuthContextType = {
    auth: authInstance,
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    authMethod,
    login,
    loginWithLegacy,
    loginWithDevMode,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

// Helper function to generate HMAC signature
async function generateSignature(userId: string, timestamp: number): Promise<string> {
  const crypto = window.crypto || (window as any).msCrypto;
  if (!crypto) {
    throw new Error('Crypto API not available');
  }

  const message = `${userId}:${timestamp}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // Get the shared secret from environment or use a default for dev
  const secretKey = process.env.NEXT_PUBLIC_SHARED_SECRET_KEY || 'dev-secret-key';
  const keyData = encoder.encode(secretKey);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `${signatureHex}:${timestamp}`;
}
