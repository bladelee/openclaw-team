// 配置管理
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// 资源配额 schema
const quotaSchema = z.object({
  cpu: z.number(),
  memory: z.number(),
  storage: z.number(),
  sandboxes: z.number(),
});

// 租户计划 schema
const planSchema = z.enum(['free', 'basic', 'pro', 'enterprise']);

// 环境变量 schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.string().default('3000').transform(v => parseInt(v, 10)),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.string().default('2').transform(v => parseInt(v, 10)),
  DATABASE_POOL_MAX: z.string().default('10').transform(v => parseInt(v, 10)),

  PORTAINER_URL: z.string().url(),
  PORTAINER_API_KEY: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

  OAUTH_ENABLED: z.string().transform(v => v === 'true').default('false'),
  OAUTH_ISSUER: z.literal('').or(z.string().url()).optional(),
  OAUTH_AUDIENCE: z.string().optional(),

  DEFAULT_PLAN: planSchema.default('basic'),
  DATA_DIR: z.string().default('/data/openclaw/tenants'),

  GATEWAY_IMAGE: z.string().default('ghcr.io/moltbot/moltbot:latest'),
  SANDBOX_IMAGE: z.string().default('ghcr.io/moltbot/moltbot:sandbox'),

  QUOTA_FREE: z.string().default('0.5,512,5120,1'),
  QUOTA_BASIC: z.string().default('1,1024,20480,3'),
  QUOTA_PRO: z.string().default('2,2048,51200,10'),
  QUOTA_ENTERPRISE: z.string().default('4,4096,204800,-1'),

  METRICS_ENABLED: z.string().transform(v => v === 'true').default('true'),
  METRICS_PORT: z.string().default('9090').transform(v => parseInt(v, 10)),

  ALERT_ENABLED: z.string().transform(v => v === 'true').default('false'),
  ALERT_WEBHOOK_URL: z.literal('').or(z.string().url()).optional(),
  ALERT_CPU_THRESHOLD: z.string().default('90').transform(v => parseInt(v, 10)),
  ALERT_MEMORY_THRESHOLD: z.string().default('90').transform(v => parseInt(v, 10)),

  // Shared secret for SSO integration
  SHARED_SECRET_KEY: z.string().min(32).default('dev-secret-change-in-production'),
  SIGNATURE_TOLERANCE: z.string().default('300').transform(v => parseInt(v, 10)), // 5 minutes

  // Casdoor SSO Configuration
  CASDOOR_ENABLED: z.string().transform(v => v === 'true').default('false'),
  CASDOOR_ENDPOINT: z.string().url().optional(),
  CASDOOR_CLIENT_ID: z.string().optional(),
  CASDOOR_CLIENT_SECRET: z.string().optional(),
  CASDOOR_ORGANIZATION: z.string().optional(),
  CASDOOR_APPLICATION: z.string().optional(),
  CASDOOR_REDIRECT_URI: z.string().url().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3001'),

  // Instance URL configuration
  INSTANCE_BASE_DOMAIN: z.string().default('openclaw.app'),
  INSTANCE_URL_FORMAT: z.string().default('{name}.{baseDomain}'),
  INSTANCE_URL_SCHEME: z.string().default('https'),
});

// 解析配额字符串 "cpu,memory,storage,sandboxes"
function parseQuotaString(quotaStr: string) {
  const [cpu, memory, storage, sandboxes] = quotaStr.split(',').map(Number);
  return { cpu, memory, storage, sandboxes };
}

// 导出配置
export const config = envSchema.parse(process.env);

// 导出配额配置
export const quotas = {
  free: parseQuotaString(config.QUOTA_FREE),
  basic: parseQuotaString(config.QUOTA_BASIC),
  pro: parseQuotaString(config.QUOTA_PRO),
  enterprise: parseQuotaString(config.QUOTA_ENTERPRISE),
};

// 获取配额的辅助函数
export function getQuota(plan: z.infer<typeof planSchema>): z.infer<typeof quotaSchema> {
  return quotas[plan] || quotas.basic;
}

// 配置类型导出
export type Config = z.infer<typeof envSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Quota = z.infer<typeof quotaSchema>;
