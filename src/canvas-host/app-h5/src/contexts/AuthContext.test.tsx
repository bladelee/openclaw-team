/**
 * AuthContext Tests
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

// Mock auth library
vi.mock("../lib/auth", () => ({
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    isAuthenticated: vi.fn(),
    refreshToken: vi.fn(),
    getHTTPClient: vi.fn(),
  },
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide auth context", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current).toBeDefined();
    expect(result.current.auth).toBeDefined();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should load session on mount", async () => {
    const mockSession = {
      user: { id: "123", email: "test@example.com", name: "Test User" },
      token: "test-token",
      expiresAt: "2024-01-01T00:00:00Z",
    };

    const { auth } = vi.mocked(await import("../lib/auth"));
    vi.mocked(auth.getSession).mockResolvedValue(mockSession as never);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockSession.user);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("should handle missing session", async () => {
    const { auth } = vi.mocked(await import("../lib/auth"));
    vi.mocked(auth.getSession).mockResolvedValue(null as never);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should login with provider", async () => {
    const { auth } = vi.mocked(await import("../lib/auth"));
    vi.mocked(auth.getSession).mockResolvedValue(null as never);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.login("github");
    });

    expect(auth.login).toHaveBeenCalledWith("github");
  });

  it("should default to google provider", async () => {
    const { auth } = vi.mocked(await import("../lib/auth"));
    vi.mocked(auth.getSession).mockResolvedValue(null as never);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.login();
    });

    expect(auth.login).toHaveBeenCalledWith("google");
  });

  it("should logout and clear state", async () => {
    const mockSession = {
      user: { id: "123", email: "test@example.com" },
      token: "test-token",
      expiresAt: "2024-01-01T00:00:00Z",
    };

    const { auth } = vi.mocked(await import("../lib/auth"));
    vi.mocked(auth.getSession).mockResolvedValue(mockSession as never);
    vi.mocked(auth.logout).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(auth.logout).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should refresh session", async () => {
    const { auth } = vi.mocked(await import("../lib/auth"));
    vi.mocked(auth.getSession).mockResolvedValue(null as never);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    const newSession = {
      user: { id: "456", email: "new@example.com" },
      token: "new-token",
      expiresAt: "2024-01-02T00:00:00Z",
    };
    vi.mocked(auth.getSession).mockResolvedValue(newSession as never);

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.user).toEqual(newSession.user);
    expect(result.current.session).toEqual(newSession);
  });

  it("should throw error when useAuth is used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within AuthProvider");

    consoleSpy.mockRestore();
  });
});
