# 📚 Usage Guide

Learn how to effectively use the Self-Healing Testing Framework in your projects.

## Basic Usage

### Running Tests

#### Single Test
```bash
# Run a single test with healing
npx self-healing-tests run ./tests/login.test.ts

# With custom options
npx self-healing-tests run ./tests/login.test.ts \\
  --confidence-threshold 0.8 \\
  --verbose \\
  --auto-apply
```

#### Test Suite
```bash
# Run all tests in a directory
npx self-healing-tests suite ./tests/

# Run with specific settings
npx self-healing-tests suite ./tests/ \\
  --framework playwright \\
  --output-dir ./results \\
  --no-healing
```

### Programmatic Usage

```typescript
import { createFramework } from 'self-healing-tests';

// Create framework instance
const framework = createFramework({
  framework: 'playwright',
  enableHealing: true,
  confidenceThreshold: 0.8,
  autoApply: false,
  verbose: true
});

// Run single test
const result = await framework.runTest('./tests/checkout.test.ts');

// Run test suite
const suite = await framework.runTestSuite('./tests/');

// Get healing statistics
const stats = await framework.getHealingStats();
```

## Writing Healable Tests

### Best Practices

#### 1. Use Stable Selectors When Possible
```typescript
// Good: Semantic selectors
await page.click('[data-testid="login-button"]');
await page.click('#submit-form');

// Okay: Will be healed if changed
await page.click('.login-btn');
await page.click('button:has-text("Login")');
```

#### 2. Add Context Comments
```typescript
// Login form submission
await page.fill('#username', 'test@example.com');
await page.fill('#password', 'password123');

// Click the primary login button
await page.click('button[type="submit"]');

// Wait for successful login redirect
await page.waitForURL('**/dashboard');
```

#### 3. Use Descriptive Test Names
```typescript
// Good: Describes the complete flow
test('should login with valid credentials and redirect to dashboard', async () => {
  // Test implementation
});

// Less helpful: Too generic
test('login test', async () => {
  // Test implementation
});
```

### Healing-Friendly Patterns

#### Flexible Waiting
```typescript
// Instead of fixed waits:
await page.waitForTimeout(5000);

// Use condition-based waits:
await page.waitForSelector('.dashboard-header');
await page.waitForLoadState('networkidle');
```

#### Robust Element Selection
```typescript
// Instead of brittle selectors:
await page.click('div > div > button:nth-child(3)');

// Use semantic approaches:
await page.click('button:has-text("Add to Cart")');
await page.click('[aria-label="Add item to shopping cart"]');
```

#### Error Context
```typescript
// Provide context for failures
try {
  await page.click('#submit-button');
} catch (error) {
  // The healing engine will capture this context
  throw new Error(`Failed to click submit button: ${error.message}`);
}
```

## Configuration Options

### Framework Configuration

```typescript
const config = {
  // Testing framework
  framework: 'playwright', // Currently only option
  testTimeout: 30000,      // 30 second timeout
  retryCount: 1,           // Retry once before healing

  // Healing settings
  enableHealing: true,           // Enable healing
  autoApply: false,             // Require human approval
  confidenceThreshold: 0.7,     // 70% confidence minimum
  maxHealingAttempts: 3,        // Max 3 healing attempts

  // AI settings
  model: 'gemini-2.5-pro',      // Gemini model
  geminiApiKey: 'your-key',     // API key

  // Output settings
  screenshotOnFailure: true,    // Capture screenshots
  outputDir: './test-results',  // Output directory
  verbose: false                // Verbose logging
};
```

### Environment-Specific Configs

#### Development
```env
NODE_ENV=development
CONFIDENCE_THRESHOLD=0.6  # Lower threshold for experimentation
AUTO_APPLY=false          # Always review changes
VERBOSE=true              # Detailed logging
DEBUG_BROWSER=true        # Show browser
```

#### Production
```env
NODE_ENV=production
CONFIDENCE_THRESHOLD=0.9  # Very high confidence required
AUTO_APPLY=false          # Never auto-apply
MAX_HEALING_ATTEMPTS=2    # Limit attempts
```

#### CI/CD
```env
NODE_ENV=ci
CONFIDENCE_THRESHOLD=0.85 # High confidence
AUTO_APPLY=true           # Automated healing
MAX_HEALING_ATTEMPTS=1    # Single attempt
VERBOSE=true              # Logging for debugging
```

## Understanding Healing Results

### Result Status Types

```typescript
type TestStatus =
  | 'passed'           // Test passed normally
  | 'failed'           // Test failed, healing disabled/failed
  | 'healed'           // Test failed but was successfully healed
  | 'healing_failed';  // Healing was attempted but failed
```

### Reading Healing Actions

```typescript
const result = await framework.runTest('./test.ts');

if (result.healingResult) {
  result.healingResult.actions.forEach(action => {
    console.log(`${action.type}: ${action.description}`);
    console.log(`Confidence: ${action.confidence}`);
    console.log(`Change: "${action.oldValue}" → "${action.newValue}"`);
    console.log(`Reasoning: ${action.reasoning}`);
  });
}
```

### Healing Action Types

- **`selector_fix`**: Updated element selector
- **`wait_adjustment`**: Modified timing/waits
- **`assertion_update`**: Changed expected values
- **`flow_modification`**: Added/removed steps
- **`element_alternative`**: Found alternative element
- **`timing_fix`**: Added delays or retries

## CLI Commands Reference

### Basic Commands

```bash
# Run single test
npx self-healing-tests run <testPath>

# Run test suite
npx self-healing-tests suite <testDirectory>

# Show statistics
npx self-healing-tests stats

# Validate configuration
npx self-healing-tests validate-config
```

### Global Options

```bash
--verbose, -v              # Enable verbose logging
--quiet, -q               # Reduce output
--no-healing              # Disable healing
--auto-apply              # Auto-apply fixes
--confidence-threshold <n> # Set confidence threshold
--framework <name>        # Specify framework
--output-dir <dir>        # Set output directory
--gemini-api-key <key>    # Set API key
--model <model>           # Set AI model
```

### Examples

```bash
# Verbose run with auto-apply
npx self-healing-tests run ./test.ts --verbose --auto-apply

# Conservative healing
npx self-healing-tests suite ./tests --confidence-threshold 0.9

# Development mode
npx self-healing-tests run ./test.ts --verbose --no-healing
```

## Integration Patterns

### With Existing Test Suites

#### Jest Integration
```javascript
// jest.config.js
module.exports = {
  testRunner: 'self-healing-tests/jest-runner',
  // ... other config
};
```

#### GitHub Actions
```yaml
- name: Run Self-Healing Tests
  run: |
    npx self-healing-tests suite ./tests/ \\
      --confidence-threshold 0.8 \\
      --auto-apply \\
      --verbose
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

#### Pre-commit Hooks
```json
{
  "pre-commit": [
    "npx self-healing-tests validate-config",
    "npm run test:heal -- --confidence-threshold 0.9"
  ]
}
```

### Custom Framework Integration

```typescript
import { FrameworkAdapter } from 'self-healing-tests';

class CustomAdapter implements FrameworkAdapter {
  name = 'my-framework';

  async runTest(testPath: string, config: TestConfig) {
    // Your test execution logic
  }

  async captureScreenshot(): Promise<Buffer> {
    // Screenshot capture logic
  }

  async applyHealing(testPath: string, actions: HealingAction[]) {
    // Apply healing changes to test file
  }
}
```

## Monitoring and Debugging

### Cost Tracking
```typescript
const result = await framework.runTest('./test.ts');

if (result.healingResult?.cost) {
  console.log(`Healing cost: $${result.healingResult.cost.usd.toFixed(4)}`);
  console.log(`Tokens used: ${result.healingResult.cost.tokens}`);
}
```

### Debugging Failed Healing
```bash
# Run with maximum verbosity
DEBUG=* VERBOSE=true npx self-healing-tests run ./test.ts

# Check screenshots
ls -la test-results/screenshots/

# Review backup files
ls -la *.backup.*
```

### Healing History
```typescript
// Get overall statistics
const stats = await framework.getHealingStats();

console.log(`Success rate: ${stats.successfulHeals / stats.totalAttempts}%`);
console.log(`Average confidence: ${stats.averageConfidence}`);
console.log(`Total cost: $${stats.totalCost.usd}`);
```

## Best Practices

### 1. Start Conservative
- Begin with `confidenceThreshold: 0.8` or higher
- Use `autoApply: false` initially
- Review all healing suggestions manually

### 2. Gradual Automation
- Lower threshold as you gain confidence
- Enable auto-apply for high-confidence fixes
- Monitor costs and success rates

### 3. Test Design
- Write clear, descriptive tests
- Use semantic selectors when possible
- Add context comments for complex flows
- Avoid overly brittle selectors

### 4. Monitoring
- Track healing statistics regularly
- Set up cost alerts
- Review failed healing attempts
- Update confidence thresholds based on results

### 5. Team Workflow
- Share configuration across team
- Review healing changes in code review
- Document successful healing patterns
- Train team on healable test patterns

## Common Patterns

### E-commerce Tests
```typescript
test('should add item to cart', async ({ page }) => {
  // Navigate to product page
  await page.goto('/products/1');

  // Select product options (healable if UI changes)
  await page.selectOption('#size', 'large');
  await page.selectOption('#color', 'blue');

  // Add to cart (button text/selector may change)
  await page.click('button:has-text("Add to Cart")');

  // Verify cart update (counter format may change)
  await expect(page.locator('.cart-count')).toContainText('1');
});
```

### Form Tests
```typescript
test('should submit contact form', async ({ page }) => {
  await page.goto('/contact');

  // Form fields (IDs may change)
  await page.fill('#name', 'John Doe');
  await page.fill('#email', 'john@example.com');
  await page.fill('#message', 'Test message');

  // Submit button (design may change)
  await page.click('[type="submit"]');

  // Success message (text may change)
  await expect(page.locator('.success')).toBeVisible();
});
```

### Navigation Tests
```typescript
test('should navigate through menu', async ({ page }) => {
  await page.goto('/');

  // Main navigation (structure may change)
  await page.click('nav a:has-text("Products")');
  await page.click('.category-link:has-text("Electronics")');

  // Filter options (UI may be redesigned)
  await page.check('input[name="brand"][value="apple"]');

  // Results (layout may change)
  await expect(page.locator('.product-card')).toHaveCountGreaterThan(0);
});
```

## Next Steps

- Review [API Reference](./API.md) for detailed method documentation
- Check [Examples](../examples/) for more complex scenarios
- Set up [CI/CD Integration](./CICD.md) for automated healing
- Learn about [Advanced Features](./ADVANCED.md) for power users