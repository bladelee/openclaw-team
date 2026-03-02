# OpenClaw Mobile H5 Proxy 部署指南

本文档说明如何使用 **proxy 模式**部署 OpenClaw 移动端 H5 应用。

## 核心优势

使用 proxy 模式的优势：

- ✅ **开发和生产环境代码完全一致**：无需修改任何代码
- ✅ **无需 CORS 配置**：同源访问 API
- ✅ **更好的安全性**：不暴露后端服务地址
- ✅ **简化部署**：只需配置反向代理

---

## 架构说明

```
用户浏览器
    ↓
https://h5.openclaw.com
    ↓
┌─────────────────────────────────────────────────────────┐
│              反向代理 (Nginx / Coolify)                  │
│                                                         │
│  路由规则:                                               │
│  • /api/auth/*    → Liuma Auth Center (port 3005)      │
│  • /api/*         → tenant-manager (port 3000)         │
│  • /*             → 静态文件 (H5 应用)                  │
└─────────────────────────────────────────────────────────┘
         ↓                    ↓
┌──────────────┐     ┌──────────────┐
│ Auth Center  │     │ tenant-      │
│  (认证中心)   │     │ manager      │
│  :3005       │     │  :3000       │
└──────────────┘     └──────────────┘
```

---

## 开发环境

### 1. 启动开发服务器

```bash
pnpm run app:h5:dev
```

Vite 会自动代理 API 请求到本地后端：
- `http://localhost:18795/api/auth/*` → `http://localhost:3005/api/auth/*`
- `http://localhost:18795/api/*` → `http://localhost:3000/api/*`

### 2. Vite Proxy 配置

Proxy 配置在 `vite.app-h5.config.ts` 中：

```typescript
server: {
  proxy: {
    '/api/auth': {
      target: 'http://localhost:3005',
      changeOrigin: true,
    },
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

### 3. 前端代码

**认证 SDK 配置** (`src/lib/auth.ts`):

```typescript
export const auth = new LiumaAuth({
  authCenterUrl: "",  // 使用相对路径
  appId: "openclaw-h5",
  redirectUri: `${window.location.origin}/auth/callback`,
});
```

**业务 API 调用** (`src/services/api/tenant.ts`):

```typescript
const API_BASE = "";  // 使用相对路径

// 所有 API 调用自动使用 /api 前缀
const response = await fetch(`/api/instances`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## 生产环境

### 方法 1: 使用 Nginx 部署

#### 1.1 构建静态文件

```bash
pnpm run app:h5:build
# 输出: dist/app-h5/
```

#### 1.2 上传到服务器

```bash
scp -r dist/app-h5/* user@server:/var/www/h5.openclaw.com/
```

#### 1.3 配置 Nginx

创建 `/etc/nginx/sites-available/h5.openclaw.com`:

```nginx
server {
    listen 80;
    server_name h5.openclaw.com;

    # 前端静态文件
    location / {
        root /var/www/h5.openclaw.com;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 认证 API 代理到 Liuma Auth Center
    location /api/auth/ {
        proxy_pass http://localhost:3005/api/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 业务 API 代理到 tenant-manager
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # OAuth 回调
    location /auth/callback {
        root /var/www/h5.openclaw.com;
        try_files $uri $uri/ /index.html;
    }
}
```

#### 1.4 启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/h5.openclaw.com \
            /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 1.5 配置 SSL（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d h5.openclaw.com

# 自动续期（已自动配置）
sudo certbot renew --dry-run
```

### 方法 2: 使用 Coolify 部署

#### 2.1 构建静态文件

```bash
pnpm run app:h5:build
```

#### 2.2 在 Coolify 中创建项目

1. 登录 Coolify 管理面板
2. 创建新项目 → 选择 "Static Site"
3. 连接 Git 仓库
4. 配置：
   - **Build Command**: 留空（已预构建）
   - **Publish Directory**: `dist/app-h5`
   - **Port**: 3001（或其他）

#### 2.3 配置环境变量

在 Coolify 面板中添加：

```bash
VITE_APP_ID=openclaw-h5
```

#### 2.4 配置域名和 SSL

Coolify 会自动：
- 配置 DNS
- 申请 Let's Encrypt SSL 证书
- 设置自动续期

#### 2.5 手动配置 API 代理

Coolify 默认不会配置 API 代理，需要在服务器上手动配置 Nginx：

编辑 `/etc/nginx/sites-available/coolify`:

```nginx
# 在现有的 location 之前添加

# 认证 API 代理
location /api/auth/ {
    proxy_pass http://localhost:3005/api/auth/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 业务 API 代理
location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 方法 3: 使用 Docker 部署

#### 3.1 创建 Dockerfile

```dockerfile
# multi-tenant/frontend/h5/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 构建
COPY . .
RUN pnpm run app:h5:build

# 生产镜像
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist/app-h5 /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 3.2 创建 Nginx 配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理（使用 Docker 网络中的服务名）
    location /api/auth/ {
        proxy_pass http://auth-center:3005/api/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://tenant-manager:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 3.3 Docker Compose 配置

```yaml
# docker-compose.h5.yml
version: '3.8'

services:
  # H5 前端
  h5:
    build:
      context: .
      dockerfile: Dockerfile.h5
    ports:
      - "3001:80"
    depends_on:
      - auth-center
      - tenant-manager
    networks:
      - openclaw-network
    restart: always

  # 认证中心
  auth-center:
    image: openclaw/auth-center:latest
    ports:
      - "3005:3005"
    environment:
      - DATABASE_URL=postgresql://...
    networks:
      - openclaw-network
    restart: always

  # 业务后端
  tenant-manager:
    image: openclaw/tenant-manager:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - AUTH_CENTER_URL=http://auth-center:3005
    depends_on:
      - auth-center
    networks:
      - openclaw-network
    restart: always

networks:
  openclaw-network:
    driver: bridge
```

#### 3.4 启动服务

```bash
docker-compose -f docker-compose.h5.yml up -d
```

---

## 环境变量

### 开发环境 (.env)

```bash
# 应用 ID（唯一需要的配置）
VITE_APP_ID=openclaw-h5
```

### 生产环境

**无需额外环境变量**，应用使用相对路径。

**已废弃的配置**（不再需要）：
```bash
# ❌ 以下配置已废弃
VITE_AUTH_CENTER_URL=http://localhost:3005
VITE_TENANT_MANAGER_URL=http://localhost:3000
```

---

## 验证部署

### 1. 检查静态文件

```bash
curl -I https://h5.openclaw.com
# 应该返回 200 OK
```

### 2. 检查 API 代理

```bash
# 测试认证 API（不需要认证）
curl https://h5.openclaw.com/api/auth/session

# 测试业务 API（需要认证 token）
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://h5.openclaw.com/api/instances
```

### 3. 检查 OAuth 登录

1. 访问 `https://h5.openclaw.com/login`
2. 点击 "Google 登录"
3. 应该重定向到认证中心
4. 授权后回调到 `https://h5.openclaw.com/auth/callback`
5. 自动跳转到实例列表页

### 4. 检查浏览器控制台

打开浏览器开发者工具，检查：
- ✅ 无 CORS 错误
- ✅ 无 404 错误（静态资源）
- ✅ API 请求返回正确的响应

---

## 故障排查

### 问题 1: CORS 错误

**症状**: 浏览器控制台显示 CORS 错误

```
Access to fetch at 'https://h5.openclaw.com/api/instances' 
from origin 'https://h5.openclaw.com' has been blocked by CORS policy
```

**原因**: 没有正确配置反向代理，或者 proxy_pass 路径错误

**解决**: 
1. 检查 Nginx 配置中的 `proxy_pass` 是否正确
2. 确保路径末尾包含 `/`，例如：`proxy_pass http://localhost:3000/api/;`

### 问题 2: API 404 错误

**症状**: API 请求返回 404 Not Found

**原因**: 代理路径不正确

**解决**:
1. 检查 Nginx 配置，确保 `location /api/` 和 `proxy_pass` 路径匹配
2. 确保后端服务正在运行
3. 检查后端服务日志

```bash
# 检查后端服务
curl http://localhost:3000/api/health
curl http://localhost:3005/api/health
```

### 问题 3: OAuth 回调失败

**症状**: OAuth 登录后显示 404 Not Found

**原因**: 没有配置 SPA 路由支持

**解决**: 确保配置了 `try_files $uri $uri/ /index.html;`

### 问题 4: 静态资源 404

**症状**: 页面加载但样式或脚本丢失

**原因**: Nginx 配置的 `root` 路径不正确

**解决**:
1. 检查 `root` 路径是否指向正确的目录
2. 确保文件权限正确

```bash
ls -la /var/www/h5.openclaw.com/
```

### 问题 5: HTTPS 证书问题

**症状**: 浏览器显示证书错误

**原因**: SSL 证书配置不正确

**解决**:
```bash
# 检查证书状态
sudo certbot certificates

# 重新申请证书
sudo certbot --nginx -d h5.openclaw.com --force-renewal
```

---

## 性能优化

### 1. 启用 Gzip 压缩

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript 
           text/xml application/xml application/xml+rss 
           text/javascript image/svg+xml;
```

### 2. 配置缓存

```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML 文件不缓存
location ~* \.html$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 3. HTTP/2 支持

```nginx
server {
    listen 443 ssl http2;
    server_name h5.openclaw.com;
    
    # ... 其他配置
}
```

---

## 相关文档

- [完整部署方案](/docs/design/deployment-strategies.md)
- [Liuma Auth SDK 文档](https://github.com/liuma/auth-sdk)
- [Vite Proxy 配置](https://vitejs.dev/config/server-options.html#server-proxy)
- [Nginx 反向代理](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

---

**更新日期**: 2025-02-27
**版本**: 1.0
