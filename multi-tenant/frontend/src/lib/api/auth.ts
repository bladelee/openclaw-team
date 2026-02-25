import api from './client';
import type { LoginInput, LoginResponse, SignatureResponse, SsoInfo } from '@/types/auth';

export const authApi = {
  // 登录
  login: async (input: LoginInput): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', input);
    return response.data;
  },

  // 刷新 token
  refresh: async (refreshToken: string): Promise<{ token: string; expiresIn: number }> => {
    const response = await api.post<{ token: string; expiresIn: number }>('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  },

  // 生成签名（开发环境）
  generateSignature: async (userId: string): Promise<SignatureResponse> => {
    const response = await api.get<SignatureResponse>(`/auth/signature/${userId}`);
    return response.data;
  },

  // SSO 信息
  getSsoInfo: async (): Promise<SsoInfo> => {
    const response = await api.get<SsoInfo>('/auth/sso-info');
    return response.data;
  },

  // 使用 Shared Secret 登录（开发环境）
  loginWithSignature: async (userId: string, email: string): Promise<Tenant> => {
    // 首先获取签名
    const signatureResponse = await authApi.generateSignature(userId);

    // 使用签名创建租户/登录
    const response = await api.post<Tenant>(
      '/tenants',
      { email },
      {
        headers: {
          'X-User-ID': userId,
          'X-User-Email': email,
          'X-User-Signature': signatureResponse.signature,
        },
      }
    );
    return response.data;
  },
};

import type { Tenant } from '@/types/tenant';
