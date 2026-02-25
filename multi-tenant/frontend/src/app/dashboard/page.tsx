'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTenants } from '@/lib/hooks/useTenants';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Settings, LogOut, Server, ExternalLink, Trash2, Loader2, Copy, Check, Cloud, HardDrive } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { useState } from 'react';
import { ChatButton } from '@/components/chat/ChatButton';
import { ChatDrawer, useChatDrawer } from '@/components/chat/ChatDrawer';
import { instancesApi } from '@/lib/api/tenants';
import type { RegisterCustomInstanceInput } from '@/types/tenant';

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, isAuthenticated } = useAuth();
  const { setAuth, clearAuth } = useAuthStore();
  const { user: storeUser } = useAuthStore();
  const [tokenProcessed, setTokenProcessed] = useState(false);
  const { instances, tenants, isLoading, error, refresh, restartTenant, deleteTenant, createTenant } = useTenants();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState<RegisterCustomInstanceInput>({
    name: '',
    instanceType: 'cloud',
    url: '',
    ip: '',
    port: 18789,
    apiToken: '',
    healthCheckUrl: '',
    healthCheckInterval: 60,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ urlValid: boolean; apiAccessible: boolean; healthCheck: boolean } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{ ip: string; name: string; type: string }>>([]);

  // 处理 Casdoor 回调的 token 参数
  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      console.error('Authentication error:', error);
      router.push('/login');
      return;
    }

    if (token) {
      try {
        // 解析 JWT 获取用户信息
        const payload = parseJwt(token);

        // 先设置到 localStorage，确保 API 拦截器能立即获取
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify({ userId: payload.userId, email: payload.email || '' }));

        // 然后更新 Zustand store
        setAuth(
          { userId: payload.userId, email: payload.email || '' },
          token
        );

        // 存储 refreshToken
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

        console.log('[Dashboard] Token stored, isAuthenticated should be true now');

        // 标记 token 已处理
        setTokenProcessed(true);

        // 清除 URL 中的 token 参数
        router.replace('/dashboard');
      } catch (err) {
        console.error('Failed to parse token:', err);
        router.push('/login');
      }
    } else {
      // 没有 URL token 参数，检查是否已从 localStorage 恢复认证状态
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setTokenProcessed(true);
      }
    }
  }, [searchParams, router, setAuth]);

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated && tokenProcessed) {
      console.log('[Dashboard] Not authenticated after token processing, redirecting to login');
      router.push('/login');
    }
  }, [isAuthenticated, tokenProcessed, router]);

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

  // Chat drawer state
  const [chatState, setChatState] = useState<{ url: string; name: string } | null>(null);

  const openChat = (url: string, name: string) => {
    setChatState({ url, name });
  };

  const closeChat = () => {
    setChatState(null);
  };

  // 检查认证
  useEffect(() => {
    if (!isAuthenticated && !storeUser) {
      router.push('/login');
    }
  }, [isAuthenticated, storeUser, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleCreateTenant = async () => {
    const email = storeUser?.email || localStorage.getItem('userEmail') || 'user@example.com';

    try {
      // 使用 JWT 认证创建实例（通过 useTenants 的 createTenant 函数）
      await createTenant({ email, plan: 'basic' });
      refresh();
      setShowCreateModal(false);
    } catch (err) {
      alert('创建失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!confirm('确定要删除这个实例吗？此操作不可撤销。')) return;

    try {
      await deleteTenant(instanceId);
      refresh();
    } catch (err) {
      alert('删除失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleRestart = async (instanceId: string) => {
    try {
      await restartTenant(instanceId);
      refresh();
    } catch (err) {
      alert('重启失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleValidateCustom = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await instancesApi.validateCustom({
        instanceType: customForm.instanceType,
        url: customForm.instanceType === 'cloud' ? customForm.url : undefined,
        ip: customForm.instanceType === 'hardware' ? customForm.ip : undefined,
        port: customForm.port,
        apiToken: customForm.apiToken,
        healthCheckUrl: customForm.healthCheckUrl || undefined,
      });
      setValidationResult(result);
    } catch (err) {
      alert('验证失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleRegisterCustom = async () => {
    try {
      // Only send relevant fields based on instance type
      const payload: RegisterCustomInstanceInput = {
        name: customForm.name,
        instanceType: customForm.instanceType,
        url: customForm.instanceType === 'cloud' ? customForm.url : undefined,
        ip: customForm.instanceType === 'hardware' ? customForm.ip : undefined,
        port: customForm.port,
        apiToken: customForm.apiToken || undefined,
        healthCheckUrl: customForm.healthCheckUrl || undefined,
        healthCheckInterval: customForm.healthCheckInterval,
      };

      await instancesApi.registerCustom(payload);
      refresh();
      setShowCustomModal(false);
      setCustomForm({
        name: '',
        instanceType: 'cloud',
        url: '',
        ip: '',
        port: 18789,
        apiToken: '',
        healthCheckUrl: '',
        healthCheckInterval: 60,
      });
      setValidationResult(null);
      setScanResults([]);
    } catch (err) {
      alert('注册失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleScanLocal = async () => {
    setIsScanning(true);
    setScanResults([]);
    try {
      const result = await instancesApi.scanLocalNetwork('192.168.1', 18789);
      setScanResults(result.devices);
    } catch (err) {
      alert('扫描失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDevice = (device: { ip: string; name: string; type: string }) => {
    setCustomForm({
      ...customForm,
      name: device.name,
      instanceType: 'hardware',
      ip: device.ip,
      port: 18789,
    });
  };

  if (!isAuthenticated && !storeUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const displayUser = user || storeUser;
  // 使用 instances 或 tenants（兼容）
  const instanceList = instances.length > 0 ? instances : tenants;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              OpenClaw
            </Link>
            <div>
              <h1 className="text-lg font-semibold">控制台</h1>
              <p className="text-sm text-muted-foreground">
                {displayUser?.email || '用户'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => router.push('/hosts')}>
              <Server className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">我的 OpenClaw 实例</h2>
            <p className="text-muted-foreground">
              {instanceList.length > 0 ? `${instanceList.length} 个实例` : '创建您的第一个实例'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCustomModal(true)}>
              <Cloud className="mr-2 h-4 w-4" />
              接入实例
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              创建新实例
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && instanceList.length === 0 && (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">还没有 OpenClaw 实例</h3>
              <p className="text-muted-foreground mb-4">
                创建您的第一个实例，开始使用 AI 助手
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                创建第一个实例
              </Button>
            </div>
          </Card>
        )}

        {/* Instance List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instanceList.map((t: any) => (
            <Card key={t.instanceId || t.tenantId} className="overflow-hidden">
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold truncate" title={t.name || t.instanceId || t.tenantId}>
                        {t.name || t.instanceId || t.tenantId}
                      </h3>
                      {t.source === 'hardware' && (
                        <Badge variant="outline" className="text-xs">
                          <HardDrive className="h-3 w-3 mr-1" />
                          硬件
                        </Badge>
                      )}
                      {t.source === 'custom' && (
                        <Badge variant="outline" className="text-xs">
                          <Cloud className="h-3 w-3 mr-1" />
                          自定义
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t.source === 'managed' ? `计划: ${t.plan}` : t.source === 'hardware' ? '硬件盒子' : '云端实例'}
                    </p>
                  </div>
                  <StatusBadge status={t.status} isHealthy={t.isHealthy} />
                </div>

                {/* URL / IP */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {t.source === 'hardware' ? 'IP 地址' : '访问地址'}
                  </p>
                  <p className="text-sm font-medium truncate">
                    {t.source === 'hardware' && t.customUrl
                      ? t.customUrl.replace(/^https?:\/\//, '')
                      : t.url}
                  </p>
                </div>

                {/* Container Info */}
                {t.containerId && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">容器 ID</p>
                        <p className="text-xs font-mono truncate">{t.containerId}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(t.containerId, t.containerId)}
                      >
                        {copiedId === t.containerId ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>创建于 {formatRelativeTime(t.createdAt)}</span>
                  {t.host && <span>{t.host}</span>}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <ChatButton onClick={() => openChat(t.url, t.name || t.instanceId || t.tenantId)} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(t.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    打开
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestart(t.instanceId || t.tenantId)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(t.instanceId || t.tenantId)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">创建新的 OpenClaw 实例</h3>
              <p className="text-sm text-muted-foreground mb-4">
                确认创建一个新的 OpenClaw 实例？
              </p>
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4">
                <p className="text-sm">
                  <strong>计划:</strong> basic (1 CPU, 1GB 内存, 3 个沙盒)
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  实例名称将自动生成（如: dev-abc123）
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateTenant}>
                  确认创建
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Custom Instance Registration Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="max-w-lg w-full">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">接入自定义实例</h3>
              <p className="text-sm text-muted-foreground">
                接入已有的 OpenClaw 实例或本地硬件盒子
              </p>

              {/* Instance Name */}
              <div>
                <label className="text-sm font-medium">实例名称 *</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="my-instance"
                  value={customForm.name}
                  onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                />
              </div>

              {/* Instance Type */}
              <div>
                <label className="text-sm font-medium">实例类型 *</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="instanceType"
                      checked={customForm.instanceType === 'cloud'}
                      onChange={() => setCustomForm({ ...customForm, instanceType: 'cloud' })}
                    />
                    <Cloud className="h-4 w-4" />
                    <span>云端实例</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="instanceType"
                      checked={customForm.instanceType === 'hardware'}
                      onChange={() => setCustomForm({ ...customForm, instanceType: 'hardware' })}
                    />
                    <HardDrive className="h-4 w-4" />
                    <span>硬件盒子</span>
                  </label>
                </div>
              </div>

              {/* Hardware: Scan Button */}
              {customForm.instanceType === 'hardware' && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleScanLocal}
                    disabled={isScanning}
                  >
                    {isScanning ? '扫描中...' : '扫描局域网'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    发现本地网络中的 OpenClaw 硬件盒子
                  </span>
                </div>
              )}

              {/* Scan Results */}
              {scanResults.length > 0 && (
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium mb-2">发现 {scanResults.length} 个设备:</p>
                  <div className="space-y-1">
                    {scanResults.map((device, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-full text-left text-xs p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        onClick={() => handleSelectDevice(device)}
                      >
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-3 w-3" />
                          <span>{device.ip}</span>
                          <span className="text-muted-foreground">- {device.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* URL or IP */}
              {customForm.instanceType === 'cloud' ? (
                <div>
                  <label className="text-sm font-medium">访问地址 *</label>
                  <input
                    type="url"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="https://my-claw.example.com"
                    value={customForm.url}
                    onChange={(e) => setCustomForm({ ...customForm, url: e.target.value })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">IP 地址 *</label>
                    <input
                      type="text"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      placeholder="192.168.1.100"
                      value={customForm.ip}
                      onChange={(e) => setCustomForm({ ...customForm, ip: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">端口</label>
                    <input
                      type="number"
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                      placeholder="18789"
                      value={customForm.port}
                      onChange={(e) => setCustomForm({ ...customForm, port: parseInt(e.target.value) || 18789 })}
                    />
                  </div>
                </div>
              )}

              {/* API Token (Optional) */}
              <div>
                <label className="text-sm font-medium">API Token (可选)</label>
                <input
                  type="password"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="用于 API 认证"
                  value={customForm.apiToken}
                  onChange={(e) => setCustomForm({ ...customForm, apiToken: e.target.value })}
                />
              </div>

              {/* Health Check URL (Optional) */}
              <div>
                <label className="text-sm font-medium">健康检查端点 (可选)</label>
                <input
                  type="url"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="/health 或 https://example.com/health"
                  value={customForm.healthCheckUrl}
                  onChange={(e) => setCustomForm({ ...customForm, healthCheckUrl: e.target.value })}
                />
              </div>

              {/* Validation Result */}
              {validationResult && (
                <div className={`p-3 rounded-lg ${validationResult.urlValid && validationResult.healthCheck ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'}`}>
                  <p className="text-sm font-medium">验证结果:</p>
                  <ul className="text-xs mt-1 space-y-1">
                    <li>URL 可访问: {validationResult.urlValid ? '✓' : '✗'}</li>
                    <li>API 可用: {validationResult.apiAccessible ? '✓' : '✗'}</li>
                    <li>健康检查: {validationResult.healthCheck ? '✓' : '✗'}</li>
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-between pt-2">
                <Button variant="outline" onClick={() => {
                  setShowCustomModal(false);
                  setValidationResult(null);
                }}>
                  取消
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleValidateCustom}
                    disabled={isValidating || !customForm.name || (customForm.instanceType === 'cloud' ? !customForm.url : !customForm.ip)}
                  >
                    {isValidating ? '验证中...' : '验证连接'}
                  </Button>
                  <Button
                    onClick={handleRegisterCustom}
                    disabled={!customForm.name || (customForm.instanceType === 'cloud' ? !customForm.url : !customForm.ip)}
                  >
                    接入
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                接入后您可以在控制台统一管理您的实例
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Chat Drawer */}
      {chatState && (
        <ChatDrawer
          instanceUrl={chatState.url}
          instanceName={chatState.name}
          open={!!chatState}
          onOpenChange={(open) => !open && closeChat()}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, isHealthy }: { status: string; isHealthy?: boolean | null }) {
  // For custom/hardware instances, use health check status
  const displayStatus = isHealthy !== undefined ? (isHealthy ? 'running' : 'stopped') : status;

  const config = {
    running: { label: isHealthy !== undefined ? (isHealthy ? '在线' : '离线') : '运行中', color: 'bg-green-500' },
    stopped: { label: isHealthy !== undefined ? '离线' : '已停止', color: isHealthy === false ? 'bg-red-500' : 'bg-gray-500' },
    creating: { label: '创建中', color: 'bg-blue-500' },
    error: { label: '错误', color: 'bg-red-500' },
  }[displayStatus] || { label: displayStatus, color: 'bg-gray-500' };

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </Badge>
  );
}
