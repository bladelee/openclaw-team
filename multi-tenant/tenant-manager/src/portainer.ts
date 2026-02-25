// Portainer API 客户端
import fetch from 'node-fetch';
import { Agent } from 'https';
import { config } from './config.js';
import { logger } from './logger.js';

// HTTPS Agent that accepts self-signed certificates (development only)
const httpsAgent = new Agent({
  rejectUnauthorized: false,
});

export interface PortainerEnvironment {
  Id: number;
  Name: string;
  Type: number;
  URL: string;
  PublicURL: string;
  Status: number; // 1 = up, 2 = down
  StatusDescription: string;
  Role: number;
  EdgeKeyID?: number;
}

export interface DockerInfo {
  NCPU: number;
  MemTotal: number;
  MemUsed: number;
  ServerVersion: string;
  Name: string;
}

export interface ContainerConfig {
  name: string;
  image: string;
  env?: string[];
  labels?: Record<string, string>;
  hostConfig?: {
    portBindings?: Record<string, { hostPort: string }[]>;
    binds?: string[];
    memory?: number;
    cpuQuota?: number;
  };
}

export interface ContainerInfo {
  Id: string;
  Name: string;
  State: {
    Running: boolean;
    Status: string;
  };
  NetworkSettings: {
    Ports: Record<string, { HostPort: string }[] | null>;
  };
  Config: {
    Labels: Record<string, string>;
  };
}

export class PortainerClient {
  private baseUrl: string;
  private apiKey: string;
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private cacheTTL = 30000; // 30 秒缓存

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || config.PORTAINER_URL;
    this.apiKey = apiKey || config.PORTAINER_API_KEY;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // 检查缓存
    if (options?.method === 'GET' || !options?.method) {
      const cached = this.cache.get(url);
      if (cached && cached.expires > Date.now()) {
        return cached.data as T;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        // @ts-ignore - node-fetch supports agent option
        agent: url.startsWith('https:') ? httpsAgent : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Portainer API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      // Check if response is empty (e.g., /start, /stop endpoints return 204 with empty body)
      const contentType = response.headers.get('content-type');
      const text = await response.text();

      if (!text || text.trim() === '') {
        return undefined as T;
      }

      const data = JSON.parse(text);

      // 缓存 GET 请求
      if (options?.method === 'GET' || !options?.method) {
        this.cache.set(url, {
          data,
          expires: Date.now() + this.cacheTTL,
        });
      }

      return data as T;
    } catch (error) {
      logger.error('Portainer API request failed', {
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // 清除缓存
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // 获取所有环境（主机）
  async getEnvironments(): Promise<PortainerEnvironment[]> {
    return this.request<PortainerEnvironment[]>('/api/endpoints');
  }

  // 获取可用环境
  async getAvailableEnvironments(): Promise<PortainerEnvironment[]> {
    const environments = await this.getEnvironments();
    return environments.filter(env => env.Status === 1); // 1 = up
  }

  // 获取环境详细信息
  async getEnvironment(endpointId: number): Promise<PortainerEnvironment> {
    return this.request<PortainerEnvironment>(`/api/endpoints/${endpointId}`);
  }

  // 获取 Docker 信息（资源统计）
  async getDockerInfo(endpointId: number): Promise<DockerInfo> {
    return this.request<DockerInfo>(`/api/endpoints/${endpointId}/docker/info`);
  }

  // 创建容器
  async createContainer(
    endpointId: number,
    config: ContainerConfig
  ): Promise<{ Id: string; Warnings: string[] }> {
    const containerConfig = {
      Image: config.image,
      Env: config.env || [],
      Labels: config.labels || {},
      HostConfig: {
        ...config.hostConfig,
        // 确保容器自动重启
        RestartPolicy: { Name: 'unless-stopped' },
      },
    };

    // 容器名作为查询参数（Docker API 要求）
    const nameParam = config.name ? `?name=${encodeURIComponent(config.name)}` : '';

    return this.request<{ Id: string; Warnings: string[] }>(
      `/api/endpoints/${endpointId}/docker/containers/create${nameParam}`,
      {
        method: 'POST',
        body: JSON.stringify(containerConfig),
      }
    );
  }

  // 启动容器
  async startContainer(endpointId: number, containerId: string): Promise<void> {
    await this.request(
      `/api/endpoints/${endpointId}/docker/containers/${containerId}/start`,
      {
        method: 'POST',
      }
    );
  }

  // 停止容器
  async stopContainer(endpointId: number, containerId: string): Promise<void> {
    await this.request(
      `/api/endpoints/${endpointId}/docker/containers/${containerId}/stop`,
      {
        method: 'POST',
        timeout: 10000, // 10 秒超时
      }
    );
  }

  // 重启容器
  async restartContainer(endpointId: number, containerId: string): Promise<void> {
    await this.request(
      `/api/endpoints/${endpointId}/docker/containers/${containerId}/restart`,
      {
        method: 'POST',
        timeout: 10000,
      }
    );
  }

  // 删除容器
  async removeContainer(
    endpointId: number,
    containerId: string,
    force = false
  ): Promise<void> {
    await this.request(
      `/api/endpoints/${endpointId}/docker/containers/${containerId}?force=${force}`,
      {
        method: 'DELETE',
      }
    );
  }

  // 获取容器信息
  async getContainer(
    endpointId: number,
    containerId: string
  ): Promise<ContainerInfo> {
    return this.request<ContainerInfo>(
      `/api/endpoints/${endpointId}/docker/containers/${containerId}/json`
    );
  }

  // 列出容器
  async listContainers(
    endpointId: number,
    all = false
  ): Promise<ContainerInfo[]> {
    return this.request<ContainerInfo[]>(
      `/api/endpoints/${endpointId}/docker/containers/json?all=${all}`
    );
  }

  // 获取容器日志
  async getContainerLogs(
    endpointId: number,
    containerId: string,
    tail = 100
  ): Promise<string> {
    const url = `${this.baseUrl}/api/endpoints/${endpointId}/docker/containers/${containerId}/logs?stdout=true&stderr=true&tail=${tail}`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
      },
      // @ts-ignore - node-fetch supports agent option
      agent: url.startsWith('https:') ? httpsAgent : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to get logs: ${response.statusText}`);
    }

    return response.text();
  }

  // 获取容器统计信息
  async getContainerStats(endpointId: number, containerId: string): Promise<any> {
    return this.request(
      `/api/endpoints/${endpointId}/docker/containers/${containerId}/stats`
    );
  }

  // 获取所有标签为 openclaw.tenant 的容器
  async getTenantContainers(endpointId: number): Promise<ContainerInfo[]> {
    const containers = await this.listContainers(endpointId, true);
    return containers.filter(c => c.Config.Labels['openclaw.tenant']);
  }
}

// 导出单例
let clientInstance: PortainerClient | null = null;

export function getPortainerClient(): PortainerClient {
  if (!clientInstance) {
    clientInstance = new PortainerClient();
  }
  return clientInstance;
}
