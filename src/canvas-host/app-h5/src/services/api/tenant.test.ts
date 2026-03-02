// tenant-manager API 服务单元测试
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getInstances,
  getInstance,
  createInstance,
  startInstance,
  stopInstance,
  deleteInstance,
  APIError,
} from "./tenant";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock auth module
vi.mock("../lib/auth", () => ({
  auth: {
    getSession: vi.fn(),
    logout: vi.fn(),
  },
}));

// Get mocked auth
import { auth as mockAuth } from "../lib/auth";

describe("tenant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("APIError", () => {
    it("should create APIError with message", () => {
      const error = new APIError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("APIError");
      expect(error.status).toBeUndefined();
      expect(error.code).toBeUndefined();
    });

    it("should create APIError with status and code", () => {
      const error = new APIError("Test error", 404, "NOT_FOUND");
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("getInstances", () => {
    it("should fetch instances successfully", async () => {
      const mockInstances = [
        { id: "1", name: "Instance 1", status: "running" },
        { id: "2", name: "Instance 2", status: "stopped" },
      ];

      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ instances: mockInstances }),
      } as never);

      const result = await getInstances();

      expect(result).toEqual(mockInstances);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/instances",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should handle API error", async () => {
      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as never);

      await expect(getInstances()).rejects.toThrow(APIError);
    });

    it("should handle 401 Unauthorized and call logout", async () => {
      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as never);

      await expect(getInstances()).rejects.toThrow(APIError);

      // Should call logout
      expect(vi.mocked(mockAuth).logout).toHaveBeenCalledTimes(1);
    });
  });

  describe("getInstance", () => {
    it("should fetch single instance successfully", async () => {
      const mockInstance = { id: "123", name: "Test Instance", status: "running" };

      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockInstance,
      } as never);

      const result = await getInstance("123");

      expect(result).toEqual(mockInstance);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/instances/123",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  describe("createInstance", () => {
    it("should create instance successfully", async () => {
      const mockInstance = { id: "123", name: "New Instance", status: "running" };

      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockInstance,
      } as never);

      const result = await createInstance({ name: "New Instance", plan: "basic" });

      expect(result).toEqual(mockInstance);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/instances",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "New Instance", plan: "basic" }),
        }),
      );
    });

    it("should handle create error", async () => {
      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid name" }),
      } as never);

      await expect(createInstance({ name: "", plan: "basic" })).rejects.toThrow("Invalid name");
    });
  });

  describe("startInstance", () => {
    it("should start instance successfully", async () => {
      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as never);

      await expect(startInstance("123")).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/instances/123/start",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  describe("stopInstance", () => {
    it("should stop instance successfully", async () => {
      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as never);

      await expect(stopInstance("123")).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/instances/123/stop",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  describe("deleteInstance", () => {
    it("should delete instance successfully", async () => {
      vi.mocked(mockAuth).getSession.mockResolvedValueOnce({
        token: "test-token",
        user: { userId: "123", email: "test@example.com" },
      } as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as never);

      await expect(deleteInstance("123")).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/instances/123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });
});
