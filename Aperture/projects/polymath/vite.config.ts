import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-service-worker',
      closeBundle() {
        // Copy service worker to dist after build
        try {
          copyFileSync(
            path.resolve(__dirname, 'public/service-worker.js'),
            path.resolve(__dirname, 'dist/service-worker.js')
          )
          console.log('✓ Service worker copied to dist/')
        } catch (error) {
          console.warn('⚠ Failed to copy service worker:', error)
        }
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
