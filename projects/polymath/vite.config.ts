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
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    exclude: []
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://clandestined.vercel.app',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunks removed to prevent context singleton issues
      },
    },
    // Increase chunk size warning limit since we're using code splitting
    chunkSizeWarningLimit: 600,
    // Enable minification and tree shaking
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log/info/debug but keep console.error/warn for production debugging
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        drop_debugger: true,
      },
    },
  },
})
