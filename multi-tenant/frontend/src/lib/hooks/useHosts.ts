import { useQuery } from '@tanstack/react-query';
import { hostsApi } from '@/lib/api/hosts';

export function useHosts() {
  const { data: hosts, isLoading, error, refetch } = useQuery({
    queryKey: ['hosts'],
    queryFn: hostsApi.getAll,
    staleTime: 30000, // 30 秒
  });

  return {
    hosts: hosts || [],
    isLoading,
    error: error?.message,
    refresh: refetch,
  };
}

export function useHost(endpointId: number) {
  return useQuery({
    queryKey: ['hosts', endpointId],
    queryFn: () => hostsApi.getById(endpointId),
    enabled: !!endpointId,
  });
}
