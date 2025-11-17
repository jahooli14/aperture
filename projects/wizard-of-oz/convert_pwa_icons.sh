#!/bin/bash

# Input and output paths
svg_input="/Users/danielcroome-horgan/Aperture/projects/wizard-of-oz/public/pupils-logo.svg"
pwa_192="/Users/danielcroome-horgan/Aperture/projects/wizard-of-oz/public/pwa-192x192.png"
pwa_512="/Users/danielcroome-horgan/Aperture/projects/wizard-of-oz/public/pwa-512x512.png"

# Ensure rsvg-convert is available (part of librsvg)
if ! command -v rsvg-convert &> /dev/null; then
    echo "rsvg-convert is not installed. Please install librsvg:"
    echo "  brew install librsvg"
    exit 1
fi

# Convert SVG to 192x192 PNG
rsvg-convert "$svg_input" -w 192 -h 192 -o "$pwa_192"

# Convert SVG to 512x512 PNG
rsvg-convert "$svg_input" -w 512 -h 512 -o "$pwa_512"

# Verify the files
echo "192x192 PWA icon:"
file "$pwa_192"
echo "512x512 PWA icon:"
file "$pwa_512"