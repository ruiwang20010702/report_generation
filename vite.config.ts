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
}));
