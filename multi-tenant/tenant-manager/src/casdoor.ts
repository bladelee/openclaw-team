// Casdoor SSO 集成服务
import { logger } from './logger.js';
import { config } from './config.js';
import crypto from 'crypto';

// Casdoor 配置
export interface CasdoorConfig {
  endpoint: string;        // http://localhost:8000
  clientId: string;
  clientSecret: string;
  organization: string;    // 例如 "openclaw"
  application: string;     // 例如 "app-openclaw"
  redirectUri: string;     // http://localhost:3001/api/auth/casdoor/callback
}

// Casdoor 用户信息
export interface CasdoorUser {
  id: string;
  name: string;
  displayName: string;
  email: string;
  phone: string;
  avatar: string;
  type: string;
  organization: string;
  score: number;
  ranking: number;
  isOnline: boolean;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  createdTime: string;
  updatedTime: string;
  [key: string]: any;
}

// Casdoor Token 响应
export interface CasdoorTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// JWT 解码（简单实现，不验证签名）
function parseJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
  return JSON.parse(payload);
}

// 生成 state 参数（防 CSRF）
function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// 生成 PKCE code_verifier
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// 生成 PKCE code_challenge
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Casdoor 服务类
export class CasdoorService {
  private config: CasdoorConfig;
  private stateStore: Map<string, { redirect?: string; expires: number }> = new Map();
  private codeVerifierStore: Map<string, string> = new Map();

  constructor(config: CasdoorConfig) {
    this.config = config;
  }

  // 清理过期的 state
  private cleanExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (data.expires < now) {
        this.stateStore.delete(state);
        this.codeVerifierStore.delete(state);
      }
    }
  }

  // 生成授权 URL
  getAuthorizationUrl(redirect?: string): string {
    this.cleanExpiredStates();

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // 存储 state 和 code_verifier
    this.stateStore.set(state, {
      redirect,
      expires: Date.now() + 10 * 60 * 1000, // 10 分钟
    });
    this.codeVerifierStore.set(state, codeVerifier);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: 'openid profile email',
      state: state,
      organization: this.config.organization,
      application: this.config.application,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${this.config.endpoint}/login/oauth/authorize?${params.toString()}`;
    logger.info('Generated authorization URL', { authUrl, state });

    return authUrl;
  }

  // 处理回调，交换 code 获取 token
  async handleCallback(code: string, state: string): Promise<{ user: CasdoorUser; originalRedirect?: string }> {
    this.cleanExpiredStates();

    // 验证 state
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid or expired state parameter');
    }

    const codeVerifier = this.codeVerifierStore.get(state);
    if (!codeVerifier) {
      throw new Error('Missing code verifier');
    }

    // 清理已使用的 state
    this.stateStore.delete(state);
    this.codeVerifierStore.delete(state);

    // 交换 code 获取 token
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

    // 解析 id_token 获取用户信息
    const userInfo = parseJwt(tokenResponse.id_token);

    logger.info('Casdoor authentication successful', {
      userId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
    });

    return {
      user: userInfo as CasdoorUser,
      originalRedirect: stateData.redirect,
    };
  }

  // 交换 code 获取 token
  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<CasdoorTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(`${this.config.endpoint}/api/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to exchange code for token', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    return await response.json() as CasdoorTokenResponse;
  }

  // 获取用户信息（通过 API）
  async getUserInfo(accessToken: string): Promise<CasdoorUser> {
    const params = new URLSearchParams({
      id: this.config.clientId,
      organization: this.config.organization,
    });

    const response = await fetch(
      `${this.config.endpoint}/api/get-user?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to get user info', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Failed to get user info: ${errorText}`);
    }

    const data = await response.json();
    return data as CasdoorUser;
  }

  // 刷新 token
  async refreshToken(refreshToken: string): Promise<CasdoorTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(`${this.config.endpoint}/api/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${errorText}`);
    }

    return await response.json() as CasdoorTokenResponse;
  }

  // 验证 token（调用 Casdoor 的 introspect 端点）
  async verifyToken(token: string): Promise<{ active: boolean; [key: string]: any }> {
    const params = new URLSearchParams({
      token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(`${this.config.endpoint}/api/login/oauth/introspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Token verification failed');
    }

    const data = await response.json() as { active: boolean; [key: string]: any };
    return data;
  }
}

// 单例
let casdoorServiceInstance: CasdoorService | null = null;

export function getCasdoorService(): CasdoorService | null {
  if (!config.CASDOOR_ENABLED) {
    return null;
  }

  if (!casdoorServiceInstance) {
    const casdoorConfig: CasdoorConfig = {
      endpoint: config.CASDOOR_ENDPOINT!,
      clientId: config.CASDOOR_CLIENT_ID!,
      clientSecret: config.CASDOOR_CLIENT_SECRET!,
      organization: config.CASDOOR_ORGANIZATION!,
      application: config.CASDOOR_APPLICATION!,
      redirectUri: config.CASDOOR_REDIRECT_URI!,
    };
    casdoorServiceInstance = new CasdoorService(casdoorConfig);
  }

  return casdoorServiceInstance;
}
