import api from './client';
import type { Host, HostWithTenants } from '@/types/host';

export const hostsApi = {
  // 获取所有主机
  getAll: async (): Promise<Host[]> => {
    const response = await api.get<Host[]>('/hosts');
    return response.data;
  },

  // 获取主机详情
  getById: async (endpointId: number): Promise<HostWithTenants> => {
    const response = await api.get<HostWithTenants>(`/hosts/${endpointId}`);
    return response.data;
  },
};
