// 测试设置文件
import { beforeAll, afterAll } from 'vitest';
import { config } from '../src/config.js';

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 减少日志输出

// 全局测试钩子
beforeAll(async () => {
  // 可以在这里设置全局测试 fixture
});

afterAll(async () => {
  // 清理全局资源
});
