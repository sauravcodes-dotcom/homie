import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // In dev, /api is proxied to FastAPI so the browser never needs CORS.
      proxy: {
        '/api': env.VITE_DEV_API_PROXY ?? 'http://localhost:8000',
      },
    },
  }
})
