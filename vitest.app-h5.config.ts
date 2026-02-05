import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest configuration for H5 App
 */
export default defineConfig({
  root: './src/canvas-host/app-h5',
  plugins: [react()],
  resolve: {
    alias: {
      '@app-h5': path.resolve(__dirname, './src/canvas-host/app-h5'),
      '@a2ui-react': path.resolve(__dirname, './src/canvas-host/a2ui-react')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist']
  }
});
