import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectManifest: {
          maximumFileSizeToCacheInBytes: 3000000
        },
        devOptions: {
          enabled: true,
          type: 'module'
        },
        manifest: false // Use existing public/manifest.json
      })
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
            // Heavy visualization libraries - separate chunk
            'graph-vendor': ['three', 'd3-force-3d', 'react-force-graph-3d', 'react-force-graph-2d', 'd3-delaunay', 'd3'],
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
  }
})
