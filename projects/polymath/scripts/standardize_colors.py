# Unified Aperture Modern Theme standardization script
import os
import re

tailwind_content = """/** @type {import('tailwindcss').Config} */
module.exports = {
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
"""

with open('/Users/danielcroome-horgan/Aperture/projects/polymath/tailwind.config.js', 'w') as f:
    f.write(tailwind_content)

src_dir = '/Users/danielcroome-horgan/Aperture/projects/polymath/src'

def process_content(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # 0. Suffix Standardization
    content = content.replace('-raw', '-rgb')
    
    # 1. Standardize Rounding
    content = re.sub(r'(?<![-])rounded-sm(?![-\w])', 'rounded-lg', content)
    content = re.sub(r'(?<![-])rounded(?![-\w])', 'rounded-xl', content)
    
    # 2. Hardcoded RGBA Surfaces (Common opacities)
    # 0.02 - 0.04 -> subtle
    content = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.0[2-4]\)', 'var(--glass-surface)', content)
    # 0.05 - 0.07 -> standard surface
    content = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.0[5-7]\)', 'var(--glass-surface)', content)
    # 0.08 - 0.12 -> hover/active
    content = re.sub(r'rgba\(255,\s*255,\s*255,\s*0\.(08|09|1[0-2])\)', 'var(--glass-surface-hover)', content)
    
    # 3. Tailwind Glass Classes
    content = re.sub(r'bg-white/5|bg-white/\[0\.05\]|bg-white/\[0\.06\]', 'bg-brand-surface', content)
    content = re.sub(r'bg-white/10|bg-white/\[0\.1\]|bg-white/\[0\.08\]', 'bg-brand-surface/80', content) 
    content = re.sub(r'border-white/10|border-white/5|border-white/\[0\.08\]|border-white/\[0\.1\]', 'border-brand-border', content)
    
    # 4. Global Variable Migration (Premium -> Brand) with Optional Fallback
    content = re.sub(r'var\(--premium-text-primary[^)]*\)', 'var(--brand-text-primary)', content)
    content = re.sub(r'var\(--premium-text-secondary[^)]*\)', 'var(--brand-text-secondary)', content)
    content = re.sub(r'var\(--premium-text-tertiary[^)]*\)', 'var(--brand-text-muted)', content)
    content = re.sub(r'var\(--premium-blue[^)]*\)', 'var(--brand-primary)', content)
    content = re.sub(r'var\(--premium-surface-base[^)]*\)', 'var(--brand-bg)', content)
    content = re.sub(r'var\(--premium-bg-2[^)]*\)', 'var(--brand-glass-bg)', content)
    content = re.sub(r'var\(--premium-bg-3[^)]*\)', 'var(--glass-surface)', content)
    
    # 5. Tailwind Color Mappings
    content = re.sub(r'text-slate-200|text-white|text-gray-100|text-gray-50', 'text-brand-text-primary', content)
    content = re.sub(r'text-slate-300|text-slate-400|text-gray-300|text-gray-400', 'text-brand-text-secondary', content)
    content = re.sub(r'text-slate-500|text-gray-500|text-neutral-500', 'text-brand-text-muted', content)
    
    content = re.sub(r'text-blue-500|text-cyan-400|text-cyan-500', 'text-brand-primary', content)
    content = re.sub(r'bg-\[#0f1[78]29\]|bg-gray-900', 'bg-brand-bg', content)
    
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

modified_count = 0
for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
            if process_content(os.path.join(root, file)):
                modified_count += 1

print(f"Standardized design language in {modified_count} components.")
