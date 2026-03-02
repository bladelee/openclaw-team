# app-h5 Week 1: Basic Authentication Integration Guide

## Overview

This guide details how to integrate Liuma authentication into app-h5 using the existing `@liuma/auth-sdk` package.

**Tech Stack:** Vite 6 + React 19 (NOT Next.js)
**Auth SDK:** `@liuma/auth-sdk` (cross-platform, works with any React app)
**Backend:** Liuma Authentication Center (Better Auth)

---

## 1. Installation

### 1.1 Add SDK Dependency

```bash
# In app-h5 directory
cd src/canvas-host/app-h5
pnpm add @liuma/auth-sdk@workspace:*
```

### 1.2 Environment Variables

Create or update `.env`:

```env
# Liuma Auth Center
VITE_AUTH_CENTER_URL=https://auth.liuma.app
VITE_APP_ID=openclaw-h5

# App Redirect (will be dynamically set)
VITE_APP_BASE_URL=/
```

---

## 2. SDK Initialization

### 2.1 Create Auth Context

Create `src/contexts/AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LiumaAuth } from '@liuma/auth-sdk';
import type { User, Session } from '@liuma/auth-sdk';

interface AuthContextType {
  auth: LiumaAuth | null;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider?: 'google' | 'github' | 'microsoft' | 'wechat' | 'email') => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<LiumaAuth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize SDK on mount
    const authInstance = new LiumaAuth({
      authCenterUrl: import.meta.env.VITE_AUTH_CENTER_URL || 'https://auth.liuma.app',
      appId: import.meta.env.VITE_APP_ID || 'openclaw-h5',
      redirectUri: `${window.location.origin}/auth/callback`,
      storagePrefix: 'openclaw',
      debug: import.meta.env.DEV,
    });

    setAuth(authInstance);

    // Check existing session
    authInstance.getSession().then((session) => {
      if (session) {
        setSession(session);
        setUser(session.user);
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (provider = 'google') => {
    if (!auth) throw new Error('Auth not initialized');
    await auth.login(provider);
  };

  const logout = async () => {
    if (!auth) throw new Error('Auth not initialized');
    await auth.logout();
    setSession(null);
    setUser(null);
  };

  const refreshSession = async () => {
    if (!auth) throw new Error('Auth not initialized');
    const newSession = await auth.getSession();
    if (newSession) {
      setSession(newSession);
      setUser(newSession.user);
    } else {
      setSession(null);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    auth,
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 2.2 Wrap App with Provider

Update `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

---

## 3. Login Page

### 3.1 Create Login Component

Create `src/pages/LoginPage.tsx`:

```typescript
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (provider: 'google' | 'github' | 'microsoft' | 'wechat' | 'email') => {
    try {
      setIsLoggingIn(true);
      await login(provider);
      // Redirect will happen automatically via OAuth flow
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoggingIn(false);
      // Show error toast
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome to OpenClaw</h1>
        <p>Sign in to continue</p>

        <div className="login-buttons">
          <button
            onClick={() => handleLogin('google')}
            disabled={isLoggingIn}
            className="login-btn google-btn"
          >
            Continue with Google
          </button>

          <button
            onClick={() => handleLogin('github')}
            disabled={isLoggingIn}
            className="login-btn github-btn"
          >
            Continue with GitHub
          </button>

          <button
            onClick={() => handleLogin('microsoft')}
            disabled={isLoggingIn}
            className="login-btn microsoft-btn"
          >
            Continue with Microsoft
          </button>

          <button
            onClick={() => handleLogin('wechat')}
            disabled={isLoggingIn}
            className="login-btn wechat-btn"
          >
            Continue with WeChat
          </button>

          <button
            onClick={() => handleLogin('email')}
            disabled={isLoggingIn}
            className="login-btn email-btn"
          >
            Continue with Email
          </button>
        </div>

        {isLoggingIn && (
          <div className="login-spinner">
            Redirecting to login...
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3.2 Add Login Page Styles

Create `src/pages/LoginPage.css`:

```css
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.login-card h1 {
  font-size: 24px;
  margin-bottom: 8px;
  color: #1f2937;
}

.login-card p {
  color: #6b7280;
  margin-bottom: 32px;
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-btn {
  width: 100%;
  padding: 12px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-btn { color: #4285f4; }
.github-btn { color: #24292e; }
.microsoft-btn { color: #00a4ef; }
.wechat-btn { color: #07c160; }
.email-btn { color: #6b7280; }

.login-spinner {
  margin-top: 20px;
  color: #6b7280;
  font-size: 14px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 18px;
  color: #6b7280;
}
```

---

## 4. OAuth Callback Handling

### 4.1 Create Callback Page

Create `src/pages/CallbackPage.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function CallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { auth } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setError(errorDescription || error);
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
        return;
      }

      try {
        // Handle OAuth callback with SDK
        const session = await auth!.handleCallback(code);

        if (session) {
          setStatus('success');
          // Redirect to home or instances page after 1 second
          setTimeout(() => navigate('/', { replace: true }), 1000);
        } else {
          setStatus('error');
          setError('Failed to create session');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
        }
      } catch (err) {
        console.error('Callback error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    if (auth) {
      handleCallback();
    }
  }, [auth, searchParams, navigate]);

  return (
    <div className="callback-container">
      <div className="callback-card">
        {status === 'processing' && (
          <>
            <div className="spinner"></div>
            <p>Completing sign in...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <p>Successfully signed in!</p>
            <p className="sub-text">Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">✕</div>
            <p className="error-text">Sign in failed</p>
            {error && <p className="error-detail">{error}</p>}
            <p className="sub-text">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
}
```

### 4.2 Add Callback Styles

Create `src/pages/CallbackPage.css`:

```css
.callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.callback-card {
  text-align: center;
  padding: 40px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-icon {
  width: 60px;
  height: 60px;
  background: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin: 0 auto 20px;
}

.error-icon {
  width: 60px;
  height: 60px;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justifyjustify-content: center;
  font-size: 32px;
  margin: 0 auto 20px;
}

.error-text {
  color: #ef4444;
  font-weight: 500;
  margin-bottom: 8px;
}

.error-detail {
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 8px;
}

.sub-text {
  color: #9ca3af;
  font-size: 14px;
}
```

---

## 5. Protected Routes

### 5.1 Create Protected Route Component

Create `src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### 5.2 Update App Routes

Update `src/App.tsx`:

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { CallbackPage } from './pages/CallbackPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstancesPage } from './pages/InstancesPage';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<CallbackPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <InstancesPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect based on auth */}
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? '/' : '/login'} replace />
        }
      />
    </Routes>
  );
}

export default App;
```

---

## 6. Vite Configuration

### 6.1 Update Vite Config

Update `vite.config.ts` to proxy API requests during development:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy requests to Liuma Auth Center during development
    proxy: {
      '/api/auth': {
        target: 'https://auth.liuma.app',
        changeOrigin: true,
        secure: true,
        // Don't rewrite the path - we need the full path
        rewrite: (path) => path,
      },
    },
  },
});
```

**Note:** In production, requests go directly to `https://auth.liuma.app`.

---

## 7. Session Management & Token Refresh

### 7.1 Auto Token Refresh

Update `src/contexts/AuthContext.tsx` to add auto-refresh:

```typescript
useEffect(() => {
  if (!auth || !session) return;

  // Setup token refresh before expiration
  // Better Auth sessions expire after 7 days
  const refreshInterval = setInterval(async () => {
    const currentSession = await auth.getSession();
    if (!currentSession) {
      // Session expired, logout
      await logout();
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return () => clearInterval(refreshInterval);
}, [auth, session, logout]);
```

### 7.2 API Request Interceptor

Create `src/utils/http.ts` for authenticated requests:

```typescript
import { HTTPClient } from '@liuma/auth-sdk';

let httpClient: HTTPClient | null = null;

export function getAuthHTTPClient(auth: LiumaAuth): HTTPClient {
  if (!httpClient) {
    httpClient = auth.getHTTPClient();
  }
  return httpClient;
}

// Usage example:
// const client = getAuthHTTPClient(auth);
// const response = await client.get('/api/user/profile');
```

---

## 8. Logout

### 8.1 Add Logout Button

Add to any component (e.g., header):

```typescript
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="header">
      <div className="user-info">
        <span>{user?.name || user?.email}</span>
        <button onClick={handleLogout}>Sign out</button>
      </div>
    </header>
  );
}
```

---

## 9. Testing Flow

### 9.1 Development Testing

1. Start dev server:
   ```bash
   pnpm dev
   ```

2. Navigate to `http://localhost:3000`

3. Should redirect to `/login`

4. Click "Continue with Google" (or other provider)

5. Complete OAuth flow at Liuma Auth Center

6. Redirect back to `/auth/callback?code=...`

7. Callback processes, then redirects to `/`

8. Should see authenticated session with user info

### 9.2 Verify Session Storage

Check browser storage:
- **Web (PC):** Cookies and localStorage
- **Mobile H5:** IndexedDB (Dexie)

```javascript
// Check in browser console
localStorage.getItem('openclaw_session')
// or
document.cookie
```

---

## 10. Week 1 Checklist

- [ ] Install `@liuma/auth-sdk` package
- [ ] Add environment variables
- [ ] Create `AuthContext` with `LiumaAuth` initialization
- [ ] Create `LoginPage` with OAuth buttons
- [ ] Create `CallbackPage` for OAuth handling
- [ ] Add `ProtectedRoute` component
- [ ] Update routing in `App.tsx`
- [ ] Configure Vite proxy for development
- [ ] Test login flow end-to-end
- [ ] Test session persistence
- [ ] Test logout flow

---

## 11. Next Steps (Week 2+)

After Week 1 authentication is working:

1. **Instance Management Integration** - Connect to tenant-manager API
2. **User Profile Page** - Display and edit user info
3. **Multi-tenant Support** - Instance CRUD operations
4. **Error Handling** - Better error messages and recovery
5. **Loading States** - Improve UX during async operations

---

## API Reference

### LiumaAuth Methods

```typescript
// Initialize
const auth = new LiumaAuth(config);

// Login
await auth.login('google'); // or 'github', 'microsoft', 'wechat', 'email'

// Handle callback
const session = await auth.handleCallback(code);

// Get session
const session = await auth.getSession();

// Get user
const user = await auth.getUser();

// Logout
await auth.logout();

// Refresh token
const newToken = await auth.refreshToken();

// Check auth status
const isAuth = await auth.isAuthenticated();

// Get HTTP client for API calls
const http = auth.getHTTPClient();
```

### Session Object

```typescript
interface Session {
  user: User;
  token: string;
  expiresAt: string;
}
```

### User Object

```typescript
interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'admin' | 'editor' | 'user';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Troubleshooting

### Issue: CORS errors during development

**Solution:** Vite proxy is configured in `vite.config.ts`. Make sure the proxy is correctly forwarding requests to `https://auth.liuma.app`.

### Issue: Callback not working

**Check:**
1. `redirectUri` in SDK config matches your callback URL exactly
2. Callback page is at `/auth/callback` in your routes
3. Code parameter is being extracted from URL params

### Issue: Session not persisting

**Check:**
1. Browser has cookies/localStorage enabled
2. SDK is initialized with correct `storagePrefix`
3. Check browser dev tools for storage values

### Issue: Token expires too quickly

**Note:** Better Auth sessions expire after 7 days. If experiencing earlier expiration, check:
1. Server-side session configuration
2. Token refresh logic is working
3. Auto-refresh interval is set up
