import api from './client';
import type { Instance, CreateInstanceInput, Tenant, CreateTenantInput, RegisterCustomInstanceInput, HealthCheckResult } from '@/types/tenant';

// 新的实例 API
export const instancesApi = {
  // 获取当前用户的所有实例
  getAll: async (): Promise<Instance[]> => {
    const response = await api.get<Instance[]>('/instances');
    return response.data;
  },

  // 通过 instance_id 获取实例
  getById: async (instanceId: string): Promise<Instance> => {
    const response = await api.get<Instance>(`/instances/${instanceId}`);
    return response.data;
  },

  // 创建实例
  create: async (input: CreateInstanceInput): Promise<Instance> => {
    const response = await api.post<Instance>('/instances', input);
    return response.data;
  },

  // 删除实例
  delete: async (instanceId: string): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>(`/instances/${instanceId}`);
    return response.data;
  },

  // 重启实例
  restart: async (instanceId: string): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>(`/instances/${instanceId}/restart`);
    return response.data;
  },

  // 更新实例名称
  updateName: async (instanceId: string, name: string): Promise<{ success: boolean; name: string }> => {
    const response = await api.put<{ success: boolean; name: string }>(`/instances/${instanceId}`, { name });
    return response.data;
  },

  // 获取日志
  getLogs: async (instanceId: string, tail = 100): Promise<string> => {
    const response = await api.get<string>(`/instances/${instanceId}/logs?tail=${tail}`, {
      responseType: 'text',
    });
    return response.data;
  },

  // 注册自定义实例
  registerCustom: async (input: RegisterCustomInstanceInput): Promise<Instance> => {
    const response = await api.post<Instance>('/instances/custom', input);
    return response.data;
  },

  // 验证自定义实例连接
  validateCustom: async (input: Omit<RegisterCustomInstanceInput, 'name' | 'healthCheckInterval'>): Promise<HealthCheckResult> => {
    const response = await api.post<HealthCheckResult>('/instances/custom/validate', input);
    return response.data;
  },

  // 健康检查
  healthCheck: async (instanceId: string): Promise<{ instanceId: string; isHealthy: boolean; lastCheck: string }> => {
    const response = await api.get<{ instanceId: string; isHealthy: boolean; lastCheck: string }>(`/instances/${instanceId}/health`);
    return response.data;
  },

  // 局域网扫描（发现本地硬件盒子）
  scanLocalNetwork: async (subnet?: string, port = 18789): Promise<{
    subnet: string;
    port: number;
    devices: Array<{ ip: string; name: string; type: string }>;
    count: number;
  }> => {
    const params = new URLSearchParams();
    if (subnet) params.append('subnet', subnet);
    params.append('port', port.toString());

    const response = await api.get(`/instances/scan-local?${params.toString()}`);
    return response.data;
  },
};

// 保留旧的租户 API 以兼容（内部映射到新的实例 API）
export const tenantsApi = {
  // 获取当前用户的所有实例（返回第一个以兼容旧代码）
  getMe: async (): Promise<Instance | Instance[]> => {
    const response = await api.get<Instance | Instance[]>('/tenants/me');
    return response.data;
  },

  // 创建租户（映射到创建实例）
  create: async (input: CreateTenantInput): Promise<Instance> => {
    const response = await api.post<Instance>('/instances', input);
    return response.data;
  },

  // 删除租户（删除第一个实例）
  deleteMe: async (): Promise<{ success: boolean }> => {
    const response = await api.delete<{ success: boolean }>('/tenants/me');
    return response.data;
  },

  // 重启租户（重启第一个实例）
  restartMe: async (): Promise<{ success: boolean }> => {
    const response = await api.post<{ success: boolean }>('/tenants/me/restart');
    return response.data;
  },

  // 获取日志
  getLogs: async (tail = 100): Promise<string> => {
    const response = await api.get<string>(`/tenants/me/logs?tail=${tail}`, {
      responseType: 'text',
    });
    return response.data;
  },

  // 获取统计
  getStats: async () => {
    const response = await api.get('/admin/instances/stats');
    return response.data;
  },

  // 列出所有租户（管理员）
  listAll: async (options?: { limit?: number; offset?: number }): Promise<Instance[]> => {
    const response = await api.get<Instance[]>('/admin/instances', { params: options });
    return response.data;
  },
};
