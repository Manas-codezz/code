import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API = 'http://localhost:8001'
const proxied = ['/auth', '/content', '/findings', '/kb', '/analytics',
                 '/audit', '/health', '/comments']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(proxied.map((p) => [p, API])),
  },
  build: {
    target: 'es2020',
    cssMinify: true,
  },
})
