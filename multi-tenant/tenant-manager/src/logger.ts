// 日志模块
import winston from 'winston';
import { config } from './config.js';

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台格式（开发环境）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      if (meta.stack) {
        msg += `\n${meta.stack}`;
      } else {
        msg += ` ${JSON.stringify(meta)}`;
      }
    }
    return msg;
  })
);

// 创建 logger
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: config.NODE_ENV === 'development' ? consoleFormat : logFormat,
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  // 处理未处理的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// 开发环境额外配置
if (config.NODE_ENV === 'development') {
  logger.debug('Logging initialized at debug level');
}

// 子 logger 工厂函数
export function createChildLogger(module: string) {
  return logger.child({ module });
}
