'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHosts } from '@/lib/hooks/useHosts';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Home, Activity, Cpu, HardDrive, Server } from 'lucide-react';

export default function HostsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { user: storeUser } = useAuthStore();
  const { hosts, isLoading, refresh } = useHosts();

  useEffect(() => {
    if (!isAuthenticated && !storeUser) {
      router.push('/login');
    }
  }, [isAuthenticated, storeUser, router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              OpenClaw
            </Link>
            <div>
              <h1 className="text-lg font-semibold">主机监控</h1>
              <p className="text-sm text-muted-foreground">
                查看 worker 主机状态
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <Home className="h-4 w-4 mr-2" />
              返回
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="主机总数"
            value={hosts.length.toString()}
            icon={<Server className="h-5 w-5" />}
          />
          <SummaryCard
            label="在线"
            value={hosts.filter(h => h.status === 'active').length.toString()}
            icon={<Activity className="h-5 w-5 text-green-600" />}
          />
          <SummaryCard
            label="离线"
            value={hosts.filter(h => h.status === 'down').length.toString()}
            icon={<Activity className="h-5 w-5 text-red-600" />}
          />
          <SummaryCard
            label="总租户数"
            value={hosts.reduce((sum, h) => sum + h.tenantCount, 0).toString()}
            icon={<Server className="h-5 w-5 text-blue-600" />}
          />
        </div>

        {/* Host Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hosts.map((host) => (
            <Card key={host.id}>
              <CardContent className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">{host.name}</h3>
                  </div>
                  <StatusBadge status={host.status} />
                </div>

                {/* Public URL */}
                <div className="text-sm text-muted-foreground">
                  {host.publicUrl}
                </div>

                {/* Stats */}
                {host.stats && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Cpu className="h-4 w-4" />
                        CPU
                      </div>
                      <span className="font-medium">{host.stats.cpuTotal} 核心</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <HardDrive className="h-4 w-4" />
                          内存
                        </div>
                        <span className="font-medium">
                          {host.stats.memoryUsed} / {host.stats.memoryTotal} GB
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${(host.stats.memoryUsed / host.stats.memoryTotal) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">租户数</span>
                  <span className="font-medium">{host.tenantCount}</span>
                </div>

                {/* Type */}
                <div className="text-xs text-muted-foreground">
                  类型: {host.type === 1 ? 'Docker Standalone' : 'Docker Swarm'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && hosts.length === 0 && (
          <Card className="p-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">没有可用的主机</p>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { label: '在线', variant: 'default' as const, color: 'bg-green-500' },
    down: { label: '离线', variant: 'destructive' as const, color: 'bg-red-500' },
    draining: { label: '维护中', variant: 'secondary' as const, color: 'bg-yellow-500' },
  }[status] || { label: status, variant: 'secondary' as const, color: 'bg-gray-500' };

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </Badge>
  );
}
