# OpenClaw 多租户管理系统

基于 Portainer 的 OpenClaw 多租户管理服务，支持用户通过 OAuth 2.0 SSO 登录后创建自己的 OpenClaw 实例。

## 架构

```
用户浏览器
    │
    ▼
Nginx (动态路由)
    │
    ▼
租户管理 API (Node.js)
    │
    ▼
Portainer (Docker 管理)
    │
    ▼
Worker 主机池 (运行租户容器)
```

## 功能

- ✅ 多租户隔离
- ✅ 自动主机调度
- ✅ 动态资源分配
- ✅ 容器生命周期管理
- ✅ RESTful API
- ✅ JWT 认证
- ✅ OAuth 2.0 集成
- ✅ Prometheus 指标

## 快速开始

### 1. 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 22+
- PostgreSQL 14+

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的环境变量
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f tenant-manager
```

### 4. 访问服务

- **Portainer**: http://localhost:9443
- **租户管理 API**: http://localhost:3000/api
- **健康检查**: http://localhost:3000/api/health

## API 文档

### 创建租户

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "plan": "basic"
  }'
```

### 获取租户信息

```bash
curl http://localhost:3000/api/tenants/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 删除租户

```bash
curl -X DELETE http://localhost:3000/api/tenants/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 添加 Worker 主机

### 使用 Portainer Agent

```bash
# 在 worker 主机上运行
docker run -d \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/lib/docker/volumes:/var/lib/docker/volumes \
  -p 9001:9001 \
  --name portainer-agent \
  --restart=unless-stopped \
  portainer/agent:latest
```

然后在 Portainer UI 中添加环境。

## 开发

### 安装依赖

```bash
cd tenant-manager
pnpm install
```

### 运行开发服务器

```bash
pnpm dev
```

### 运行测试

```bash
# 单元测试
pnpm test

# 覆盖率报告
pnpm test:coverage

# E2E 测试
cd ../..
npx playwright test
```

### 构建

```bash
pnpm build
```

## 配额

| 套餐 | CPU | 内存 | 存储 | 沙盒数 |
|------|-----|------|------|--------|
| Free | 0.5核 | 512MB | 5GB | 1 |
| Basic | 1核 | 1GB | 20GB | 3 |
| Pro | 2核 | 2GB | 50GB | 10 |
| Enterprise | 4核 | 4GB | 200GB | 无限 |

## 监控

- **Prometheus 指标**: http://localhost:9090/metrics
- **健康检查**: http://localhost:3000/api/health
- **主机状态**: http://localhost:3000/api/hosts

## 故障排查

### 检查服务状态

```bash
docker-compose ps
docker-compose logs tenant-manager
```

### 检查数据库连接

```bash
docker-compose exec postgres psql -U openclaw -d openclaw -c "SELECT COUNT(*) FROM tenants;"
```

### 重启服务

```bash
docker-compose restart tenant-manager
```

## 生产部署

详见部署文档: `/docs/guides/CLOUD_MULTI_TENANT_DEPLOYMENT_CN.md`
