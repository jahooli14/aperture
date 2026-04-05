# Setup Instructions

## Initial Setup

### 1. Fix NPM Permissions (if needed)

If you encounter npm permission errors, run:

```bash
sudo chown -R $(whoami) "/Users/$(whoami)/.npm"
```

Or clear npm cache:

```bash
npm cache clean --force
```

### 2. Install Dependencies

```bash
cd agentic-swarm
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=your_api_key_here
```

### 4. Build TypeScript

```bash
npm run build
```

### 5. Run Examples

```bash
# Basic usage
npm run dev examples/basic-usage.ts

# Custom tools
npm run dev examples/custom-tools.ts

# Parallel research
npm run dev examples/parallel-research.ts
```

## Development

### Run in watch mode
```bash
npm run dev
```

### Build for production
```bash
npm run build
npm start
```

### Run tests
```bash
npm test
```

## Verify Installation

Create a simple test file `test.ts`:

```typescript
import { OrchestratorAgent } from './src/index.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const agent = new OrchestratorAgent(apiKey);

console.log('Agentic Swarm initialized successfully!');
```

Run it:
```bash
npx tsx test.ts
```

## Troubleshooting

### Permission Errors
- Run: `sudo chown -R $(whoami) ~/.npm`
- Or: `npm cache clean --force`

### Module Not Found
- Ensure you ran `npm install`
- Check TypeScript is building: `npm run build`

### API Key Issues
- Verify `.env` file exists and contains valid key
- Check: `echo $ANTHROPIC_API_KEY`

### TypeScript Errors
- Update dependencies: `npm update`
- Clear cache: `rm -rf node_modules && npm install`

## Next Steps

Once setup is complete:
1. Read [QUICKSTART.md](./QUICKSTART.md) for usage guide
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system details
3. Explore [examples/](./examples/) for patterns
4. Create your first custom agent!
