import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Server, Zap, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl mb-6">
          OpenClaw <span className="text-blue-600">Cloud</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          私有的 AI 助手云平台。一键创建您的专属 OpenClaw 实例，
          完全隔离，安全可控。
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/login">立即开始</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">进入仪表板</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Server className="h-8 w-8" />}
            title="一键部署"
            description="自动选择最佳主机，快速创建您的 OpenClaw 实例"
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="完全隔离"
            description="每个租户独立容器运行，资源隔离，数据安全"
          />
          <FeatureCard
            icon={<Users className="h-8 w-8" />}
            title="多租户支持"
            description="支持多个实例同时运行，灵活管理"
          />
        </div>
      </section>

      {/* Quick Links */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>主机监控</CardTitle>
              <CardDescription>查看所有 worker 主机的状态和资源使用情况</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/hosts">查看主机</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>API 文档</CardTitle>
              <CardDescription>了解如何使用租户管理 API</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/api/auth/sso-info" target="_blank">查看 API</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
