import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Frontend can call fetch('/api/health') and it will hit the backend during dev.
      '/api': {
        target: 'https://flomicbackend.vercel.app',
        changeOrigin: true,
      },
    },
  },
})
