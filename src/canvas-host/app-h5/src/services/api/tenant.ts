// tenant-manager API 服务
import { auth } from "../../lib/auth";

/**
 * 实例状态
 */
export type InstanceStatus = "running" | "stopped" | "error" | "starting" | "stopping";

/**
 * 实例信息
 */
export interface Instance {
  instanceId: string;
  userId: string;
  name: string;
  email: string;
  plan: string;
  status: InstanceStatus;
  source: "managed" | "custom" | "hardware";
  containerId: string | null;
  containerName: string | null;
  port: number | null;
  endpointId: number | null;
  gatewayToken: string | null;
  url: string | null;
  customUrl: string | null;
  healthCheckUrl: string | null;
  healthCheckInterval: number | null;
  lastHealthCheck: string | null;
  isHealthy: boolean | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建实例输入
 */
export interface CreateInstanceInput {
  name: string;
  email: string;
  plan?: "free" | "basic" | "pro" | "enterprise";
}

/**
 * 创建自定义实例输入
 */
export interface CreateCustomInstanceInput {
  name: string;
  instanceType: "cloud" | "hardware";
  url?: string;
  ip?: string;
  port?: number;
  apiToken?: string;
  healthCheckUrl?: string;
  healthCheckInterval?: number;
}

/**
 * API 错误
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * API 基础 URL
 *
 * 配置说明：
 * - 开发环境：使用空字符串，通过 Vite proxy 代理到后端
 * - 生产环境：使用空字符串，通过 Nginx/Coolify 等反向代理到后端
 *
 * Vite 开发服务器会代理：
 * - /api/* (排除 /api/auth/*) → http://localhost:3000/api/*
 *
 * 生产环境 Nginx 会代理：
 * - /api/* → 业务后端服务
 *
 * 好处：开发和生产环境代码一致，无需修改任何代码
 */
const API_BASE = ""; // 使用相对路径，通过 proxy 访问

/**
 * API 请求封装（自动携带认证 token）
 */
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  // 获取 Liuma token
  const session = await auth.getSession();

  // 调试输出
  if (import.meta.env.DEV) {
    console.debug("[API Request] Session:", session);
    console.debug(
      "[API Request] Token:",
      session?.token || session?.accessToken || "No token found",
    );
    console.debug("[API Request] Session keys:", session ? Object.keys(session) : "No session");
  }

  // 支持多种 token 字段名
  const token = session?.token || session?.accessToken || session?.sessionToken;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 添加 Bearer token
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (import.meta.env.DEV) {
    console.warn("[API Request] No token available in session");
  }

  // 使用相对路径，确保所有请求都通过 /api 前缀
  // 如果 endpoint 已经以 /api 开头，直接使用；否则添加 /api 前缀
  const url = endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 处理 401 未授权
  if (response.status === 401) {
    // Token 可能过期，清除会话
    await auth.logout();
    throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return response;
}

/**
 * 获取实例列表
 */
export async function getInstances(): Promise<Instance[]> {
  const response = await apiRequest("/instances");

  if (!response.ok) {
    throw new APIError(`Failed to fetch instances: ${response.statusText}`, response.status);
  }

  const data = await response.json();
  return data.instances || data;
}

/**
 * 获取单个实例详情
 */
export async function getInstance(id: string): Promise<Instance> {
  const response = await apiRequest(`/instances/${id}`);

  if (!response.ok) {
    throw new APIError(`Failed to fetch instance: ${response.statusText}`, response.status);
  }

  return response.json();
}

/**
 * 创建实例
 */
export async function createInstance(input: CreateInstanceInput): Promise<Instance> {
  const response = await apiRequest("/instances", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new APIError(
      error.error || `Failed to create instance: ${response.statusText}`,
      response.status,
    );
  }

  return response.json();
}

/**
 * 创建自定义实例（云实例或硬件实例）
 */
export async function createCustomInstance(input: CreateCustomInstanceInput): Promise<Instance> {
  const response = await apiRequest("/instances/custom", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new APIError(
      error.error || `Failed to create custom instance: ${response.statusText}`,
      response.status,
    );
  }

  return response.json();
}

/**
 * 启动实例
 */
export async function startInstance(id: string): Promise<void> {
  const response = await apiRequest(`/instances/${id}/start`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new APIError(`Failed to start instance: ${response.statusText}`, response.status);
  }
}

/**
 * 停止实例
 */
export async function stopInstance(id: string): Promise<void> {
  const response = await apiRequest(`/instances/${id}/stop`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new APIError(`Failed to stop instance: ${response.statusText}`, response.status);
  }
}

/**
 * 删除实例
 */
export async function deleteInstance(id: string): Promise<void> {
  const response = await apiRequest(`/instances/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new APIError(`Failed to delete instance: ${response.statusText}`, response.status);
  }
}
