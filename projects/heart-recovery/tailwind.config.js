/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        recovery: {
          teal: '#0f766e',
          'teal-dark': '#0b4f4a',
          'teal-light': '#ccfbf1',
          sky: '#0369a1',
          cream: '#fafaf7',
          ink: '#1c1917',
          go: '#15803d',
          'go-bg': '#dcfce7',
          wait: '#b45309',
          'wait-bg': '#fef3c7',
          ask: '#0369a1',
          'ask-bg': '#e0f2fe',
          warn: '#b91c1c',
          'warn-bg': '#fef2f2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
