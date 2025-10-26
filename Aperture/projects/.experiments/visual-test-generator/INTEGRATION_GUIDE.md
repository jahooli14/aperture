# Integration Guide - Adding Self-Healing to Existing Tests

Transform your existing Playwright tests to self-healing tests in **3 steps**.

---

## Before & After

### Before (Breaks on UI changes)
```typescript
await page.click('#submit-button')
await page.fill('[name="email"]', 'test@example.com')
```

### After (Self-heals automatically)
```typescript
await driver.click('#submit-button', 'submit button')
await driver.fill('[name="email"]', 'test@example.com', 'email input')
```

**Only difference**: Add description as second parameter, use `driver` instead of `page`

---

## Step 1: Import & Configure

```typescript
import { test } from '@playwright/test'
import { createSelfHealingDriver } from '@aperture/self-healing-tests'
import { config } from '../self-healing.config'

test('existing test', async ({ page }) => {
  // Create driver
  const driver = createSelfHealingDriver(
    page,
    config,
    __filename,  // Current file path
    test.info().title  // Test name
  )

  // Rest of your test...
})
```

---

## Step 2: Replace Methods

### Click
```typescript
// Before
await page.click('#button-id')

// After
await driver.click('#button-id', 'submit button')
```

### Fill
```typescript
// Before
await page.fill('[name="email"]', 'test@example.com')

// After
await driver.fill('[name="email"]', 'test@example.com', 'email input')
```

### Hover
```typescript
// Before
await page.hover('.menu-item')

// After
await driver.hover('.menu-item', 'menu item')
```

---

## Step 3: Add Report Generation

```typescript
test('test name', async ({ page }) => {
  const driver = createSelfHealingDriver(page, config, __filename, test.info().title)

  // Your test steps...

  // Add this at the end
  await driver.generateRepairReport()
})
```

**Done!** Your test now self-heals.

---

## Migration Patterns

### Pattern 1: Gradual Migration

Don't convert all tests at once. Start with flaky tests:

```typescript
test.describe('Flaky tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up driver in beforeEach
    page['driver'] = createSelfHealingDriver(
      page,
      config,
      __filename,
      test.info().title
    )
  })

  test('flaky test 1', async ({ page }) => {
    const driver = page['driver']
    await driver.click('#flaky-selector', 'button')
  })
})
```

### Pattern 2: Wrapper Function

Create helper to reduce boilerplate:

```typescript
// test-utils.ts
export function withSelfHealing(
  page: Page,
  testFile: string,
  testName: string
) {
  return createSelfHealingDriver(page, config, testFile, testName)
}

// In test
const driver = withSelfHealing(page, __filename, test.info().title)
```

### Pattern 3: Fixture

Use Playwright fixtures for automatic setup:

```typescript
// fixtures.ts
import { test as base } from '@playwright/test'
import { createSelfHealingDriver } from '@aperture/self-healing-tests'
import { config } from './self-healing.config'

export const test = base.extend({
  driver: async ({ page }, use) => {
    const driver = createSelfHealingDriver(
      page,
      config,
      test.info().file,
      test.info().title
    )
    await use(driver)
    await driver.generateRepairReport()
  },
})

// In tests
import { test } from './fixtures'

test('auto self-healing', async ({ driver }) => {
  await driver.click('#button', 'button')
})
```

---

## Advanced Integration

### Hybrid Approach

Mix `driver` (self-healing) and `page` (traditional):

```typescript
test('hybrid test', async ({ page }) => {
  const driver = createSelfHealingDriver(page, config, __filename, test.info().title)

  // Use driver for flaky selectors
  await driver.click('.dynamic-button', 'submit button')

  // Use page for stable selectors
  await page.goto('/stable-page')
  await expect(page.locator('h1')).toHaveText('Dashboard')

  // Use driver for form (often changes)
  await driver.fill('#search', 'query', 'search input')
})
```

### Conditional Self-Healing

Only enable in CI or for specific tests:

```typescript
const useSelfHealing = process.env.ENABLE_SELF_HEALING === 'true'

test('test', async ({ page }) => {
  if (useSelfHealing) {
    const driver = createSelfHealingDriver(page, config, __filename, test.info().title)
    await driver.click('#button', 'button')
  } else {
    await page.click('#button')
  }
})
```

---

## Configuration Best Practices

### Development
```env
SELF_HEALING_AUTO_APPROVE=false
SELF_HEALING_AUTO_APPROVE_HIGH_CONFIDENCE=false
SELF_HEALING_CONFIDENCE_THRESHOLD=0.7
SELF_HEALING_ENABLE_LOGGING=true
```

**Rationale**: Review all repairs manually during development

### CI/CD
```env
SELF_HEALING_AUTO_APPROVE=false
SELF_HEALING_AUTO_APPROVE_HIGH_CONFIDENCE=true
SELF_HEALING_CONFIDENCE_THRESHOLD=0.9
SELF_HEALING_ENABLE_LOGGING=false
```

**Rationale**: Auto-approve high confidence, but still review medium/low

### Production Monitoring
```env
SELF_HEALING_AUTO_APPROVE=true
SELF_HEALING_AUTO_APPROVE_HIGH_CONFIDENCE=true
SELF_HEALING_CONFIDENCE_THRESHOLD=0.8
SELF_HEALING_ENABLE_LOGGING=true
```

**Rationale**: Full automation, but log everything for audit

---

## Handling Edge Cases

### Dynamic Content (A/B Tests)

```typescript
// Multiple possible selectors
const selectors = ['#button-a', '#button-b', '.button-variant']

for (const selector of selectors) {
  try {
    await driver.click(selector, 'submit button')
    break  // Found it
  } catch {
    continue  // Try next
  }
}
```

### Conditional Elements

```typescript
// Element may or may not exist
const isVisible = await page.locator('.optional-element').isVisible()

if (isVisible) {
  await driver.click('.optional-element', 'optional element')
}
```

### Iframe Elements

```typescript
const frame = page.frameLocator('#my-iframe')
const frameDriver = createSelfHealingDriver(
  frame,
  config,
  __filename,
  test.info().title
)
await frameDriver.click('#button', 'iframe button')
```

---

## Monitoring & Metrics

### Track Repair Rate

```typescript
test.afterEach(async ({ }, testInfo) => {
  const repairs = driver.getRepairs()

  if (repairs.length > 0) {
    console.log(`⚠️  Test repaired ${repairs.length} selectors`)

    // Send to monitoring (Datadog, Sentry, etc.)
    analytics.track('test_repairs', {
      test: testInfo.title,
      count: repairs.length,
      confidence: repairs.map(r => r.confidence)
    })
  }
})
```

### Alert on High Repair Rate

```typescript
test.afterAll(async () => {
  const allRepairs = getAllRepairs()  // Custom tracking

  if (allRepairs.length > 10) {
    // Too many repairs = UI instability
    await sendAlert({
      message: `High repair rate: ${allRepairs.length} repairs in this run`,
      severity: 'warning'
    })
  }
})
```

---

## Rollback Strategy

Keep original tests during migration:

```
tests/
  login.spec.ts              # Original
  login.self-healing.spec.ts # Self-healing version
```

Compare results:
```bash
# Run both
npx playwright test tests/login.spec.ts tests/login.self-healing.spec.ts

# Compare reports
npx playwright show-report
```

Once confident, replace original.

---

## Performance Considerations

### Self-healing adds latency ONLY on failure:
- **Normal case** (selector works): 0ms overhead
- **Failure case** (needs repair): +2-5s (Gemini API call)

### Optimize:
1. **Good selectors first**: Use data-testid, less likely to break
2. **Timeout tuning**: Set appropriate `timeout` config
3. **Parallel tests**: Self-healing works with `--workers`

---

## Next Steps

- **Examples**: See `examples/` for complete tests
- **API Reference**: [API.md](API.md) for full method list
- **Troubleshooting**: Common issues in [README.md](README.md#troubleshooting)

---

**Questions?** Open an issue or check the documentation.
