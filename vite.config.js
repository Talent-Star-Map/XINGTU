import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
const previewApi = 'https://47.120.76.16'
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: previewApi, changeOrigin: true },
      '/uploads': { target: previewApi, changeOrigin: true },
    },
  },
  plugins: [
    uni(),
  ],
})
