import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      external: [],
    },
  },
  envDir: './environments', 
  
  server: {
    port: 5173,
    proxy: {
      // 🌟 /service နဲ့စတဲ့ URL တွေကို wap.kbzpay.com ဆီ လွှဲပေးမယ်
      '/service': {
        target: 'https://wap.kbzpay.com', 
        changeOrigin: true,
        secure: false, 
      },
      // 🌟 /baas နဲ့စတဲ့ URL တွေကို wap.kbzpay.com ဆီ လွှဲပေးမယ်
      '/baas': {
        target: 'https://wap.kbzpay.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});