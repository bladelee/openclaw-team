import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite configuration for A2UI React H5 frontend
 * Output: dist/a2ui-react/
 */
export default defineConfig({
  root: './src/canvas-host/a2ui-react',
  base: './',
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      '@a2ui-react': path.resolve(__dirname, './src/canvas-host/a2ui-react'),
      '@a2ui-spec': path.resolve(__dirname, './vendor/a2ui/specification')
    }
  },
  build: {
    outDir: '../../dist/a2ui-react',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React and related libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // A2UI core services and context
          if (id.includes('/a2ui-react/services/') || id.includes('/a2ui-react/context/')) {
            return 'a2ui-core';
          }
        }
      }
    }
  },
  server: {
    port: 18789,
    strictPort: true,
    host: true
  }
});
