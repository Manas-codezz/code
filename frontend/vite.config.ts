import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const API = process.env.VITE_API_URL || 'http://localhost:8001'
const proxied = ['/auth', '/content', '/findings', '/kb', '/analytics',
                 '/audit', '/health', '/comments', '/integrations']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: Object.fromEntries(proxied.map((p) => [p, API])),
  },
  build: {
    target: 'es2020',
    cssMinify: true,
  },
})
