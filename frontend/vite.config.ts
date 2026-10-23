import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 默认仍代理到本机 8081；跑鉴权/多租户验收时需要把前端指向独立的测试后端
// （XINGTU_API_TARGET=http://127.0.0.1:8082 npm run dev），避免把测试数据写进 .env 里的共享云库
const API_TARGET = process.env.XINGTU_API_TARGET || 'http://127.0.0.1:8081'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
