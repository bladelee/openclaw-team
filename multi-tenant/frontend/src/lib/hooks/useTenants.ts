import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi, tenantsApi } from '@/lib/api/tenants';
import { useAuth } from './useAuth';
import type { Instance } from '@/types/tenant';

export function useTenants() {
  const queryClient = useQueryClient();
  const { isAuthenticated, clearAuth } = useAuth();

  // 获取当前用户的所有实例
  const {
    data: instances = [],
    isLoading,
    error,
  } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: async () => {
      try {
        return await instancesApi.getAll();
      } catch (err: any) {
        // If 401, clear the invalid token to break the login loop
        if (err?.response?.status === 401 || err?.status === 401) {
          console.log('[useTenants] Got 401, clearing invalid auth token');
          clearAuth();
          localStorage.removeItem('openclaw-auth-storage');
        }
        // If 404 (no instances found), return empty array
        if (err?.response?.status === 404 || err?.status === 404) {
          return [];
        }
        throw err;
      }
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // 创建实例
  const createMutation = useMutation({
    mutationFn: instancesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });

  // 删除实例
  const deleteMutation = useMutation({
    mutationFn: (instanceId: string) => instancesApi.delete(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });

  // 重启实例
  const restartMutation = useMutation({
    mutationFn: (instanceId: string) => instancesApi.restart(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });

  // 更新实例名称
  const updateNameMutation = useMutation({
    mutationFn: ({ instanceId, name }: { instanceId: string; name: string }) =>
      instancesApi.updateName(instanceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    },
  });

  return {
    instances,
    // 兼容旧代码
    tenant: instances.length > 0 ? instances[0] : null,
    tenants: instances,
    isLoading,
    error: error?.message,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['instances'] }),
    createTenant: createMutation.mutateAsync,
    deleteTenant: (instanceId?: string) =>
      deleteMutation.mutateAsync(instanceId || instances[0]?.instanceId || ''),
    restartTenant: (instanceId?: string) =>
      restartMutation.mutateAsync(instanceId || instances[0]?.instanceId || ''),
    updateInstanceName: (instanceId: string, name: string) =>
      updateNameMutation.mutateAsync({ instanceId, name }),
  };
}

// 用于管理员获取所有实例
export function useAllTenants() {
  return useQuery({
    queryKey: ['instances', 'all'],
    queryFn: tenantsApi.listAll,
    enabled: false, // 手动触发
  });
}
