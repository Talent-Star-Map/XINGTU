import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://180.76.227.159:8081', changeOrigin: true },
      '/uploads': { target: 'http://180.76.227.159:8081', changeOrigin: true },
    },
  },
  plugins: [
    uni(),
  ],
})
