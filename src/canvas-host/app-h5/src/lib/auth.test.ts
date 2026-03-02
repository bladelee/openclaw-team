/**
 * Auth Library Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "./auth";

// Mock LiumaAuth
vi.mock("@liuma/auth-sdk", () => ({
  LiumaAuth: class {
    login = vi.fn();
    logout = vi.fn();
    getSession = vi.fn();
    getUser = vi.fn();
    refreshToken = vi.fn();
    getHTTPClient = vi.fn();
    constructor() {}
  },
}));

describe("auth library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auth instance", () => {
    it("should have login method", () => {
      expect(auth.login).toBeDefined();
      expect(typeof auth.login).toBe("function");
    });

    it("should have logout method", () => {
      expect(auth.logout).toBeDefined();
      expect(typeof auth.logout).toBe("function");
    });

    it("should have getSession method", () => {
      expect(auth.getSession).toBeDefined();
      expect(typeof auth.getSession).toBe("function");
    });

    it("should have getUser method", () => {
      expect(auth.getUser).toBeDefined();
      expect(typeof auth.getUser).toBe("function");
    });

    it("should have refreshToken method", () => {
      expect(auth.refreshToken).toBeDefined();
      expect(typeof auth.refreshToken).toBe("function");
    });

    it("should have getHTTPClient method", () => {
      expect(auth.getHTTPClient).toBeDefined();
      expect(typeof auth.getHTTPClient).toBe("function");
    });

    it("should call login with provider", async () => {
      await auth.login("google");
      expect(auth.login).toHaveBeenCalledWith("google");
    });

    it("should call logout", async () => {
      await auth.logout();
      expect(auth.logout).toHaveBeenCalled();
    });

    it("should call getSession", async () => {
      const mockSession = {
        user: { id: "123", email: "test@example.com" },
        token: "token",
        expiresAt: "2024-01-01",
      };
      vi.mocked(auth.getSession).mockResolvedValue(mockSession as never);

      const session = await auth.getSession();
      expect(auth.getSession).toHaveBeenCalled();
      expect(session).toEqual(mockSession);
    });

    it("should call getUser", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      vi.mocked(auth.getUser).mockResolvedValue(mockUser as never);

      const user = await auth.getUser();
      expect(auth.getUser).toHaveBeenCalled();
      expect(user).toEqual(mockUser);
    });

    it("should call refreshToken", async () => {
      vi.mocked(auth.refreshToken).mockResolvedValue("new-token" as never);

      const token = await auth.refreshToken();
      expect(auth.refreshToken).toHaveBeenCalled();
      expect(token).toBe("new-token");
    });
  });
});
