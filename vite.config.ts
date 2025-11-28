import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // 本地开发时，将 /api 请求代理到后端服务器
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Vite代理默认没有超时限制，但我们可以通过configure设置
        configure: (proxy: any) => {
          proxy.on('proxyReq', (proxyReq: any, req: any) => {
            // 设置请求超时为10分钟
            req.setTimeout(600000);
          });
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React 核心库
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // Radix UI 组件库
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // 图表库 (recharts 及其依赖)
          if (id.includes('node_modules/recharts') || 
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // Sentry 错误追踪
          if (id.includes('node_modules/@sentry/')) {
            return 'vendor-sentry';
          }
          // html2canvas (报告导出)
          if (id.includes('node_modules/html2canvas')) {
            return 'vendor-html2canvas';
          }
          // 表单和数据处理
          if (id.includes('node_modules/react-hook-form') ||
              id.includes('node_modules/@hookform/') ||
              id.includes('node_modules/zod') ||
              id.includes('node_modules/date-fns') ||
              id.includes('node_modules/@tanstack/')) {
            return 'vendor-utils';
          }
          // 其他工具库
          if (id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/class-variance-authority')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
}));
