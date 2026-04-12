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
          cream: '#faf6ed',
          'cream-dark': '#f0e6d0',
          paper: '#fffef7',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
