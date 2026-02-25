// 认证中间件
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from './config.js';
import { logger } from './logger.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userPlan?: string;
}

// JWT Payload
interface JWTPayload {
  userId: string;
  email: string;
  plan?: string;
}

// 生成 JWT Token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

// 生成 Refresh Token
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, config.JWT_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRES_IN,
  });
}

// 验证 JWT Token
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// 认证中间件
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    // 从 Authorization header 获取 token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证 token
    const payload = verifyToken(token);

    // 将用户信息附加到请求对象
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userPlan = payload.plan;

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// 可选认证中间件（不强制要求登录）
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      req.userId = payload.userId;
      req.userEmail = payload.email;
      req.userPlan = payload.plan;
    }

    next();
  } catch (error) {
    // 静默失败，继续处理请求
    next();
  }
}

// 检查管理员权限
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // TODO: 实现管理员检查逻辑
  // 目前简单检查 userPlan
  if (req.userPlan !== 'enterprise') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// OAuth 2.0 验证中间件（可选）
export function authenticateOAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!config.OAUTH_ENABLED) {
    return next();
  }

  // 从 OAuth 服务器验证 token
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  // 调用 OAuth 服务器的 introspect 端点
  fetch(`${config.OAUTH_ISSUER}/oauth/introspect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      token,
      client_id: 'openclaw-tenant-manager',
      client_secret: process.env.OAUTH_CLIENT_SECRET || '',
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.active) {
        res.status(401).json({ error: 'Token is not active' });
        return;
      }

      // 从 token 中提取用户信息
      req.userId = data.sub || data.user_id;
      req.userEmail = data.email;
      req.userPlan = data.plan;

      next();
    })
    .catch((error) => {
      logger.error('OAuth authentication failed', { error });
      res.status(500).json({ error: 'Authentication failed' });
    });
}

// ============ Shared Secret Authentication (for Better-auth/Casdoor integration) ============

// 生成 HMAC 签名
export function generateSignature(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', config.SHARED_SECRET_KEY)
    .update(payload)
    .digest('hex');
  return `${signature}:${timestamp}`;
}

// 验证 HMAC 签名
function verifySignature(userId: string, signature: string): boolean {
  const parts = signature.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const receivedSignature = parts[0];
  const timestamp = parseInt(parts[1], 10);

  // 检查时间戳（防重放）
  const timeDiff = Math.abs(Date.now() - timestamp);
  if (timeDiff > config.SIGNATURE_TOLERANCE * 1000) {
    logger.warn('Signature expired', { userId, timeDiff });
    return false;
  }

  // 重新计算签名
  const payload = `${userId}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.SHARED_SECRET_KEY)
    .update(payload)
    .digest('hex');

  // 使用 timing-safe 比较
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

// Shared Secret 认证中间件（用于 SSO 集成）
export function authenticateSharedSecret(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userEmail = req.headers['x-user-email'] as string;
    const userSignature = req.headers['x-user-signature'] as string;

    if (!userId || !userEmail) {
      res.status(401).json({ error: 'Missing user information headers' });
      return;
    }

    if (!userSignature) {
      res.status(401).json({ error: 'Missing signature header' });
      return;
    }

    if (!verifySignature(userId, userSignature)) {
      logger.warn('Invalid signature', { userId, userEmail });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // 签名验证成功
    req.userId = userId;
    req.userEmail = userEmail;

    next();
  } catch (error) {
    logger.error('Shared secret authentication failed', { error });
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// 双重认证中间件（支持 JWT 或 Shared Secret）
export function authenticateEither(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const userSignature = req.headers['x-user-signature'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 使用 JWT 认证
    authenticate(req, res, next);
  } else if (userSignature) {
    // 使用 Shared Secret 认证
    authenticateSharedSecret(req, res, next);
  } else {
    res.status(401).json({ error: 'Missing authorization' });
  }
}
