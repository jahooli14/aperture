# SCRUB & STANDARDIZE SCRIPT
import os
import re

# Emojis/Non-ASCII (excluding common punctuation)
def scrub_non_ascii(text):
    # Strip symbols and emojis effectively
    return re.sub(r'[^\x00-\x7f]', '', text)

src_dir = '/Users/danielcroome-horgan/Aperture/projects/polymath/src'

def process_content(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content
    
    # 1. Non-ASCII Scrub
    content = scrub_non_ascii(content)
    
    # 2. Variable Scrub (Premium -> Brand)
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

    # 3. Lucide Color Scrub
    # Replace style={{ color: '...' }} and text-XXX-YYY
    content = re.sub(r'style=\{\{\s*color:\s*[\'"][^\'"]+[\'"]\s*\}\}', 'style={{ color: "var(--brand-primary)" }}', content)
    content = re.sub(r'text-(blue|indigo|purple|cyan|sky|pink|rose|emerald|green|amber|orange|red|yellow)-[1-9]00', 'text-brand-primary', content)
    content = re.sub(r'bg-(blue|indigo|purple|cyan|sky|pink|rose|emerald|green|amber|orange|red|yellow)-[1-9]00', 'bg-brand-primary', content)
    # Handle /opacities
    content = re.sub(r'(text|bg)-(blue|indigo|purple|cyan|sky|pink|rose|emerald|green|amber|orange|red|yellow)-[1-9]00/[0-9]+', '\\1-brand-primary', content)

    # 4. Heading Scrub
    # Replace h2/h3 with standardized classes if they look like section titles
    content = re.sub(r'className=[\'"]text-[123]xl[^"\' ]* font-bold[^"\' ]*[\'"]', 'className="section-header"', content)

    # 5. Card Scrub
    content = content.replace('aperture-card', 'glass-card glass-card-hover')
    content = content.replace('aperture-hero-card', 'attention-card')
    
    # 6. Typo Fixes
    content = content.replace('failfures', 'failures')

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

print(f"Scrubbed and standardized {modified_count} components.")
