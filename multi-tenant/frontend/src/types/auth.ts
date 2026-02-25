export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  userId: string;
  email: string;
  plan?: string;
}

export interface SignatureResponse {
  userId: string;
  signature: string;
  headers: {
    'X-User-ID': string;
    'X-User-Email': string;
    'X-User-Signature': string;
  };
  example: string;
}

export interface SsoInfo {
  authentication: {
    jwt: string;
    sharedSecret: {
      headers: Record<string, string>;
      signatureFormat: string;
      algorithm: string;
      tolerance: string;
    };
  };
  endpoints: Record<string, string>;
}
