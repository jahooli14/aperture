/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
      },
      spacing: {
        'space-1': '8px',
        'space-2': '16px',
        'space-3': '24px',
        'space-4': '32px',
        'space-5': '40px',
        'space-6': '48px',
        'space-7': '56px',
        'space-8': '64px',
        'space-10': '80px',
        'space-12': '96px',
      },
      borderRadius: {
        '2xl': 'var(--brand-radius-lg)',
        xl: 'var(--brand-radius)',
        lg: 'var(--brand-radius-sm)',
        md: 'calc(var(--brand-radius-sm) - 2px)',
        sm: 'calc(var(--brand-radius-sm) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        brand: {
          primary: 'rgb(var(--brand-primary-rgb))',
          bg: 'var(--brand-bg)',
          glass: 'var(--brand-glass-bg)',
          surface: 'var(--glass-surface)',
          border: 'var(--glass-border)',
        },
        'brand-text': {
          primary: 'var(--brand-text-primary)',
          secondary: 'var(--brand-text-secondary)',
          muted: 'var(--brand-text-muted)',
        },
        project: {
          tech: 'var(--project-tech)',
          art: 'var(--project-art)',
          writing: 'var(--project-writing)',
          music: 'var(--project-music)',
          business: 'var(--project-business)',
          life: 'var(--project-life)',
          default: 'var(--project-default)',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      }
    }
  },
  plugins: [],
}
