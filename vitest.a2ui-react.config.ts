/**
 * Vitest Configuration for A2UI React
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/canvas-host/a2ui-react/test/setup.ts',
    include: ['src/canvas-host/a2ui-react/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx,mtsx,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/canvas-host/a2ui-react/test/**',
        '**/*.test.tsx',
        '**/*.mock.ts',
        '**/types/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@a2ui-react': path.resolve(__dirname, './src/canvas-host/a2ui-react'),
      '@a2ui-spec': path.resolve(__dirname, './vendor/a2ui/specification')
    }
  }
});
