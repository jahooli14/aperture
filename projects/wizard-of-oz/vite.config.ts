import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

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
    // PWA configuration with push notifications
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Pupils - Baby Photo Timeline',
        short_name: 'Pupils',
        description: 'Track your baby\'s growth with daily photos',
        theme_color: '#0891B2',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Enable navigation preload for faster page loads
        navigationPreload: true,
        // Immediately activate new service workers
        skipWaiting: true,
        clientsClaim: true,
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Cache Supabase REST API data requests (but NOT auth or realtime)
            // Use negative lookahead to exclude auth, realtime, and storage endpoints
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(?!auth).*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes - shorter TTL for data freshness
              },
              cacheableResponse: {
                statuses: [200] // Only cache successful responses, not CORS errors (status 0)
              },
              networkTimeoutSeconds: 10 // Don't wait too long for network
            }
          },
          {
            // Cache Supabase Storage images for longer
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days for images
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          }
          // Note: Auth endpoints (/auth/*) are NOT cached - they always go to network
          // Note: Realtime endpoints are websockets and not cacheable
        ],
        // Add custom service worker code for push notifications
        importScripts: ['sw-push.js'],
        additionalManifestEntries: []
      }
    })
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
