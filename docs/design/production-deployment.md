# OpenClaw 多租户平台生产环境部署方案

本文档提供使用 Docker 进行生产环境部署的完整方案。

---

## 📋 目录

- [架构概览](#架构概览)
- [前置要求](#前置要求)
- [环境准备](#环境准备)
- [配置文件](#配置文件)
- [部署步骤](#部署步骤)
- [生产环境配置](#生产环境配置)
- [监控和日志](#监控和日志)
- [备份和恢复](#备份和恢复)
- [安全加固](#安全加固)
- [故障排查](#故障排查)

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└────────────────────────────┬────────────────────────────────┘
                              │
                     ┌────────▼────────┐
                     │  Nginx (反向代理) │
                     │  Port 80/443     │
                     └────────┬────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐         ┌─────▼─────┐       ┌─────▼─────┐
    │  前端PC   │         │ Tenant    │       │  移动端H5  │
    │  Next.js │         │ Manager   │       │   Vite    │
    │  :3002   │◄──────►│  :3000    │◄─────►│  :18792   │
    └─────────┘         └────┬─────┘       └───────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐         ┌────▼─────┐       ┌─────▼─────┐
    │PostgreSQL│         │  Redis   │       │ Portainer  │
    │  :5432  │         │  :6379   │       │  :9000    │
    └─────────┘         └──────────┘       └───────────┘
```

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Nginx | 80, 443 | 反向代理、SSL终端、负载均衡 |
| PC前端 (Next.js) | 3002 | Web管理界面 |
| Tenant Manager API | 3000 | 多租户管理API |
| 移动端H5 (Vite dev server) | 18792 | 移动端H5应用 |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 缓存和会话存储 |
| Portainer | 9000 | Docker管理界面（可选） |

---

## 📦 前置要求

### 服务器要求

**最低配置:**
- CPU: 2核
- 内存: 4GB
- 磁盘: 40GB SSD

**推荐配置:**
- CPU: 4核
- 内存: 8GB
- 磁盘: 100GB SSD

### 软件要求

- 操作系统: Ubuntu 22.04+ / Debian 11+ / CentOS 8+
- Docker: 20.10+
- Docker Compose: 2.0+
- Git: 用于克隆代码

### 网络要求

- 公网IP地址
- 域名（可选，用于HTTPS）
- 开放端口: 80, 443, 3000, 3002, 18792

---

## 🔧 环境准备

### 1. 安装 Docker 和 Docker Compose

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 克隆代码

```bash
# 克隆仓库（如果还没有）
git clone https://github.com/openclaw/openclaw.git
cd openclaw/multi-tenant
```

### 3. 创建必要的目录

```bash
# 创建数据持久化目录
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/tenant
mkdir -p data/nginx/ssl
mkdir -p logs/tenant-manager
mkdir -p logs/nginx
```

---

## ⚙️ 配置文件

### 1. 环境变量配置

创建 `docker-compose.yml` 所需的 `.env` 文件：

```bash
# 生产环境变量配置
cat > .env << 'EOF'

# ==================== 数据库配置 ====================
POSTGRES_PASSWORD=$(openssl rand -hex 32)
POSTGRES_DB=openclaw
POSTGRES_USER=openclaw

# ==================== Redis 配置 ====================
REDIS_PASSWORD=$(openssl rand -hex 16)

# ==================== JWT 配置 ====================
JWT_SECRET=$(openssl rand -hex 64)

# ==================== Liuma 认证配置 ====================
# 生产环境的 Liuma 认证中心地址
NEXT_PUBLIC_LIUMA_URL=https://auth.liuma.app
VITE_AUTH_CENTER_URL=https://auth.liuma.app

# 在 Liuma 注册的应用 ID
NEXT_PUBLIC_APP_ID=openclaw-pc
VITE_APP_ID=openclaw-h5

# ==================== 应用配置 ====================
# 生产环境域名（替换为你的域名）
DOMAIN=your-domain.com

# 后端 API URL
NEXT_PUBLIC_API_URL=https://api.${DOMAIN}
NEXT_PUBLIC_BACKEND_URL=https://api.${DOMAIN}
VITE_TENANT_MANAGER_URL=https://api.${DOMAIN}

# 前端 URL
NEXT_PUBLIC_APP_URL=https://${DOMAIN}

# ==================== Portainer 配置 ====================
PORTAINER_API_KEY=your-portainer-api-key

# ==================== SSL 证书配置 ====================
# 使用 Let's Encrypt 或手动配置证书
SSL_CERT_PATH=./data/nginx/ssl
SSL_KEY_PATH=./data/nginx/ssl

# ==================== 日志配置 ====================
LOG_LEVEL=info

# ==================== 资源配额配置 ====================
QUOTA_FREE=0.5,512,5120,1
QUOTA_BASIC=1,1024,20480,3
QUOTA_PRO=2,2048,51200,10
QUOTA_ENTERPRISE=4,4096,204800,-1

EOF

# 生成随机密钥
openssl rand -hex 32 > /tmp/.postgres_pass
openssl rand -hex 16 > /tmp/.redis_pass
openssl rand -hex 64 > /tmp/.jwt_secret

echo "✅ 环境变量配置完成"
```

### 2. 前端 Dockerfile

创建 `multi-tenant/frontend/Dockerfile`：

```dockerfile
# 多阶段构建 - 生产环境优化的 Next.js Dockerfile
FROM node:22-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 复制包文件
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置构建时环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_LIUMA_URL=https://auth.liuma.app
ENV NEXT_PUBLIC_APP_ID=openclaw-pc
ENV NEXT_PUBLIC_API_URL=https://api.your-domain.com
ENV NEXT_PUBLIC_APP_URL=https://your-domain.com

# 构建应用
RUN pnpm build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 3. 更新 package.json 添加 standalone 输出

确保 `multi-tenant/frontend/package.json` 包含：

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  },
  "dependencies": { ... }
}
```

并在 `next.config.js` 中添加：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

---

## 🚀 部署步骤

### 方式1: 使用 Docker Compose（推荐）

#### 1. 更新 docker-compose.yml

使用以下完整的 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  # ==================== 数据库 ====================
  postgres:
    image: postgres:16-alpine
    container_name: openclaw-postgres
    restart: always
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    networks:
      - openclaw-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    # 生产环境性能优化
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "work_mem=4MB"

  # ==================== 缓存 ====================
  redis:
    image: redis:7-alpine
    container_name: openclaw-redis
    restart: always
    command: >
      redis-server
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    volumes:
      - ./data/redis:/data
    networks:
      - openclaw-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # ==================== 租户管理服务 ====================
  tenant-manager:
    build:
      context: ./tenant-manager
      dockerfile: Dockerfile
    image: openclaw/tenant-manager:latest
    container_name: openclaw-tenant-manager
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - PORTAINER_URL=http://portainer:9000
      - JWT_SECRET=${JWT_SECRET}
      - DEFAULT_PLAN=basic
      - DATA_DIR=/data/openclaw/tenants
      - GATEWAY_IMAGE=ghcr.io/moltbot/moltbot:latest
      - SANDBOX_IMAGE=ghcr.io/moltbot/moltbot:sandbox
      - QUOTA_FREE=${QUOTA_FREE}
      - QUOTA_BASIC=${QUOTA_BASIC}
      - QUOTA_PRO=${QUOTA_PRO}
      - QUOTA_ENTERPRISE=${QUOTA_ENTERPRISE}
      - METRICS_ENABLED=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./logs/tenant-manager:/app/logs
      - ./data/tenant:/data/openclaw/tenants
    ports:
      - "3000:3000"
      - "9090:9090"
    networks:
      - openclaw-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # ==================== PC前端 ====================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: openclaw/frontend:latest
    container_name: openclaw-frontend
    restart: always
    depends_on:
      tenant-manager:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - PORT=3002
      - NEXT_PUBLIC_API_URL=https://api.${DOMAIN}
      - NEXT_PUBLIC_BACKEND_URL=https://api.${DOMAIN}
      - NEXT_PUBLIC_APP_URL=https://${DOMAIN}
      - NEXT_PUBLIC_LIUMA_URL=${NEXT_PUBLIC_LIUMA_URL}
      - NEXT_PUBLIC_APP_ID=${NEXT_PUBLIC_APP_ID}
      - NEXT_PUBLIC_APP_URL=https://${DOMAIN}
    ports:
      - "3002:3002"
    networks:
      - openclaw-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3002"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M

  # ==================== Nginx 反向代理 ====================
  nginx:
    image: nginx:alpine
    container_name: openclaw-nginx
    restart: always
    depends_on:
      - frontend
      - tenant-manager
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./data/nginx/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
      - nginx_cache:/var/cache/nginx
    networks:
      - openclaw-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  openclaw-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  postgres_data:
  redis_data:
  tenant_manager_logs:
  tenant_data:
  nginx_cache:
```

#### 2. 配置 Nginx

创建 `multi-tenant/nginx/nginx.conf`：

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # 性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # 上游服务器
    upstream frontend {
        server frontend:3002;
        keepalive 32;
    }

    upstream api {
        server tenant-manager:3000;
        keepalive 32;
    }

    upstream mobile {
        # 移动端如果有独立部署
        server tenant-manager:3000;
        keepalive 32;
    }

    # 限流配置
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;

    # HTTP 重定向到 HTTPS
    server {
        listen 80;
        server_name _;

        # Let's Encrypt ACME Challenge
        location /.well-known/acme-challenge/ {
            root /var/www/html;
        }

        # 重定向到 HTTPS
        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS 服务器
    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        # SSL 证书配置
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # 安全头
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # PC 前端
        location / {
            limit_req zone=login burst=10 nodelay;
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Next.js 静态资源
        location /_next/static {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_valid 200 60m;
            add_header Cache-Control "public, immutable";
        }

        # API 路由
        location /api/ {
            limit_req zone=api burst=50 nodelay;
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            chunked_transfer_encoding off;
        }

        # 健康检查
        location /health {
            access_log off;
            return 200 "OK";
            add_header Content-Type text/plain;
        }
    }
}
```

#### 3. 构建和启动服务

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 方式2: Docker Swarm 集群部署（可选，适合高可用）

```bash
# 初始化 Swarm
docker swarm init

# 部署 stack
docker stack deploy -c docker-compose.yml openclaw

# 查看服务状态
docker service ls
```

---

## 🔐 生产环境配置

### 1. SSL 证书配置

#### 使用 Let's Encrypt (推荐)

```bash
# 安装 certbot
sudo apt install certbot

# 生成证书（HTTP方式）
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# 证书位置
ls /etc/letsencrypt/live/your-domain.com/

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem data/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem data/nginx/ssl/key.pem

# 设置自动续期
sudo certbot renew --dry-run
```

#### 自动续期配置

```bash
# 添加续期任务到 crontab
sudo crontab -e

# 添加以下行（每天凌晨2点检查续期）
0 2 * * * certbot renew --quiet --post-hook "docker-compose -f /path/to/docker-compose.yml restart nginx"
```

### 2. Liuma OAuth 应用配置

#### 在 Liuma 认证中心注册应用

1. 访问 https://auth.liuma.app
2. 注册并登录
3. 创建新应用:

**PC端应用:**
- 应用ID: `openclaw-pc`
- 应用类型: Web Application
- 回调URL: `https://your-domain.com/auth/callback`
- 允许的OAuth: Google, GitHub, 微信

**移动端应用:**
- 应用ID: `openclaw-h5`
- 应用类型: Web Application
- 回调URL: `https://your-domain.com/auth/callback`
- 允许的OAuth: Google, GitHub, 微信

#### 更新环境变量

```bash
# 更新 .env 文件
cat >> .env << 'EOF'

# Liuma 应用配置
NEXT_PUBLIC_LIUMA_URL=https://auth.liuma.app
NEXT_PUBLIC_APP_ID=openclaw-pc
VITE_AUTH_CENTER_URL=https://auth.liuma.app
VITE_APP_ID=openclaw-h5
EOF
```

### 3. 数据库优化

#### PostgreSQL 优化

```bash
# 进入 postgres 容器
docker exec -it openclaw-postgres psql -U openclaw

# 创建优化配置
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

# 重启配置
SELECT pg_reload_conf();
```

#### 定期备份

```bash
# 创建备份脚本
cat > /usr/local/bin/backup-openclaw.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/openclaw"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
docker exec openclaw-postgres pg_dump -U openclaw openclaw | gzip > $BACKUP_DIR/openclaw_db_$DATE.sql.gz

# 备份配置文件
tar -czf $BACKUP_DIR/config_$DATE.tar.gz .env docker-compose.yml nginx/

# 保留最近7天的备份
find $BACKUP_DIR -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-openclaw.sh

# 添加到 crontab（每天凌晨3点备份）
echo "0 3 * * * /usr/local/bin/backup-openclaw.sh" | crontab -
```

---

## 📊 监控和日志

### 1. 日志收集

```bash
# 查看服务日志
docker-compose logs -f tenant-manager
docker-compose logs -f frontend
docker-compose logs -f nginx

# 持久化日志
docker-compose logs -f tenant-manager >> logs/tenant-manager/production.log &
```

### 2. 指标收集

Prometheus 配置已启用（端口 9090），可以配置 Prometheus + Grafana：

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'tenant-manager'
    static_configs:
      - targets: ['tenant-manager:9090']
```

### 3. 健康检查

```bash
# 后端健康检查
curl https://api.your-domain.com/api/health

# 前端健康检查
curl https://your-domain.com/

# 容器健康状态
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## 💾 备份和恢复

### 备份策略

#### 数据库备份

```bash
# 手动备份
docker exec openclaw-postgres pg_dump -U openclaw openclaw | gzip > backup_$(date +%Y%m%d).sql.gz

# 自动备份（已配置）
ls -lh /backup/openclaw/
```

#### 配置备份

```bash
# 备份环境配置
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env docker-compose.yml nginx/

# 备份 Nginx 配置
tar -czf nginx_backup_$(date +%Y%m%d).tar.gz nginx/
```

### 恢复流程

```bash
# 1. 恢复数据库
gunzip < backup_20250127.sql.gz | docker exec -i openclaw-postgres psql -U openclaw openclaw

# 2. 恢复配置
tar -xzf config_backup_20250127.tar.gz

# 3. 重启服务
docker-compose down
docker-compose up -d
```

---

## 🔒 安全加固

### 1. 防火墙配置

```bash
# 配置 UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. fail2ban 入侵防护

```bash
# 安装 fail2ban
sudo apt install fail2ban

# 配置 Nginx 保护
cat > /etc/fail2ban/jail.local << 'EOF'
[nginx-http-auth]
enabled = true
port = http,8080
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
findtime = 600
bantime = 3600
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. 安全扫描

```bash
# 扫描镜像漏洞
docker scan openclaw/tenant-manager:latest
docker scan openclaw/frontend:latest
```

---

## 🔧 故障排查

### 常见问题

#### 1. 容器无法启动

```bash
# 查看日志
docker-compose logs tenant-manager

# 检查配置
docker-compose config

# 重启服务
docker-compose restart tenant-manager
```

#### 2. 数据库连接失败

```bash
# 检查数据库状态
docker exec openclaw-postgres pg_isready -U openclaw

# 检查网络连接
docker network inspect openclaw_openclaw-network

# 查看数据库日志
docker logs openclaw-postgres
```

#### 3. Nginx 502 错误

```bash
# 检查后端服务
docker-compose ps

# 检查 upstream 配置
docker exec openclaw-nginx nginx -t

# 查看错误日志
docker-compose logs nginx | tail -100
```

#### 4. OAuth 登录失败

```bash
# 检查环境变量
docker-compose exec frontend env | grep LIUMA

# 验证回调URL配置
curl https://auth.liuma.app/apps

# 查看浏览器控制台错误
```

---

## 📋 部署检查清单

- [ ] 服务器资源满足要求
- [ ] Docker 和 Docker Compose 已安装
- [ ] 代码已克隆到服务器
- [ ] 环境变量已配置 (.env)
- [ ] Nginx 配置已更新（域名、SSL）
- [ ] SSL 证书已配置
- [ ] Liuma OAuth 应用已注册
- [ ] 防火墙已配置
- [ ] 数据库备份已设置
- [ ] 日志持久化已配置
- [ ] 健康检查端点可访问
- [ ] 服务已启动并运行正常
- [ ] OAuth 登录流程已测试

---

## 🚀 快速部署脚本

```bash
#!/bin/bash
set -e

echo "=== OpenClaw 生产环境部署 ==="

# 1. 检查环境
echo "检查 Docker..."
docker --version || { echo "Docker 未安装"; exit 1; }
docker-compose --version || { echo "Docker Compose 未安装"; exit 1; }

# 2. 配置环境变量
echo "配置环境变量..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "请编辑 .env 文件配置生产环境变量"
    exit 1
fi

# 3. 创建必要目录
echo "创建数据目录..."
mkdir -p data/{postgres,redis,tenant,nginx/ssl}
mkdir -p logs/{tenant-manager,nginx}

# 4. 配置 SSL
echo "配置 SSL 证书..."
if [ ! -f data/nginx/ssl/cert.pem ]; then
    echo "请配置 SSL 证书或使用 Let's Encrypt"
    exit 1
fi

# 5. 构建镜像
echo "构建 Docker 镜像..."
docker-compose build

# 6. 启动服务
echo "启动服务..."
docker-compose up -d

# 7. 等待服务健康
echo "等待服务启动..."
sleep 30

# 8. 健康检查
echo "健康检查..."
curl -f http://localhost:3000/api/health || { echo "后端服务异常"; exit 1; }
curl -f http://localhost:3002 || { echo "前端服务异常"; exit 1; }

echo "=== 部署完成 ==="
echo "访问地址: https://your-domain.com"
```

---

## 📚 相关文档

- [集成测试与Liuma配置](./integration-test-and-liuma-config.md)
- [多租户架构设计](./multi-tenant/FEATURE_DESIGN.md)
- [部署指南](./multi-tenant/END_USER_READINESS.md)

---

**文档版本**: 1.0
**更新日期**: 2025-02-27
**维护者**: OpenClaw Team
