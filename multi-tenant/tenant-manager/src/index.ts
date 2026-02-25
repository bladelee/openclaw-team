// 主应用入口
import express from 'express';
import { config } from './config.js';
import { logger } from './logger.js';
import { closeDatabase } from './database.js';
import routes from './routes.js';
import promClient from 'prom-client';
import cors from 'cors';

// 创建 Express 应用并配置中间件
function createApp() {
  const app = express();

  // CORS 中间件 - 允许前端访问
  app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-User-Email', 'X-User-Signature'],
  }));

  // 中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 请求日志
  app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('HTTP request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip,
      });
    });

    next();
  });

  // Prometheus metrics
  if (config.METRICS_ENABLED) {
    const httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
    });

    app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestDuration.observe(
          {
            method: req.method,
            route: req.path,
            status_code: res.statusCode,
          },
          duration
        );
      });

      next();
    });

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      res.end(await promClient.register.metrics());
    });
  }

  // 路由
  app.use('/api', routes);

  // 根路径
  app.get('/', (req, res) => {
    res.json({
      name: 'OpenClaw Tenant Manager',
      version: '1.0.0',
      description: 'Multi-tenant management service for OpenClaw with Portainer',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/*',
        tenants: '/api/tenants/*',
        hosts: '/api/hosts/*',
        internal: '/api/internal/*',
      },
    });
  });

  // 404 处理
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
    });
  });

  // 错误处理
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: config.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

// 创建应用实例
const app = createApp();

// 服务器实例（用于优雅关闭）
let server: ReturnType<typeof app.listen> | undefined;

// 启动服务器
function startServer() {
  server = app.listen(config.PORT, () => {
    logger.info('Tenant manager started', {
      port: config.PORT,
      env: config.NODE_ENV,
      portainerUrl: config.PORTAINER_URL,
    });
  });

  return server;
}

// 优雅关闭
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // 关闭数据库连接
  await closeDatabase();

  logger.info('Shutdown complete');
  process.exit(0);
}

// 信号处理
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// 未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  shutdown('unhandledRejection');
});

// 启动服务器（仅在直接执行时）
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
export { startServer };
