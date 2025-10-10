import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html after build
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],

  // Optimization settings
  build: {
    // Generate source maps for better debugging
    sourcemap: true,

    // Manual chunking for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries for better caching
          vendor: ['react', 'react-dom'],
          ui: ['framer-motion', 'lucide-react'],
          supabase: ['@supabase/supabase-js'],
          ai: ['@google/generative-ai'],
        },
      },
    },

    // Optimize for modern browsers
    target: 'esnext',

    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },

  // Development server optimizations
  server: {
    // Enable hot module replacement
    hmr: true,

    // Development server port
    port: 5175,

    // Automatically open browser
    open: false,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@supabase/supabase-js',
      'framer-motion',
      'lucide-react',
      'zustand',
    ],
  },

  // Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@stores': '/src/stores',
      '@lib': '/src/lib',
      '@hooks': '/src/hooks',
    },
  },
})
