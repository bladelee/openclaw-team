'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';

// Type-safe icon wrappers
const Loader2Icon = LucideIcons.Loader2 as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const ChromeIcon = LucideIcons.Chrome as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const GithubIcon = LucideIcons.Github as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const RocketIcon = LucideIcons.Rocket as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const ShieldIcon = LucideIcons.Shield as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const MessageCircleIcon = LucideIcons.MessageCircle as React.ComponentType<React.SVGProps<SVGSVGElement>>;

const CASDOOR_ENABLED = process.env.NEXT_PUBLIC_CASDOOR_ENABLED === 'true';
const CASDOOR_ENDPOINT = process.env.NEXT_PUBLIC_CASDOOR_ENDPOINT || 'http://localhost:8000';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithOAuth, loginWithDevMode } = useAuth();
  const { isAuthenticated, setAuth } = useAuthStore();

  // 检查 URL 中的 token（从 Casdoor 回调）
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const urlError = searchParams.get('error');

    if (urlError) {
      setError(urlError);
      // 清除 URL 中的错误参数
      router.replace('/login');
      return;
    }

    if (token) {
      // 解析 JWT 获取用户信息
      try {
        const payload = parseJwt(token);
        setAuth(
          { userId: payload.userId, email: payload.email },
          token
        );
        router.push('/dashboard');
      } catch (err) {
        setError('Failed to parse token');
      }
    }
  }, [searchParams, router, setAuth]);

  // 如果已登录，跳转到仪表板
  if (isAuthenticated) {
    router.push('/dashboard');
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [devUserId, setDevUserId] = useState('test-user-' + Math.random().toString(36).substring(7));
  const [devEmail, setDevEmail] = useState('dev@example.com');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      await loginWithDevMode(devUserId, devEmail);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '开发登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCasdoorLogin = () => {
    // 跳转到后端的 Casdoor 登录入口
    const redirectUrl = encodeURIComponent(window.location.origin + '/dashboard');
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    window.location.href = `${backendUrl}/api/auth/casdoor/login?redirect=${redirectUrl}`;
  };

  const handleOAuthLogin = (provider: 'google' | 'github' | 'wechat') => {
    // 使用 Liuma Auth SDK 进行 OAuth 登录
    // 这会重定向到 Liuma 认证中心
    loginWithOAuth(provider);
  };

  // 简单的 JWT 解析函数
  function parseJwt(token: string) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录 OpenClaw Cloud</CardTitle>
          <CardDescription>选择登录方式继续</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="liuma" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="liuma">Liuma</TabsTrigger>
              <TabsTrigger value="casdoor">SSO</TabsTrigger>
              <TabsTrigger value="dev">开发</TabsTrigger>
              <TabsTrigger value="password">密码</TabsTrigger>
            </TabsList>

            {/* Liuma OAuth 登录 (主要登录方式) */}
            <TabsContent value="liuma" className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  使用 Liuma 统一认证中心登录，支持 Google、GitHub 等多种方式。
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-3"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={isLoading}
                >
                  <ChromeIcon className="mr-2 h-4 w-4" />
                  使用 Google 登录
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-3"
                  onClick={() => handleOAuthLogin('github')}
                  disabled={isLoading}
                >
                  <GithubIcon className="mr-2 h-4 w-4" />
                  使用 GitHub 登录
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthLogin('wechat')}
                  disabled={isLoading}
                >
                  <MessageCircleIcon className="mr-2 h-4 w-4" />
                  使用微信登录
                </Button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Liuma 统一认证:</p>
                <ul className="space-y-1">
                  <li>• 支持 Google、GitHub、Microsoft、微信登录</li>
                  <li>• 跨应用单点登录 (SSO)</li>
                  <li>• 自动 Token 管理</li>
                </ul>
              </div>
            </TabsContent>

            {/* Casdoor SSO 登录 */}
            <TabsContent value="casdoor" className="space-y-4">
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={handleCasdoorLogin}
                disabled={isLoading || !CASDOOR_ENABLED}
              >
                <ShieldIcon className="mr-2 h-4 w-4" />
                使用 Casdoor 登录
              </Button>

              {!CASDOOR_ENABLED && (
                <p className="text-xs text-center text-muted-foreground">
                  Casdoor 未启用，请配置环境变量 NEXT_PUBLIC_CASDOOR_ENABLED=true
                </p>
              )}

              <div className="bg-slate-50 dark:bg-slate-800 border rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Casdoor SSO 配置:</p>
                <ul className="space-y-1">
                  <li>• 端点: {CASDOOR_ENDPOINT}</li>
                  <li>• 组织: openclaw</li>
                  <li>• 应用: app-openclaw</li>
                </ul>
              </div>
            </TabsContent>

            {/* 开发环境快捷登录 */}
            <TabsContent value="dev" className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300">
                  <RocketIcon className="h-4 w-4" />
                  <span className="font-medium">开发环境</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                  使用 Shared Secret 快速登录，无需配置 OAuth
                </p>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="dev-user-id">用户 ID</Label>
                    <Input
                      id="dev-user-id"
                      value={devUserId}
                      onChange={(e) => setDevUserId(e.target.value)}
                      placeholder="test-user"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dev-email">邮箱</Label>
                    <Input
                      id="dev-email"
                      type="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      placeholder="dev@example.com"
                    />
                  </div>

                  <Button
                    onClick={handleDevLogin}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      '一键登录并创建实例'
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* 密码登录 */}
            <TabsContent value="password">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  注意：简化密码验证，仅用于开发测试
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <div className="px-6 pb-6">
          <p className="text-xs text-center text-muted-foreground">
            登录即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2Icon className="w-16 h-16 text-blue-600 animate-spin mb-4" />
            <p className="text-lg text-muted-foreground">加载中...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
