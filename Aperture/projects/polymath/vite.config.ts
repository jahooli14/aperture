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
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'supabase': ['@supabase/supabase-js'],
          // Note: @google/generative-ai is only used server-side in API routes, not in frontend
          'capacitor': [
            '@capacitor/app',
            '@capacitor/core',
            '@capacitor/filesystem',
            '@capacitor/haptics',
            '@capacitor/keyboard',
            '@capacitor/network',
            '@capacitor/preferences',
            '@capacitor/splash-screen',
            '@capacitor/status-bar'
          ],
          // Heavy 3D visualization libraries - separate chunk
          '3d-vendor': ['three', 'd3-force-3d', 'react-force-graph-3d'],
          // Animation library
          'animation-vendor': ['framer-motion'],
        },
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
