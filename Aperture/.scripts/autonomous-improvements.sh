#!/bin/bash
# Autonomous Improvements Script for Wizard of Oz
# Implements high-impact improvements automatically

set -e

echo "🚀 Starting Autonomous Improvements for Wizard of Oz..."

# Navigate to project directory
cd "$(dirname "$0")/../projects/wizard-of-oz"

echo "📦 Installing development dependencies..."
npm install --save-dev \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom \
  rollup-plugin-visualizer \
  @types/testing-library__jest-dom

echo "📦 Installing production dependencies..."
npm install --save \
  @sentry/react \
  @sentry/vite-plugin

echo "✅ Dependencies installed successfully!"

echo "🏗️ Creating project structure..."

# Create test directory
mkdir -p src/tests
mkdir -p src/lib
mkdir -p src/hooks

echo "📝 Setting up Vitest configuration..."
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        'dist/',
        'api/',
      ],
    },
  },
})
EOF

echo "🧪 Creating test setup file..."
cat > src/tests/setup.ts << 'EOF'
import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'test-key'
EOF

echo "🔍 Updating package.json scripts..."
# Use node to update package.json scripts
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = {
  ...pkg.scripts,
  'test': 'vitest',
  'test:ui': 'vitest --ui',
  'test:coverage': 'vitest run --coverage',
  'analyze': 'npm run build && npx vite-bundle-analyzer dist',
  'health': 'curl -f http://localhost:5175/api/health || curl -f https://wizard-of-ngsh70dke-daniels-projects-ca7c7923.vercel.app/api/health'
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "✅ Autonomous improvements setup complete!"
echo ""
echo "📊 Summary of changes:"
echo "  ✅ Test infrastructure (Vitest + React Testing Library)"
echo "  ✅ Bundle analyzer tools"
echo "  ✅ Development scripts updated"
echo "  ✅ Project structure created"
echo ""
echo "🎯 Next steps (autonomous):"
echo "  1. Create structured logger"
echo "  2. Add health check endpoint"
echo "  3. Write first test suite"
echo "  4. Replace console.log statements"
echo ""
echo "🚀 Ready for autonomous improvements!"