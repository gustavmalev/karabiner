import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Adjust the target to match your existing visualizer server port
    proxy: {
      '/api': 'http://localhost:5178',
    },
  },
})
