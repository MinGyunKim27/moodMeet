import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@moodmeet/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
