# 多阶段构建 - 生产环境优化的 Next.js Dockerfile
# 构建时传入: NEXT_PUBLIC_API_URL NEXT_PUBLIC_APP_URL 等

FROM node:22-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 复制包文件
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置构建时环境变量（生产环境）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 注意：构建时的环境变量会被硬编码到构建产物中
# 运行时环境变量需要在 docker-compose.yml 中重新设置

# 构建应用（standalone 模式）
RUN pnpm build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要的文件
COPY --from=builder /app/public ./public

# 自动复制所有构建产物和依赖
# 使用 .next/standalone 模式，Next.js 会自动优化输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# 设置正确的权限
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3002

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002 || exit 1

# 启动应用
CMD ["node", "server.js"]
