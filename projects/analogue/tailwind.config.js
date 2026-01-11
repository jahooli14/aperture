/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Minimal, dark palette for focused writing
        ink: {
          50: '#f7f7f7',
          100: '#e3e3e3',
          200: '#c8c8c8',
          300: '#a4a4a4',
          400: '#818181',
          500: '#666666',
          600: '#515151',
          700: '#434343',
          800: '#383838',
          900: '#1a1a1a',
          950: '#0a0a0a',
        },
        // Section status colors
        status: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
        },
        // Narrative sections
        section: {
          departure: '#8b5cf6',    // Purple - drift
          escape: '#3b82f6',       // Blue - recovery
          rupture: '#f97316',      // Orange - threshold
          alignment: '#10b981',    // Green - merge
          reveal: '#ec4899',       // Pink - symmetry
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
      height: {
        'screen-safe': 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      }
    },
  },
  plugins: [],
}
