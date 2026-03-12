# SCRUB & STANDARDIZE SCRIPT (V4 - ICON REPLACEMENT)
import os
import re

def scrub_non_ascii(text):
    return re.sub(r'[^\x00-\x7f]', '', text)

src_dir = '/Users/danielcroome-horgan/Aperture/projects/polymath/src'

def process_content(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # 1. Non-ASCII Scrub
    content = scrub_non_ascii(content)
    
    # 2. VARIABLE REPLACEMENT (Premium -> Brand)
    premium_map = {
        '--premium-text-primary': '--brand-text-primary',
        '--premium-text-secondary': '--brand-text-secondary',
        '--premium-text-tertiary': '--brand-text-muted',
        '--premium-blue': '--brand-primary',
        '--premium-indigo': '--brand-primary',
        '--premium-amber': '--brand-primary',
        '--premium-emerald': '--brand-primary',
        '--premium-surface-base': '--brand-bg',
        '--premium-bg-2': '--brand-glass-bg',
        '--premium-bg-3': '--glass-surface',
        '--premium-tracking-tight': '-0.04em'
    }
    for old, new in premium_map.items():
        content = content.replace(f'var({old})', f'var({new})' if new.startswith('--') else new)

    # 3. ICON REPLACEMENT (Replace Sparkles/Wand2 with Zap)
    # Step A: Update imports from lucide-react
    # Find lucide imports like: import { A, B, Sparkles, C } from 'lucide-react'
    def replace_lucide_icon(match):
        icons_text = match.group(1)
        icons = [i.strip() for i in icons_text.split(',')]
        # Replace Sparkles, Wand2 with Zap
        new_icons = []
        has_zap = 'Zap' in icons
        for i in icons:
            if i in ['Sparkles', 'Sparkle', 'Wand2'] and not has_zap:
                new_icons.append('Zap')
                has_zap = True
            elif i in ['Sparkles', 'Sparkle', 'Wand2'] and has_zap:
                continue # Already have Zap
            else:
                new_icons.append(i)
        
        # Clean up empty strings and format
        new_icons = [i for i in new_icons if i]
        return f"import {{ {', '.join(new_icons)} }} from 'lucide-react'"

    content = re.sub(r"import\s*\{\s*([^}]+)\s*\}\s*from\s*'lucide-react'", replace_lucide_icon, content)

    # Step B: Replace JSX usage
    content = content.replace('<Sparkles', '<Zap')
    content = content.replace('<Sparkle', '<Zap')
    content = content.replace('<Wand2', '<Zap')
    
    # Step C: Replace object/mapping usage (e.g., Icon: Sparkles)
    content = re.sub(r'Icon:\s*Sparkles', 'Icon: Zap', content)
    content = re.sub(r'Icon:\s*Wand2', 'Icon: Zap', content)

    # 4. CARD SCRUB
    content = content.replace('aperture-card', 'glass-card glass-card-hover')
    content = content.replace('aperture-hero-card', 'attention-card')

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

print(f"Scrubbed icons and standardized {modified_count} components.")
