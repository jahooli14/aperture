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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'supabase': ['@supabase/supabase-js'],
          'google': ['@google/generative-ai'],
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
        },
      },
    },
    // Increase chunk size warning limit since we're using code splitting
    chunkSizeWarningLimit: 600,
    // Enable minification and tree shaking
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
  },
})
