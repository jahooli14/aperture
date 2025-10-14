# 🛠️ Setup Guide

Complete setup instructions for the Self-Healing Testing Framework.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** (comes with Node.js)
- **Google AI Studio account** (for Gemini API key)

## Step 1: Install Dependencies

```bash
cd projects/self-healing-tests
npm install
```

This will install:
- Google Gemini AI SDK
- Playwright browser automation
- TypeScript and build tools
- CLI utilities and logging

## Step 2: Get Google Gemini API Key

### Option 1: Google AI Studio (Recommended)

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key (starts with `AIzaSy...`)

**Advantages:**
- Free quota included
- Quick setup
- Good for development and small projects

### Option 2: Google Cloud Vertex AI (Enterprise)

1. Create a Google Cloud Project
2. Enable Vertex AI API
3. Create a service account key
4. Set up authentication

**Advantages:**
- Higher quotas and SLAs
- Better for production use
- More control over data location

## Step 3: Configuration

### Create Environment File

```bash
cp .env.example .env
```

### Basic Configuration

Edit `.env` file:

```env
# Required: Your Gemini API key
GEMINI_API_KEY=AIzaSyC-your-key-here

# Recommended settings for getting started
ENABLE_HEALING=true
AUTO_APPLY=false
CONFIDENCE_THRESHOLD=0.7
VERBOSE=true
```

### Advanced Configuration

```env
# Framework settings
FRAMEWORK=playwright
TEST_TIMEOUT=30000
RETRY_COUNT=1

# Healing behavior
MAX_HEALING_ATTEMPTS=3
SCREENSHOT_ON_FAILURE=true
OUTPUT_DIR=./test-results

# AI model settings
GEMINI_MODEL=gemini-2.5-pro
```

## Step 4: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript and prepares the CLI.

## Step 5: Validate Setup

```bash
npm run test:heal validate-config
```

You should see:
```
✅ API configuration found
✅ Playwright framework configured
✅ Output directory accessible: ./test-results
```

## Step 6: Run Example

```bash
npm run test:example
```

This runs the basic example to verify everything works.

## Framework-Specific Setup

### Playwright (Default)

Playwright is included and configured by default. For additional browsers:

```bash
npx playwright install
```

### Future Framework Support

Currently only Playwright is supported. Cypress and Puppeteer support is planned.

## Environment Configurations

### Development Setup

```env
NODE_ENV=development
VERBOSE=true
CONFIDENCE_THRESHOLD=0.6
AUTO_APPLY=false
DEBUG_BROWSER=true
```

### Production Setup

```env
NODE_ENV=production
VERBOSE=false
CONFIDENCE_THRESHOLD=0.8
AUTO_APPLY=false
MAX_HEALING_ATTEMPTS=2
```

### CI/CD Setup

```env
NODE_ENV=ci
VERBOSE=true
CONFIDENCE_THRESHOLD=0.9
AUTO_APPLY=true
MAX_HEALING_ATTEMPTS=1
```

## Directory Structure

After setup, your project structure will be:

```
self-healing-tests/
├── src/                    # Source code
├── dist/                   # Built JavaScript
├── examples/               # Example tests
├── test-results/          # Screenshots and results
├── node_modules/          # Dependencies
├── .env                   # Your configuration
└── package.json           # Project manifest
```

## Testing Your Setup

### 1. Validate Configuration

```bash
npx self-healing-tests validate-config
```

### 2. Run Sample Test

```bash
npx self-healing-tests run ./examples/sample-tests/login.test.ts
```

### 3. Check Statistics

```bash
npx self-healing-tests stats
```

## Common Setup Issues

### Issue: API Key Not Working

**Error:** "No API key or Vertex project configured"

**Solutions:**
- Verify API key is correct in `.env` file
- Check API key has not expired
- Ensure no extra spaces around the key

### Issue: Build Fails

**Error:** TypeScript compilation errors

**Solutions:**
```bash
# Clean build
npm run clean
npm run build

# Check TypeScript version
npx tsc --version

# Update dependencies
npm update
```

### Issue: Playwright Issues

**Error:** Browser not found

**Solutions:**
```bash
# Install Playwright browsers
npx playwright install

# Install system dependencies (Linux)
npx playwright install-deps
```

### Issue: Permission Errors

**Error:** Cannot create output directory

**Solutions:**
```bash
# Create directory manually
mkdir -p test-results

# Check permissions
ls -la test-results
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Google AI Studio API key |
| `VERTEX_PROJECT_ID` | No | - | Google Cloud project (alternative to API key) |
| `ENABLE_HEALING` | No | `true` | Enable self-healing features |
| `AUTO_APPLY` | No | `false` | Auto-apply high-confidence fixes |
| `CONFIDENCE_THRESHOLD` | No | `0.7` | Minimum confidence for fixes (0-1) |
| `MAX_HEALING_ATTEMPTS` | No | `3` | Max healing attempts per test |
| `FRAMEWORK` | No | `playwright` | Testing framework |
| `TEST_TIMEOUT` | No | `30000` | Test timeout in milliseconds |
| `OUTPUT_DIR` | No | `./test-results` | Output directory |
| `VERBOSE` | No | `false` | Enable verbose logging |
| `SCREENSHOT_ON_FAILURE` | No | `true` | Capture failure screenshots |
| `GEMINI_MODEL` | No | `gemini-2.5-pro` | AI model to use |

## Next Steps

After setup is complete:

1. **Read the [Usage Guide](./USAGE.md)** - Learn how to write healable tests
2. **Check [Examples](../examples/)** - See real test scenarios
3. **Review [API Reference](./API.md)** - Understand the programmatic interface
4. **Configure [CI/CD](./CICD.md)** - Set up automated healing

## Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review the [FAQ](./FAQ.md)
3. Look at [example configurations](../examples/)

For additional support, create an issue in the project repository.