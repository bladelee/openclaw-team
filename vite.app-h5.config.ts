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
    open: true,
    // API 代理配置
    // 注意：Vite 按配置顺序匹配，更具体的规则要放在前面
    proxy: {
      // 认证 API（更具体的路径，放在前面）
      '/api/auth': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      // 业务 API（更通用的路径，放在后面）
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  }
});
