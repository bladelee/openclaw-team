// Liuma 认证模块单元测试
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyLiumaToken } from "../src/liuma.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Liuma Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyLiumaToken", () => {
    it("应该验证有效的 Liuma token", async () => {
      const mockUser = {
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          userId: "user-123",
          user: mockUser,
        }),
      } as never);

      const result = await verifyLiumaToken("valid-token");
      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/verify"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("应该处理无效的 token（401 错误）", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as never);

      await expect(verifyLiumaToken("invalid-token")).rejects.toThrow("Invalid Liuma token");
    });

    it("应该处理无效的响应（valid: false）", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: false,
          userId: null,
        }),
      } as never);

      await expect(verifyLiumaToken("invalid-token")).rejects.toThrow(
        "Invalid Liuma token response",
      );
    });

    it("应该处理缺少 userId 的响应", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          userId: undefined,
          user: {
            email: "test@example.com",
          },
        }),
      } as never);

      await expect(verifyLiumaToken("incomplete-response")).rejects.toThrow(
        "Invalid Liuma token response",
      );
    });

    it("应该处理缺少 email 的情况", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          userId: "user-123",
          user: {},
        }),
      } as never);

      const result = await verifyLiumaToken("token-without-email");
      expect(result.userId).toBe("user-123");
      expect(result.email).toBe("");
    });

    it("应该处理网络错误", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(verifyLiumaToken("network-error-token")).rejects.toThrow(
        "Liuma authentication failed",
      );
    });

    it("应该处理超时错误", async () => {
      const timeoutError = new Error("Timeout");
      timeoutError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(timeoutError);

      await expect(verifyLiumaToken("timeout-token")).rejects.toThrow(
        "Liuma authentication timeout",
      );
    });

    it("应该使用默认的 LIUMA_URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          userId: "user-456",
          user: {
            email: "default@example.com",
          },
        }),
      } as never);

      await verifyLiumaToken("default-url-token");

      const fetchCall = mockFetch.mock.calls[0][0] as string;
      expect(fetchCall).toContain("https://auth.liuma.app/api/auth/verify");
    });
  });

  describe("LiumaUser 接口", () => {
    it("应该返回完整的用户信息（包括 name）", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          userId: "user-789",
          user: {
            email: "complete@example.com",
            name: "Complete User",
          },
        }),
      } as never);

      const result = await verifyLiumaToken("complete-user-token");
      expect(result).toEqual({
        userId: "user-789",
        email: "complete@example.com",
        name: "Complete User",
      });
    });

    it("应该返回部分用户信息（不包括 name）", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          userId: "user-101",
          user: {
            email: "partial@example.com",
          },
        }),
      } as never);

      const result = await verifyLiumaToken("partial-user-token");
      expect(result).toEqual({
        userId: "user-101",
        email: "partial@example.com",
        name: undefined,
      });
    });
  });
});
