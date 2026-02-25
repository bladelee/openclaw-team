export interface Host {
  id: number;
  name: string;
  status: 'active' | 'down' | 'draining';
  type: number;
  publicUrl: string;
  tenantCount: number;
  stats?: HostStats;
}

export interface HostStats {
  cpuTotal: number;
  memoryTotal: number;
  memoryUsed: number;
  serverVersion: string;
}

export interface HostWithTenants extends Host {
  tenants: {
    tenantId: string;
    userId: string;
    email: string;
    plan: string;
    status: string;
  }[];
}
