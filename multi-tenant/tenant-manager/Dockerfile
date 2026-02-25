# 租户管理服务 Dockerfile
FROM node:22-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml* ./

# 安装 pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建 TypeScript
RUN pnpm build

# 生产镜像
FROM node:22-alpine AS runtime

# 安装运行时依赖
RUN apk add --no-cache wget dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 从 builder 复制构建产物和依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 创建日志目录
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# 切换到非 root 用户
USER nodejs

# 使用 dumb-init 处理信号
ENTRYPOINT ["dumb-init", "--"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# 暴露端口
EXPOSE 3000 9090

# 启动服务
CMD ["node", "dist/index.js"]
