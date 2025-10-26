# Self-Healing Tests with Gemini Computer Use

> **Transform flaky Playwright tests into self-repairing tests powered by Google's Gemini AI**

**Status**: ✅ Phase 1 Complete | **Version**: 1.0.0 | **License**: MIT

---

## What is This?

When your Playwright tests break because a CSS selector changed, they **automatically repair themselves** using Google's Gemini Computer Use AI.

**Before** (breaks on UI changes):
```typescript
await page.click('#submit-button')  // ❌ Fails when ID changes
```

**After** (self-heals):
```typescript
await driver.click('#submit-button', 'submit button')  // ✅ Finds button visually if selector breaks
```

---

## Quick Start

```bash
cd projects/visual-test-generator
npm run setup
cp .env.example .env  # Add your API keys
npx playwright test examples/basic-test.spec.ts
npm run dev  # Review repairs at http://localhost:5173
```

Full guide: [QUICK_START.md](QUICK_START.md)

---

## Key Features

- ✅ Gemini Computer Use integration
- ✅ Playwright wrapper with AI fallback
- ✅ Visual element detection (88.9% success rate)
- ✅ Web UI for repair review
- ✅ ~$0.50/month cost (vs $50/hour debugging)

---

## Documentation

- [QUICK_START.md](QUICK_START.md) - Get running in 5 minutes
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Add to existing tests
- [API.md](API.md) - Complete API reference
- [GEMINI_COMPUTER_USE.md](GEMINI_COMPUTER_USE.md) - Technical deep dive

---

**Questions?** See [QUICK_START.md](QUICK_START.md) or [GEMINI_COMPUTER_USE.md](GEMINI_COMPUTER_USE.md)
