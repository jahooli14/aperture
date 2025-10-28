# 🔄 Self-Healing Testing Framework

A revolutionary testing framework powered by **Google's Gemini 2.5 Computer Use model** (`gemini-2.5-computer-use-preview-10-2025`) that automatically detects, analyzes, and fixes broken tests through AI-powered visual understanding and browser automation capabilities.

## ✨ Features

- **🤖 AI-Powered Healing**: Uses Google Gemini Computer Use to visually analyze test failures
- **📸 Screenshot Analysis**: Captures and analyzes UI changes that break tests
- **🔧 Automatic Fixes**: Suggests and applies fixes for common test failures
- **🎯 Smart Confidence Scoring**: Only applies high-confidence fixes automatically
- **📊 Cost Tracking**: Monitors API usage and costs
- **🛡️ Safe Rollbacks**: Creates backups before applying changes
- **📈 Healing Statistics**: Tracks success rates and patterns

## 🚀 Quick Start

### 1. Installation

```bash
cd projects/self-healing-tests
npm install
```

### 2. Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Google AI Studio API key:

```env
GEMINI_API_KEY=your_api_key_here
ENABLE_HEALING=true
AUTO_APPLY=false
CONFIDENCE_THRESHOLD=0.7
```

### 3. Get Your API Key

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get your free API key.

### 4. Build the Project

```bash
npm run build
```

### 5. Run Tests

```bash
# Run a single test with healing
npm run test:heal run ./examples/sample-tests/login.test.ts

# Run a test suite with healing
npm run test:heal suite ./examples/sample-tests

# Validate your configuration
npm run test:heal validate-config
```

## 📖 How It Works

### 1. Test Execution
- Runs your existing Playwright tests normally
- Captures screenshots and context on failures
- Collects error messages, stack traces, and DOM state

### 2. AI Analysis
- Sends failure data to Gemini 2.5 Computer Use model
- AI visually analyzes screenshots using browser automation capabilities
- Understands UI changes through visual recognition and element positioning
- Generates specific, actionable fixing suggestions with confidence scores

### 3. Intelligent Healing
- Evaluates fix suggestions by confidence score
- Applies high-confidence fixes automatically (if enabled)
- Requests human approval for uncertain fixes
- Creates backups before making changes

### 4. Verification
- Re-runs tests to verify fixes work
- Rolls back changes if fixes don't work
- Tracks healing success rates and costs

## 🛠️ Usage Examples

### Basic Usage

```typescript
import { createFramework } from './src/index.js';

const framework = createFramework({
  framework: 'playwright',
  enableHealing: true,
  confidenceThreshold: 0.8,
  autoApply: false
});

// Run single test
const result = await framework.runTest('./tests/login.test.ts');

// Run test suite
const suite = await framework.runTestSuite('./tests/');
```

### CLI Usage

```bash
# Run with custom settings
npx self-healing-tests run ./tests/login.test.ts \\
  --confidence-threshold 0.8 \\
  --auto-apply \\
  --verbose

# Run in different environments
NODE_ENV=production npx self-healing-tests suite ./tests/

# Get healing statistics
npx self-healing-tests stats
```

## 📋 Common Healing Scenarios

### 1. Selector Changes
**Problem**: `#login-btn` changed to `.login-button`
**Solution**: AI detects visual button, suggests new selector

### 2. Timing Issues
**Problem**: Element loads slower than expected
**Solution**: Adds appropriate waits or retries

### 3. Text Changes
**Problem**: "Submit" button changed to "Send"
**Solution**: Updates text-based selectors

### 4. Layout Changes
**Problem**: Element moved to different position
**Solution**: Finds element in new location

### 5. Flow Modifications
**Problem**: New step added to checkout process
**Solution**: Adds missing interaction steps

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | - | Google AI Studio API key (required) |
| `ENABLE_HEALING` | `true` | Enable self-healing capabilities |
| `AUTO_APPLY` | `false` | Auto-apply high-confidence fixes |
| `CONFIDENCE_THRESHOLD` | `0.7` | Minimum confidence for healing (0-1) |
| `MAX_HEALING_ATTEMPTS` | `3` | Maximum healing attempts per test |
| `OUTPUT_DIR` | `./test-results` | Output directory for screenshots |
| `VERBOSE` | `false` | Enable detailed logging |

### Configuration Profiles

```typescript
// Development - verbose, lower threshold
NODE_ENV=development

// Production - conservative, higher threshold
NODE_ENV=production

// CI/CD - automated, high confidence only
NODE_ENV=ci
```

## 📊 Cost Management

### Estimated Costs (Google AI Studio - Computer Use Model)

- **Simple selector fix**: ~$0.001
- **Complex flow analysis**: ~$0.005
- **With screenshot analysis**: +~$0.002-0.003

### Cost Controls

- Set `MAX_COST_LIMIT` to control spending
- Monitor costs with `npx self-healing-tests stats`
- Use confidence thresholds to reduce API calls

## 🏗️ Architecture

```
src/
├── core/                  # Core framework logic
│   ├── gemini-agent.ts   # AI integration
│   ├── healing-engine.ts # Healing orchestration
│   └── test-runner.ts    # Test execution
├── adapters/             # Framework adapters
│   └── playwright.ts     # Playwright integration
├── utils/                # Utilities
│   ├── logger.ts        # Logging system
│   └── screenshot.ts    # Screenshot management
└── types/               # TypeScript definitions
    └── index.ts         # Core types
```

## 🔧 Development

### Building

```bash
npm run build        # Build TypeScript
npm run dev         # Watch mode
npm run type-check  # Type checking only
```

### Testing

```bash
npm run test:example    # Run basic example
npm run lint           # ESLint
```

### Adding Framework Support

1. Create adapter in `src/adapters/`
2. Implement `FrameworkAdapter` interface
3. Add to `test-runner.ts`
4. Update configuration types

## 🤝 Contributing

### Development Setup

1. Clone and install dependencies
2. Copy `.env.example` to `.env`
3. Add your Gemini API key
4. Run `npm run build`
5. Test with `npm run test:example`

### Adding Healing Patterns

1. Add new `HealingActionType` to types
2. Implement in adapter's `applyHealing` method
3. Update Gemini prompts if needed
4. Add tests and examples

## 📚 API Reference

### Core Classes

- **`SelfHealingTestFramework`**: Main framework interface
- **`GeminiAgent`**: AI analysis and suggestion generation
- **`HealingEngine`**: Orchestrates healing workflow
- **`PlaywrightAdapter`**: Playwright integration

### Key Methods

```typescript
// Run single test with healing
runTest(testPath: string): Promise<TestResult>

// Run test suite with healing
runTestSuite(testDir: string): Promise<TestSuite>

// Get healing statistics
getHealingStats(): Promise<HealingStats>
```

## 🚨 Safety Features

- **Backup Creation**: Original tests backed up before changes
- **Confidence Scoring**: Only high-confidence fixes applied automatically
- **Human Approval**: Manual review for uncertain fixes
- **Rollback Capability**: Undo changes if fixes don't work
- **Cost Limits**: Prevent runaway API usage

## 🔬 Advanced Usage

### Custom Prompts

```typescript
// Customize AI analysis prompts
const framework = createFramework({
  promptTemplatesDir: './custom-prompts'
});
```

### Healing History

```typescript
// Track healing patterns over time
const stats = await framework.getHealingStats();
console.log(`Success rate: ${stats.healingRate}%`);
```

## 🆘 Troubleshooting

### Common Issues

1. **API Key Not Working**: Ensure key is valid and has quota
2. **No Healing Suggestions**: Lower confidence threshold
3. **Costs Too High**: Increase confidence threshold
4. **Tests Still Failing**: Check backup files for rollback

### Debug Mode

```bash
DEBUG_BROWSER=true VERBOSE=true npm run test:heal run ./test.ts
```

## 📄 License

MIT License - see LICENSE file for details

## 🌟 What's Next

- **Support for Cypress and Puppeteer**
- **Visual regression healing**
- **API endpoint change detection**
- **Team collaboration features**
- **Advanced cost optimization**

---

**Made with ❤️ using Google Gemini Computer Use**