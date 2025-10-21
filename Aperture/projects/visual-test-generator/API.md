# API Reference - Self-Healing Tests

Complete API documentation for `@aperture/self-healing-tests`

---

## Core Classes

### `SelfHealingDriver`

Main class for self-healing test automation.

#### Constructor

```typescript
new SelfHealingDriver(
  page: Page,
  config: SelfHealingConfig,
  testFile: string,
  testName: string
)
```

**Parameters**:
- `page` - Playwright Page instance
- `config` - Configuration object
- `testFile` - Path to test file (for tracking)
- `testName` - Name of the test (for tracking)

#### Methods

##### `click(selector, description)`

Click element with self-healing fallback.

```typescript
await driver.click(selector: string, description: string): Promise<void>
```

**Example**:
```typescript
await driver.click('#submit-btn', 'submit button')
```

##### `fill(selector, value, description)`

Fill input with self-healing fallback.

```typescript
await driver.fill(selector: string, value: string, description: string): Promise<void>
```

**Example**:
```typescript
await driver.fill('[name="email"]', 'user@example.com', 'email input')
```

##### `hover(selector, description)`

Hover over element with self-healing fallback.

```typescript
await driver.hover(selector: string, description: string): Promise<void>
```

**Example**:
```typescript
await driver.hover('.menu-item', 'dropdown menu')
```

##### `getRepairs()`

Get all repairs made during test run.

```typescript
driver.getRepairs(): TestRepair[]
```

**Returns**: Array of repairs

**Example**:
```typescript
const repairs = driver.getRepairs()
console.log(`Made ${repairs.length} repairs`)
```

##### `generateRepairReport()`

Generate and display repair report.

```typescript
await driver.generateRepairReport(): Promise<void>
```

**Example**:
```typescript
await driver.generateRepairReport()
// Outputs:
// 🔧 Self-Healing Report
//    Test: login test
//    Repairs: 2
//    ...
```

---

## Helper Functions

### `createSelfHealingDriver()`

Factory function to create driver instance.

```typescript
createSelfHealingDriver(
  page: Page,
  config: SelfHealingConfig,
  testFile: string,
  testName: string
): SelfHealingDriver
```

**Example**:
```typescript
const driver = createSelfHealingDriver(
  page,
  config,
  __filename,
  'my test'
)
```

---

## Configuration

### `SelfHealingConfig`

```typescript
interface SelfHealingConfig {
  geminiApiKey: string
  supabaseUrl: string
  supabaseKey: string
  autoApprove?: boolean
  autoApproveHighConfidence?: boolean
  confidenceThreshold?: number
  maxRetries?: number
  timeout?: number
  screenshotOnFailure?: boolean
  enableLogging?: boolean
}
```

**Fields**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `geminiApiKey` | string | **required** | Google Gemini API key |
| `supabaseUrl` | string | **required** | Supabase project URL |
| `supabaseKey` | string | **required** | Supabase anon key |
| `autoApprove` | boolean | `false` | Auto-approve all repairs |
| `autoApproveHighConfidence` | boolean | `false` | Auto-approve high confidence repairs |
| `confidenceThreshold` | number | `0.6` | Minimum confidence (0-1) |
| `maxRetries` | number | `3` | Max Gemini API retries |
| `timeout` | number | `5000` | Element timeout (ms) |
| `screenshotOnFailure` | boolean | `true` | Capture screenshot on failure |
| `enableLogging` | boolean | `true` | Enable console logging |

**Example**:
```typescript
const config: SelfHealingConfig = {
  geminiApiKey: process.env.VITE_GEMINI_API_KEY!,
  supabaseUrl: process.env.VITE_SUPABASE_URL!,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY!,
  confidenceThreshold: 0.7,
  enableLogging: true,
}
```

---

## Types

### `TestRepair`

```typescript
interface TestRepair {
  id: string
  testFile: string
  testName: string
  oldLocator: string
  newLocator: string
  newCoordinates?: { x: number; y: number }
  description: string
  screenshot: string  // base64
  timestamp: Date
  action: 'click' | 'fill' | 'hover' | 'scroll'
  fillValue?: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
  status: 'pending' | 'approved' | 'rejected'
  errorMessage: string
}
```

### `GeminiAction`

```typescript
interface GeminiAction {
  type: 'click_at' | 'hover_at' | 'type_text_at' | 'scroll_at'
  coordinates?: { x: number; y: number }
  text?: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
}
```

---

## Supabase Functions

### `saveRepair()`

```typescript
async function saveRepair(
  repair: TestRepair,
  config: SelfHealingConfig
): Promise<void>
```

### `getRepairs()`

```typescript
async function getRepairs(
  config: SelfHealingConfig,
  status?: 'pending' | 'approved' | 'rejected'
): Promise<TestRepair[]>
```

### `approveRepair()`

```typescript
async function approveRepair(
  repairId: string,
  config: SelfHealingConfig
): Promise<void>
```

### `rejectRepair()`

```typescript
async function rejectRepair(
  repairId: string,
  config: SelfHealingConfig
): Promise<void>
```

**Example**:
```typescript
import { getRepairs, approveRepair } from '@aperture/self-healing-tests'

// Get all pending repairs
const pending = await getRepairs(config, 'pending')

// Approve a repair
await approveRepair('repair-123', config)
```

---

## Gemini Client

### `GeminiClient`

Low-level Gemini API client.

#### Constructor

```typescript
new GeminiClient(apiKey: string)
```

#### Methods

##### `findElement()`

```typescript
async findElement(
  description: string,
  screenshot: Buffer,
  oldLocator: string,
  errorMessage: string
): Promise<GeminiComputerUseResponse>
```

##### `suggestAction()`

```typescript
async suggestAction(
  actionType: 'click' | 'fill' | 'hover' | 'scroll',
  description: string,
  screenshot: Buffer,
  fillValue?: string
): Promise<GeminiComputerUseResponse>
```

##### `retryWithExponentialBackoff()`

```typescript
async retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries?: number
): Promise<T>
```

---

## Environment Variables

```bash
# Required
VITE_GEMINI_API_KEY=your_key
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional
SELF_HEALING_AUTO_APPROVE=false
SELF_HEALING_AUTO_APPROVE_HIGH_CONFIDENCE=true
SELF_HEALING_CONFIDENCE_THRESHOLD=0.6
SELF_HEALING_MAX_RETRIES=3
SELF_HEALING_TIMEOUT=5000
SELF_HEALING_ENABLE_LOGGING=true
```

---

## Error Handling

### Common Errors

#### `Failed to analyze screenshot`
**Cause**: Gemini API error
**Fix**: Check API key, retry logic, rate limits

#### `Gemini confidence too low`
**Cause**: Element not found or ambiguous
**Fix**: Lower `confidenceThreshold` or improve element description

#### `Supabase error`
**Cause**: Database connection or table missing
**Fix**: Verify credentials, ensure table created

### Error Types

```typescript
try {
  await driver.click('#button', 'button')
} catch (error) {
  if (error.message.includes('Gemini API')) {
    // API error - check connectivity
  } else if (error.message.includes('confidence too low')) {
    // Element not found - manual intervention needed
  } else {
    // Other Playwright error
  }
}
```

---

## Advanced Usage

### Custom Retry Logic

```typescript
const client = new GeminiClient(apiKey)

const result = await client.retryWithExponentialBackoff(
  () => client.findElement(description, screenshot, locator, error),
  5  // Max 5 retries
)
```

### Direct Coordinate Clicking

```typescript
// Get coordinates from Gemini
const response = await gemini.findElement(...)

if (response.action.coordinates) {
  const { x, y } = response.action.coordinates
  const viewport = page.viewportSize()

  // Convert normalized to pixels
  const actualX = (x / 1000) * viewport.width
  const actualY = (y / 1000) * viewport.height

  await page.mouse.click(actualX, actualY)
}
```

---

## React Hooks (Web UI)

### `useRepairs()`

Zustand store for repair management.

```typescript
const {
  repairs,
  loading,
  error,
  fetchRepairs,
  approveRepair,
  rejectRepair
} = useRepairs()
```

**Methods**:
- `fetchRepairs(config, status?)` - Load repairs
- `approveRepair(id, config)` - Approve repair
- `rejectRepair(id, config)` - Reject repair

**Example**:
```typescript
import { useRepairs } from '@aperture/self-healing-tests'

function MyComponent() {
  const { repairs, fetchRepairs } = useRepairs()

  useEffect(() => {
    fetchRepairs(config, 'pending')
  }, [])

  return <div>{repairs.length} pending repairs</div>
}
```

---

## TypeScript Support

Fully typed with TypeScript. Import types:

```typescript
import type {
  TestRepair,
  SelfHealingConfig,
  GeminiAction,
  GeminiComputerUseResponse,
} from '@aperture/self-healing-tests'
```

---

## Next Steps

- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **Integration**: [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)
- **Examples**: `examples/` folder
