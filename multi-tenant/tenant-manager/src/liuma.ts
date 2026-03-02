// Liuma 认证集成
import { config } from "./config.js";

/**
 * Liuma 认证用户信息
 */
export interface LiumaUser {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Liuma 认证响应接口
 */
interface LiumaVerifyResponse {
  valid: boolean;
  userId?: string;
  user?: {
    email: string;
    name?: string;
  };
}

/**
 * 验证 Liuma token
 *
 * 调用 Liuma 认证中心的 /api/auth/verify 接口
 *
 * @param token - Liuma Bearer token
 * @returns 用户信息
 * @throws Error 当 token 无效或验证失败时
 */
export async function verifyLiumaToken(token: string): Promise<LiumaUser> {
  const liumaUrl = config.LIUMA_URL || "https://auth.liuma.app";
  const url = `${liumaUrl}/api/auth/verify`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // 设置超时时间（10秒）
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // Token verification failed
      throw new Error("Invalid Liuma token");
    }

    const data = (await response.json()) as LiumaVerifyResponse;

    if (!data.valid || !data.userId) {
      throw new Error("Invalid Liuma token response");
    }

    return {
      userId: data.userId,
      email: data.user?.email || "",
      name: data.user?.name,
    };
  } catch (error) {
    if (error instanceof Error) {
      // 网络错误或超时
      if (error.name === "AbortError") {
        throw new Error("Liuma authentication timeout", { cause: error });
      }

      // 重新抛出已知的错误
      if (
        error.message === "Invalid Liuma token" ||
        error.message === "Invalid Liuma token response" ||
        error.message === "Liuma authentication timeout"
      ) {
        throw error;
      }
    }

    // 未预期的错误
    throw new Error("Liuma authentication failed", { cause: error });
  }
}
