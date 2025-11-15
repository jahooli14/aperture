# Quick Start - Self-Healing Tests

Get started with self-healing Playwright tests powered by Google Gemini Computer Use in **5 minutes**.

---

## Prerequisites

- Node.js >= 18.0.0
- Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- Supabase account ([Free tier](https://supabase.com))

---

## 1. Setup (2 minutes)

```bash
cd projects/visual-test-generator

# Run setup script
npm run setup

# Edit .env file with your API keys
cp .env.example .env
# Add your keys:
# - VITE_GEMINI_API_KEY
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
```

---

## 2. Create Supabase Table (1 minute)

Go to Supabase SQL Editor and run:

```sql
CREATE TABLE test_repairs (
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

CREATE INDEX idx_test_repairs_status ON test_repairs(status);
CREATE INDEX idx_test_repairs_timestamp ON test_repairs(timestamp DESC);

ALTER TABLE test_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON test_repairs FOR ALL USING (true);
```

---

## 3. Write Your First Self-Healing Test (2 minutes)

```typescript
// tests/login.spec.ts
import { test, expect } from '@playwright/test'
import { createSelfHealingDriver } from '@aperture/self-healing-tests'
import { config } from '../self-healing.config'

test('login with self-healing', async ({ page }) => {
  await page.goto('https://app.example.com/login')

  // Create driver
  const driver = createSelfHealingDriver(
    page,
    config,
    'tests/login.spec.ts',
    'login with self-healing'
  )

  // Use like normal Playwright, but with AI fallback!
  await driver.click('#login-button', 'login button')
  await driver.fill('[name="email"]', 'user@example.com', 'email input')
  await driver.fill('[name="password"]', 'password123', 'password input')
  await driver.click('button[type="submit"]', 'submit button')

  await expect(page).toHaveURL(/dashboard/)

  // Generate repair report
  await driver.generateRepairReport()
})
```

---

## 4. Run Test

```bash
npx playwright test tests/login.spec.ts
```

**What happens**:
1. Test tries traditional selector (e.g., `#login-button`)
2. If selector breaks, Gemini analyzes screenshot
3. Gemini finds element visually and clicks it
4. Repair logged to Supabase
5. Test continues successfully ✅

---

## 5. Review Repairs

```bash
# Start web UI
npm run dev

# Open browser
open http://localhost:5173/repairs
```

**In the UI**:
- See all failed selectors
- View screenshots with highlighted elements
- See Gemini's confidence level
- Approve/reject repairs
- Approved repairs update your test code (Phase 2)

---

## That's It!

Your tests now self-heal when UI changes. No more flaky tests from broken selectors.

---

## Next Steps

- **Integration Guide**: Add to existing tests → [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Examples**: See `examples/` folder for more patterns
- **API Reference**: Full API docs → [API.md](API.md)
- **Architecture**: Understanding the system → [GEMINI_COMPUTER_USE.md](GEMINI_COMPUTER_USE.md)

---

## Common Issues

### "Gemini API error: 401"
→ Check `VITE_GEMINI_API_KEY` in `.env`

### "Supabase error"
→ Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
→ Ensure table created with RLS policy

### "Element not found"
→ Increase `SELF_HEALING_TIMEOUT` in `.env`
→ Lower `SELF_HEALING_CONFIDENCE_THRESHOLD`

### "Too many token errors"
→ Gemini has rate limits - use `maxRetries` config

---

## Cost Estimate

**Typical usage** (100 tests/day, 10% failure rate):
- ~10 repairs/day
- ~13K tokens/day
- **~$0.50/month**

Compare to: 1 hour debugging flaky test = $50

---

**You're ready to go!** 🚀
