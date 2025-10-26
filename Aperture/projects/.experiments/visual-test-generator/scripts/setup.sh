#!/bin/bash
set -e

echo "🚀 Setting up Self-Healing Tests with Gemini Computer Use"
echo ""

# Check for .env file
if [ ! -f .env ]; then
  echo "📝 Creating .env file from .env.example..."
  cp .env.example .env
  echo "⚠️  Please edit .env and add your API keys:"
  echo "   - VITE_GEMINI_API_KEY"
  echo "   - VITE_SUPABASE_URL"
  echo "   - VITE_SUPABASE_ANON_KEY"
  echo ""
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium

# Install Tailwind CSS
echo "🎨 Installing Tailwind CSS..."
npm install -D tailwindcss postcss autoprefixer

# Create Supabase table
echo ""
echo "🗄️  Supabase Setup Required"
echo ""
echo "Run this SQL in your Supabase SQL Editor:"
echo ""
cat << 'SQL'
-- Create test_repairs table
CREATE TABLE IF NOT EXISTS test_repairs (
  id TEXT PRIMARY KEY,
  test_file TEXT NOT NULL,
  test_name TEXT NOT NULL,
  old_locator TEXT NOT NULL,
  new_locator TEXT NOT NULL,
  new_coordinates JSONB,
  description TEXT NOT NULL,
  screenshot TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  fill_value TEXT,
  confidence TEXT NOT NULL,
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_test_repairs_status ON test_repairs(status);
CREATE INDEX IF NOT EXISTS idx_test_repairs_timestamp ON test_repairs(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE test_repairs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all operations for authenticated users"
ON test_repairs
FOR ALL
USING (true)
WITH CHECK (true);
SQL

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in .env"
echo "2. Run Supabase SQL migration (shown above)"
echo "3. Run example test: npx playwright test examples/basic-test.spec.ts"
echo "4. Start web UI: npm run dev"
echo "5. Review repairs at: http://localhost:5173/repairs"
echo ""
