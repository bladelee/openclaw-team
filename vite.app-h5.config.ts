import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite configuration for H5 App
 * Output: dist/app-h5/
 */
export default defineConfig({
  root: './src/canvas-host/app-h5',
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@app-h5': path.resolve(__dirname, './src/canvas-host/app-h5'),
      '@a2ui-react': path.resolve(__dirname, './src/canvas-host/a2ui-react')
    }
  },
  build: {
    outDir: path.resolve(__dirname, './dist/app-h5'),
    emptyOutDir: true,
    sourcemap: true,  // 启用 sourcemap 用于调试
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React and related libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
        }
      }
    }
  },
  server: {
    port: 18790,
    strictPort: false,
    host: true,
    open: true
  }
});
