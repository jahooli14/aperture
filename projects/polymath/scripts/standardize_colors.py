# Unified Aperture Modern Theme tailwind integration
# This script will read theme.css and inject its variables into tailwind.config.js
# and clean up components to use standardized classes.
import os
import re

tailwind_content = """/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
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
        lg: 'var(--brand-radius, var(--radius))',
        md: 'calc(var(--brand-radius, var(--radius)) - 2px)',
        sm: 'calc(var(--brand-radius, var(--radius)) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        brand: {
          primary: 'var(--brand-primary)',
          bg: 'var(--brand-bg)',
          glass: 'var(--brand-glass-bg)',
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
"""

with open('/Users/danielcroome-horgan/Aperture/projects/polymath/tailwind.config.js', 'w') as f:
    f.write(tailwind_content)

src_dir = '/Users/danielcroome-horgan/Aperture/projects/polymath/src'

def process_colors(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # Text colors
    content = re.sub(r'text-slate-200|text-white|text-gray-100|text-gray-50', 'text-brand-text-primary', content)
    content = re.sub(r'text-slate-300|text-slate-400|text-gray-300|text-gray-400', 'text-brand-text-secondary', content)
    content = re.sub(r'text-slate-500|text-gray-500|text-neutral-500', 'text-brand-text-muted', content)
    
    # Bg / Border colors common in dark mode
    content = re.sub(r'border-white/10|border-white/5|border-slate-800', 'border-[rgba(255,255,255,0.08)]', content)
    content = re.sub(r'bg-white/5|bg-white/10|bg-slate-800/50|bg-slate-900/50', 'bg-brand-glass', content)
    
    # Primary brand coloring mappings
    content = re.sub(r'text-blue-500|text-cyan-400|text-cyan-500', 'text-brand-primary', content)
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

modified_count = 0
for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
            if process_colors(os.path.join(root, file)):
                modified_count += 1

print(f"Standardized colors in {modified_count} components.")
