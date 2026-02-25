// 实例类型定义
export type InstanceSource = 'managed' | 'custom' | 'hardware';

export interface Instance {
  instanceId: string;
  userId: string;
  name: string;
  email: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  url: string;
  status: 'running' | 'stopped' | 'creating' | 'error';
  containerId: string;
  containerName: string;
  host?: string;
  port?: number;
  createdAt: string;
  // Custom instance fields
  source?: InstanceSource;
  customUrl?: string;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
  lastHealthCheck?: string;
  isHealthy?: boolean;
}

export interface CreateInstanceInput {
  email: string;
  name?: string;
  plan?: Instance['plan'];
}

export interface InstanceStats {
  total: number;
  running: number;
  stopped: number;
  byPlan: Record<string, number>;
}

export interface RegisterCustomInstanceInput {
  name: string;
  instanceType: 'cloud' | 'hardware';
  url?: string;
  ip?: string;
  port?: number;
  apiToken?: string;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
}

export interface HealthCheckResult {
  urlValid: boolean;
  apiAccessible: boolean;
  healthCheck: boolean;
  error?: string;
}

// 保留旧名称以兼容
export type Tenant = Instance;
export type CreateTenantInput = CreateInstanceInput;
export type TenantStats = InstanceStats;
