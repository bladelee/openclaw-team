/**
 * Vitest Configuration for app-h5
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    testTimeout: 10_000,
    include: ["src/canvas-host/app-h5/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx,mtsx,jsx}"],
    exclude: ["node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: [
        "node_modules/**",
        "**/*.test.{ts,tsx}",
        "**/types/**",
      ],
    },
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    alias: {
      "@app-h5": path.resolve(__dirname, "./src/canvas-host/app-h5"),
      "@a2ui-react": path.resolve(__dirname, "./src/canvas-host/a2ui-react"),
      // Mock auth for tests
      "../lib/auth": path.resolve(__dirname, "./src/canvas-host/app-h5/src/lib/auth.ts"),
    },
  },
});
