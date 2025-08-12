import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const r = (p: string) => path.resolve(__dirname, p)

export default defineConfig({
  plugins: [
    react(),
    // Generate bundle analysis after build at visualizer-react/stats.html
    visualizer({
      filename: 'stats.html',
      template: 'treemap', // sunburst | treemap | network
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ],
  resolve: {
    alias: {
      // Replace heavy framer-motion with local no-op shim used by HeroUI
      'framer-motion': r('./src/shims/framer-motion.ts'),
    },
  },
  optimizeDeps: {
    // Prevent esbuild from attempting to prebundle the real framer-motion
    exclude: ['framer-motion'],
  },
  server: {
    // Adjust the target to match your existing visualizer server port
    proxy: {
      '/api': 'http://localhost:5178',
    },
  },
  build: {
    sourcemap: false,
    // Help tree-shaking and better code-splitting
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          heroui: ['@heroui/react'],
          motion: ['framer-motion'],
          data: ['dexie', 'zod', 'zustand'],
        },
      },
    },
  },
})
