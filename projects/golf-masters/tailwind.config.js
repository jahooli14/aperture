/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        masters: {
          green: '#006747',
          'green-dark': '#004d35',
          'green-light': '#2d8b5e',
          'green-pale': '#e8f5e9',
          yellow: '#f2c94c',
          gold: '#c8a951',
          'gold-light': '#f5e6b8',
          cream: '#faf6ed',
          'cream-dark': '#f0e6d0',
          paper: '#fffef7',
          'paper-dark': '#f7f1e3',
          pine: '#1a3c2a',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
