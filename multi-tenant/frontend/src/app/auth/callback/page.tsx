/**
 * OAuth Callback Page
 *
 * Handles OAuth callbacks from Liuma Auth Center
 * Redirects to dashboard after successful authentication
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as LucideIcons from 'lucide-react';
import { auth } from '@/lib/auth';
import { useAuthContext } from '@/contexts/AuthContext';

// Type-safe icon wrappers
const Loader2Icon = LucideIcons.Loader2 as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const CheckCircleIcon = LucideIcons.CheckCircle as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const XCircleIcon = LucideIcons.XCircle as React.ComponentType<React.SVGProps<SVGSVGElement>>;

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useAuthContext();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('处理认证回调...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code and state from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`认证失败: ${error}`);
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('缺少认证码');
          setTimeout(() => router.push('/login'), 3000);
          return;
        }

        // Handle OAuth callback
        setMessage('正在验证认证...');
        const session = await auth.handleCallback(code);

        if (session) {
          setStatus('success');
          setMessage('认证成功！正在跳转...');

          // Refresh auth context
          await refreshSession();

          // Redirect to dashboard after a short delay
          setTimeout(() => router.push('/dashboard'), 1000);
        } else {
          throw new Error('No session returned');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(
          error instanceof Error ? error.message : '认证失败，请重试'
        );
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    void handleCallback();
  }, [searchParams, router, refreshSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">认证处理</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center py-8">
          {status === 'loading' && (
            <>
              <Loader2Icon className="w-16 h-16 text-blue-600 animate-spin mb-4" />
              <p className="text-lg text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleIcon className="w-16 h-16 text-green-600 mb-4" />
              <p className="text-lg font-medium text-green-600 mb-2">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircleIcon className="w-16 h-16 text-red-600 mb-4" />
              <p className="text-lg font-medium text-red-600 mb-2">{message}</p>
              <p className="text-sm text-muted-foreground">正在返回登录页...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthCallbackPage() {
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
      <CallbackContent />
    </Suspense>
  );
}
