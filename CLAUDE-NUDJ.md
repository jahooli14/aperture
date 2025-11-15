# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Monorepo Development Guidelines

> **Project Foundation**: Based on next-forge template by haydenbleasel - modern, production-ready Next.js foundation.
> **Last Updated**: 2025-01-29 - Application-specific documentation reference system, VS Code Tasks integration, enhanced development workflow, smart port detection, comprehensive architectural documentation

## Prerequisites
- **Node.js**: >= 20.0.0
- **Package Manager**: PNPM v9.12.3 (exact version)
- **OS**: macOS, Linux, or Windows with WSL

```bash
npm install -g pnpm@9.12.3
pnpm install
# Setup environment variables (see Environment Variables section)
```

## Monorepo Structure

### Root Level
- **Package Manager**: PNPM workspaces (v9.12.3)
- **Build System**: Turbo (2.2.3) with persistent dev tasks
- **Registry**: GitHub Package Registry for `@nudj-digital` packages
- **Catalog System**: Centralized version management via catalog references
- **Patches**: `patches/` directory (oauth4webapi@2.10.4)
- **Overrides**: @auth/core → 0.0.0-manual.e9863699
- **Development Tools**: VS Code tasks integration, smart port detection
- **Scripts**: Automated API management (`dev-with-api.mjs`, `status.sh`)

### Key Applications

| App | Purpose | Port | Schema | Local API Support |
|-----|---------|------|--------|------------------|
| **api** | Core backend API service | 3000 | OpenAPI specs (admin.json, integration.json) | N/A (is the API) |
| **user** | User app UI showcase, Nudj Lite V2, User App | 3001 | `/packages/api/integration/schema.ts` | ✅ `dev:with-api` |
| **admin** | Main AI app with chat/gamification, Admin App | 4000 | `/packages/api/admin/schema.ts` | ✅ `dev:with-api` |
| **mcp-server** | Model Context Protocol server | 4010 | - | ✅ `dev:with-api` |
| **docs** | Complete platform documentation with interactive API playground | 3004 | Mintlify framework | - |

> 📋 **For detailed information** about each application, see the [Application-Specific Documentation](#application-specific-documentation) section below.

### Shared Packages
- **API**: Auto-generated clients (admin/, integration/, public/)
- **Database** (`packages/database/CLAUDE.md`): MongoDB schemas, collections, migrations
- **Design System**: ShadCN/Radix UI components
- **Config**: TypeScript, Tailwind, Next.js, ESLint
- **Infrastructure**: Auth, Database, Analytics, Feature Flags

## Application-Specific Documentation

Each application in this monorepo has its own detailed CLAUDE.md file with specific guidelines, architectural details, and development patterns. Always consult the relevant app-specific documentation for detailed information.

### 🔥 Core Backend Services

#### API Application (`apps/api/CLAUDE.md`)
- **Purpose**: Core backend API service with tRPC v11, multi-tenant architecture
- **Contains**: Authentication flows, database patterns, API versioning, deployment config
- **Key Topics**: OpenAPI generation, Redis caching, MongoDB queries, error handling
- **When to Use**: Working with backend APIs, authentication, database operations, server deployment
- **Critical Info**: Multi-layer auth system, organization scoping, performance optimization

#### Database Package (`packages/database/CLAUDE.md`)
- **Purpose**: MongoDB schema definitions, collection management, and migrations
- **Contains**: Complete schema index, collection names, model interfaces, migration scripts
- **Key Topics**: MongoDB collections (v2 versions), DTO models, store models, schema validation
- **When to Use**: Looking up database schemas, understanding data models, working with collections
- **Critical Info**: Uses rewards_v2, reward_assets_v2, achievements_v2 collections

#### MCP Server (`apps/mcp-server/CLAUDE.md`)
- **Purpose**: Model Context Protocol server for AI tool integration
- **Contains**: Tool definitions, agent filtering, Redis caching, comprehensive testing
- **Key Topics**: 10 unified tools, agent-based filtering, authentication patterns, debugging
- **When to Use**: AI integration, tool development, MCP protocol work, agent configuration
- **Critical Info**: Tool consolidation (92% token reduction), agent types (Service/Planner/Builder)

### 🎯 Frontend Applications

#### Admin App (`apps/admin/CLAUDE.md`)
- **Purpose**: Primary admin interface with AI chat agents and voice capabilities
- **Contains**: AI agents, voice features, TipTap editor, admin workflows, testing patterns
- **Key Topics**: MCP integration, voice API, feature flags, authentication, deployment
- **When to Use**: Admin interface development, AI chat features, voice integration, admin workflows
- **Critical Info**: Port 4000 HTTPS, MCP tool naming (snake_case), voice browser compatibility

#### User App (`apps/user/CLAUDE.md`)
- **Purpose**: User-facing gamification interface with 3D animations and challenge system
- **Contains**: Challenge wizard, 3D animations, accessibility patterns, performance optimization
- **Key Topics**: Nudj Lite V2, action registry, GPU acceleration, responsive design
- **When to Use**: User interface development, gamification features, 3D animations, accessibility
- **Critical Info**: 60fps performance targets, Playwright testing (30s timeout), theme system

#### Creator Frontend (`apps/creator-frontend/CLAUDE.md`)
- **Purpose**: Nudj Templates development with client-first architecture
- **Contains**: React Query patterns, design system, component standards, responsive design
- **Key Topics**: Client components, API integration hooks, loading states, UI/UX standards
- **When to Use**: Template development, client-side data fetching, component creation
- **Critical Info**: Client-first philosophy, useIntegrationApi hook, gradient design system

#### Documentation (`apps/docs/CLAUDE.md`)
- **Purpose**: Mintlify-based documentation platform with auto-generated API docs
- **Contains**: OpenAPI integration, sync pipeline, Mintlify configuration, content guidelines
- **Key Topics**: API doc generation, navigation structure, MDX components, deployment
- **When to Use**: Documentation updates, API reference maintenance, content creation
- **Critical Info**: 157+ auto-generated endpoints, 3-script sync pipeline, Mintlify hosted service

### 📋 Admin Panel Specialized Areas

#### Admin Route Group (`apps/admin/app/(admin)/CLAUDE.md`)
- **Purpose**: Admin panel architecture and dual-layout system
- **Contains**: Route organization, AI agents, layout patterns, navigation
- **When to Use**: Admin route development, layout changes, navigation structure

#### Admin Components (`apps/admin/app/(admin)/admin/components/CLAUDE.md`)
- **Purpose**: Reusable admin UI components and patterns
- **Contains**: Component library, hooks, utilities, consistency patterns
- **When to Use**: Creating admin components, maintaining UI consistency

#### User Management (`apps/admin/app/(admin)/admin/users/CLAUDE.md`)
- **Purpose**: User administration, analytics, and lifecycle management
- **Contains**: User CRUD, progress tracking, analytics, reward management
- **When to Use**: User administration features, analytics development, user workflows

#### Engagement Features (`apps/admin/app/(admin)/admin/engagement/CLAUDE.md`)
- **Purpose**: Core gamification mechanics (challenges, rewards, achievements)
- **Contains**: Challenge creation, reward systems, analytics, AI content creation
- **When to Use**: Gamification feature development, challenge workflows, reward systems

#### Gamification System (`apps/admin/app/(admin)/admin/gamification/CLAUDE.md`)
- **Purpose**: Points/XP, leaderboards, streaks, referral programs
- **Contains**: Currency systems, competitive elements, progression tracking
- **When to Use**: Gamification mechanics, leaderboard development, progression systems

#### Settings & Configuration (`apps/admin/app/(admin)/admin/settings/CLAUDE.md`)
- **Purpose**: Organization setup, integrations, feature flags, multi-language
- **Contains**: Platform configuration, third-party integrations, team management
- **When to Use**: Settings development, integration work, configuration management

### 🔍 Quick Reference Guide

#### For API Development
1. Start with **`apps/api/CLAUDE.md`** for backend architecture
2. Check **`apps/mcp-server/CLAUDE.md`** for AI tool integration
3. Review **`apps/docs/CLAUDE.md`** for API documentation updates

#### For Frontend Development
1. **Admin Features**: `apps/admin/CLAUDE.md` + specific admin area docs
2. **User Features**: `apps/user/CLAUDE.md` for user-facing components
3. **Templates**: `apps/creator-frontend/CLAUDE.md` for template development

#### For Specific Features
- **Authentication**: API app docs (multi-layer auth system)
- **AI Integration**: MCP server docs (tool definitions, agents)
- **Voice Features**: Admin app docs (OpenAI integration, browser compatibility)
- **3D Animations**: User app docs (GPU acceleration, performance targets)
- **Documentation**: Docs app (OpenAPI sync, content guidelines)
- **Testing**: Each app has specific testing patterns and timeouts

#### Cross-Application Workflows
- **API Changes**: Update API → Generate clients → Update docs → Test frontends
- **Feature Development**: Check feature flags → Update relevant app docs → Test across apps
- **Authentication Flow**: API authentication → Frontend integration → MCP tool access
- **Content Creation**: Admin interface → User experience → Template customization

### 📝 Documentation Maintenance

When working on features that span multiple applications:
1. **Update relevant app-specific CLAUDE.md files** with new patterns or changes
2. **Cross-reference** between applications when features interact
3. **Keep this root CLAUDE.md** updated with major architectural changes
4. **Verify integration points** between applications are documented

This application reference system ensures developers can quickly find the right documentation for their specific task while understanding how different parts of the system interact.

## VS Code Tasks Integration

### Quick Start with VS Code
Press `Cmd+Shift+P` → "Tasks: Run Task" and choose from:

#### Individual Services
- **🔥 API Server** - Start API backend service (port 3000)
- **⚙️ Admin App (with local API)** - Admin interface with local API integration
- **⚙️ Admin App (standalone)** - Admin interface using dev API
- **👥 User App (with local API)** - User-facing app with local API integration
- **👥 User App (standalone)** - User-facing app using dev API
- **🤖 MCP Server** - Model Context Protocol server with local API

#### Orchestrated Workflows
- **🎯 Frontend Apps** - Start API, then both frontend apps with local API
- **🌐 Full Stack** - Start all services (API + Admin + User + MCP)

#### Database Operations
- **🔼 DB Migrate Up** - Run pending database migrations
- **🔽 DB Migrate Down** - Rollback the last database migration
- **✨ DB Create Migration** - Create a new database migration file

#### Utilities
- **🔄 Wait for API** - Health check utility for API readiness
- **📡 Generate Client** - Generate API client from local API (auto-starts API if needed)
- **🧹 Kill All Ports** - Kill all processes on ports 3000, 3001, 4000, 4010

### Smart Port Detection
The development system includes intelligent port management:
- **Auto-cleanup**: Tasks automatically kill existing processes before starting
- **Health checks**: Verifies API availability before starting dependent services
- **Fallback routing**: Uses dev domains when local services aren't available
- **Status monitoring**: Check service status with `./scripts/status.sh`

## Essential Commands

### Global (from root)
```bash
pnpm run build          # Build all
pnpm run lint           # Lint all
pnpm run test           # Test all
pnpm run lint:deps      # Check dependencies
```

### Local Development with API
```bash
# Start apps with local API integration (recommended)
cd apps/admin && pnpm dev:with-api   # Admin App + auto-starts API
cd apps/user && pnpm dev:with-api            # User App + auto-starts API
cd apps/mcp-server && pnpm dev:with-api       # MCP Server + auto-starts API

# Start API only
cd apps/api && pnpm dev                        # Port 3000 (Core backend)

# Generate API clients (always uses local API)
cd packages/api && pnpm generate-client        # Auto-starts API if needed
```

### Standalone Development (uses dev API)
```bash
# Nudj AI Legacy (Admin App)
cd apps/admin && pnpm dev            # Port 4000 (HTTPS)
cd apps/admin && pnpm test           # Vitest
cd apps/admin && pnpm playwright     # E2E tests

# ShadCN (User App)
cd apps/user && pnpm dev                    # Port 3001
cd apps/user && timeout 30s pnpm test       # ALWAYS use timeout!

# Nudj Templates  
cd apps/nudj-templates && pnpm dev            # Port 3001
cd apps/nudj-templates && timeout 30s pnpm test  # ALWAYS use timeout!

# Docs
cd apps/docs && pnpm dev                      # Port 3004 (Mintlify dev server)
cd apps/docs && pnpm sync                     # Sync OpenAPI specs & regenerate all
cd apps/docs && pnpm generate                 # Generate API docs from OpenAPI specs
cd apps/docs && pnpm generate:mdx             # Generate MDX files only
cd apps/docs && pnpm generate:nav             # Update navigation structure
cd apps/docs && pnpm lint                     # Check for broken links
```

### Service Management
```bash
# Check all service status
./scripts/status.sh

# Kill all development processes
lsof -ti:3000,3001,4000,4010 | xargs kill -9

# Environment variable for local API integration
export NUDJ_LOCAL_API=true  # Routes apps to use https://localhost:3000
```

## Code Style & Patterns

### TypeScript
- **NO** `any` types - use `unknown`
- Interfaces over types for props
- Strict type safety enabled

### React/Next.js
- Server Components by default
- Minimal `'use client'` directives
- Handler prefix: `handleClick`, `handleSubmit`
- File size: Keep under 200-300 lines

### Naming Conventions
- Components: PascalCase (`Button.tsx`)
- Directories: kebab-case (`challenge-card/`)
- Hooks: camelCase with `use` prefix
- Utils: camelCase (`formatDate`)

### Architecture
- Feature-based organization
- React Query for data fetching
- Zod for validation
- ShadCN/Radix UI components
- NextAuth.js v5 beta

### Package Dependencies
- **ALWAYS use catalog references**: When adding dependencies, use `catalog:` instead of version numbers
- **Check pnpm-workspace.yaml**: Verify if the package exists in the catalog before adding
- **Shared configurations**: Use shared configs from `@nudj-digital/next-config` (e.g., `withSentry`, `withLogtail`)
- **No duplicate configs**: Don't redefine configurations that already exist in shared packages
- Example: Use `"@sentry/nextjs": "catalog:"` NOT `"@sentry/nextjs": "^8.37.1"`

## Biome Linting (MANDATORY)

```bash
# After editing ANY file:
cd apps/admin && pnpm biome check <file-path>

# Fix issues:
cd apps/mcp-server && pnpm run lint:fix

# IMPORTANT: Before committing or pushing code
cd apps/<app-name> && pnpm lint
# Look for actual ERRORS (marked with ×) vs warnings (marked with !)
# Errors MUST be fixed as they will break the build
# Example: "× Formatter would have printed..." indicates formatting errors
```

### Common Issues
- No `any` types
- No non-null assertions (!)
- No array index as React keys
- Add `type="button"` to buttons
- Use `for...of` not `forEach`
- **Formatting errors**: Look for `×` symbol in lint output - these are build-breaking errors that must be fixed

## Testing

### Framework
- **Unit**: Vitest with JSDOM
- **E2E**: Playwright
- **Coverage**: 80% for new code

### Running Tests
```bash
# ALWAYS use timeout for Vitest!
timeout 30s pnpm run test
pnpm run test:watch
pnpm run test:coverage
pnpm run test:e2e
```

## Development Architecture

### Turbo Configuration
- **Build Pipeline**: Dependency-aware builds with caching
- **Dev Mode**: Persistent tasks with cache disabled for development
- **Global Dependencies**: All `.env.*local` files trigger rebuilds
- **Migration Tasks**: MongoDB URI-aware with cache disabled
- **Outputs**: Next.js builds exclude cache directory from outputs

### PNPM Workspace Structure
```
monorepo/
├── apps/
│   ├── api/              # Core backend API (port 3000)
│   ├── user/           # User-facing app (port 3001)
│   ├── admin/   # Admin interface (port 4000)
│   ├── mcp-server/       # Model Context Protocol (port 4010)
│   ├── nudj-templates/   # Gamification UI (port 3001)
│   └── docs/             # Documentation platform (port 3004)
├── packages/
│   ├── api/              # Auto-generated clients (admin/, integration/, public/)
│   ├── design-system/    # ShadCN/Radix UI components
│   ├── config/           # Shared configurations (TS, Tailwind, ESLint)
│   ├── database/         # Database models and migrations
│   └── services/         # Shared business logic and utilities
└── scripts/
    ├── dev-with-api.mjs  # Smart API management for local development
    ├── status.sh         # Service status checker with health checks
    └── ensure-api-running.sh  # API startup automation
```

### Data Flow Architecture
1. **Frontend Apps** (user, admin) → **API App** (port 3000)
2. **API App** → **MongoDB** (via DATABASE_URL/MONGODB_URI)
3. **MCP Server** → **API App** (Model Context Protocol integration)
4. **Local Development**: `NUDJ_LOCAL_API=true` routes all apps to localhost:3000
5. **Production**: Apps route to production API endpoints

### Authentication Flow
- **NextAuth.js v5 beta**: Unified auth across all frontend apps
- **Session Management**: Server-side session handling
- **API Authentication**: Token-based auth for API access
- **Local Development**: Simplified auth flow for localhost

## Environment Variables

### Core
- `DATABASE_URL` / `MONGODB_URI` - Database connection
- `NEXT_PUBLIC_API_URL` - API endpoint for frontend apps
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET` - Authentication configuration
- `NUDJ_LOCAL_API` - When `true`, routes apps to https://localhost:3000

### Services
- **AI**: `OPENAI_API_KEY`, `AZURE_OPEN_AI_KEY`
- **Analytics**: `NEXT_PUBLIC_POSTHOG_KEY`
- **OAuth**: Google, Instagram, Spotify, YouTube credentials
- **MCP**: `MCP_SERVICE_AUTH_KEY`

## Feature Flags

```tsx
// Client-side
import { FF } from 'components/feature/ff';
import { FeatureKeyEnum } from '@nudj-digital/models';

<FF feature={FeatureKeyEnum.SomeFeature}>
  <FeatureContent />
</FF>

// Server-side
import { isFeatureEnabled } from 'lib/is-feature-enabled';
const isEnabled = await isFeatureEnabled(FeatureKeyEnum.SomeFeature);
```

## Critical Memories
- **Never** use hardcoded domains - throw errors instead
- Restart server after builds
- MCP config: `~/.claude.json`
- Only build when asked - prefer typecheck
- **ALWAYS** use 30s timeout for Vitest
- Challenge wizard: Show Continue button immediately after prediction
- Video progress: Only re-render on second changes, not 100ms updates
- **Docs**: Mintlify platform requires subdomain in API playground for authentication
- **API Changes**: GitHub Actions auto-sync docs when OpenAPI specs change
- **Migration**: HelpKit content migrated to Mintlify with improved structure and search
- **VS Code Tasks**: Use tasks for development - they handle port management automatically
- **Local API**: Always use `dev:with-api` scripts for local development to ensure API integration
- **Port Conflicts**: VS Code tasks automatically kill conflicting processes
- **Service Health**: Check `./scripts/status.sh` before troubleshooting issues
- **API Client Generation**: Always runs against local API for accurate type generation

## Platform Core Concepts

### Nudj = Gamified Community Engagement Platform
B2B SaaS for creating branded spaces where companies engage users through gamification.

### User Loop
1. Join Community → 2. Complete Challenges → 3. Earn Points/XP → 4. Get Rewards

### Key Entities
- **Communities**: Branded spaces with themes, members, challenges
- **Challenges**: Quest collections of Actions
- **Actions**: Granular tasks (questions, social media, interactions)
- **Rewards**: Assets (owned) vs Entries (chances to win)
- **Currency**: Points (spendable) vs XP (status/leveling)

## API Documentation

### Docs App (Port 3004)
- **Location**: `apps/docs`
- **Framework**: Mintlify platform with OpenAPI integration
- **Migration**: Recently migrated from HelpKit to Mintlify (January 2025)
- **Content Types**:
  - Platform documentation (Getting Started, User Guide, Admin Guide)
  - Auto-generated API docs from OpenAPI specs (200+ endpoints)
  - Enterprise features and integrations
  - Troubleshooting and best practices
- **APIs Documented**: 
  - Integration API (157+ endpoints)
  - Admin API (80+ endpoints) 
  - Analytics API (5+ endpoints)
- **Key Commands**:
  - `pnpm dev` - Run development server (port 3004)
  - `pnpm sync` - Sync OpenAPI specifications and generate MDX files
  - `pnpm generate` - Generate API documentation from OpenAPI specs
  - `pnpm generate:mdx` - Generate MDX files only
  - `pnpm generate:nav` - Update navigation structure
  - `pnpm lint` - Check for broken links
- **Automation**: 
  - GitHub Actions sync on merge to main (`.github/workflows/sync-api-docs.yml`)
  - PR preview comments for documentation impact (`.github/workflows/docs-pr-check.yml`)
  - Weekly drift reconciliation checks (`.github/workflows/docs-reconciliation.yml`)
  - Auto-generation of 200+ MDX files from OpenAPI specs
  - Navigation structure updates via `update-navigation.js`
  - Use `[skip-docs]` in commit message to skip documentation generation
- **Deployment**: nudj-digital.mintlify.app
- **Authentication**: Enhanced subdomain-based authentication with multiple header support

## App-Specific Guidelines

### Nudj Templates (Port 3001)
- **Purpose**: User-facing gamification with Pokémon-style cards
- **UI**: Local ShadCN components (NOT shared package)
- **Features**: Challenge wizard, video integration, visual keys system
- **Testing**: ALWAYS use `timeout 30s pnpm run test`

### Challenge Wizard System
- **Architecture**: Registry-based for easy extensibility
- **Action Types**: Quiz, Prediction, Video Interaction, Quick Time, Estimation
- **Video Modes**: Standard (auto-pause) vs Continuous (uninterrupted)
- **XP System**: Base rewards + speed/accuracy bonuses

### Adding New Actions (3 Steps)
```typescript
// 1. Create component
export function DrawingAction({ content, state, onValueChange, onSubmit }: BaseActionProps) {}

// 2. Add to registry
actionRegistry['drawing'] = { component: DrawingAction, config: actionConfigs.drawing };

// 3. Add config
actionConfigs['drawing'] = { submitButtonText: 'Submit Drawing', ... };
```

### Nudj Lite V2 (apps/user)
- **Features**: 3D animated cards, gesture controls, responsive layouts
- **Architecture**: Server-side data fetching, compound components
- **Performance**: GPU acceleration, frame budget management
- **Docs**: See `apps/user/.claude/commands/nudj-lite-prime.md`

## Enhanced Development Workflow

### Quick Start Options
1. **VS Code Tasks** (Recommended):
   - Press `Cmd+Shift+P` → "Tasks: Run Task" → Choose "🌐 Full Stack"
   - Automatically starts API, waits for health check, then starts all frontend apps

2. **Manual Command Line**:
   ```bash
   # Start with local API integration
   cd apps/admin && pnpm dev:with-api
   # Automatically starts API if not running, then starts admin app
   ```

3. **Individual Services**:
   ```bash
   cd apps/api && pnpm dev                    # Start API only
   cd apps/user && pnpm dev                 # User app (uses dev API)
   cd apps/admin && pnpm dev         # Admin app (uses dev API)
   ```

### Development Best Practices
1. **Type Check First**: `pnpm run typecheck`
2. **Lint Before Commit**: `pnpm lint` - Check for `×` errors (not just `!` warnings)
3. **Biome After Edits**: `pnpm biome check <file>`
4. **Test with Timeout**: `timeout 30s pnpm run test`
5. **Service Status**: `./scripts/status.sh` - Check all services and routing
6. **Clean Ports**: Use VS Code task "🧹 Kill All Ports" when needed
7. **API Client Generation**: `cd packages/api && pnpm generate-client`
8. **PR Convention**: `NUDJ-XXXX feat(scope): description`
9. **No Workarounds**: Propose best approach
10. **API Doc Preview**: Check PR comments for documentation impact
11. **Skip Docs**: Use `[skip-docs]` in merge commit for emergencies

### Port Management
- **3000**: API Server (backend)
- **3001**: User App (ShadCN) or Nudj Templates
- **4000**: Admin App (Nudj AI Legacy)
- **4010**: MCP Server
- **3004**: Documentation (Mintlify)

### Local API Integration
- Set `NUDJ_LOCAL_API=true` to route all apps to local API
- Apps automatically detect running services and fall back gracefully
- Health checks ensure API is ready before starting dependent services
- Smart routing: User App URL automatically adjusts based on what's running

## Security

### Best Practices
- **Never commit secrets** - use `.env.local`
- **Rotate API keys regularly** - maintain key rotation schedule
- **GitHub Package Registry auth** - configure in `.npmrc`
- **Configure CORS for production** - restrict allowed origins

### Data Protection
- **Scrub sensitive data before logging**: Always sanitize PII, credentials, and sensitive information before sending to external services (Sentry, logs, etc.)
- **Use data scrubbing utilities**: Implement `scrubSensitiveData()` from `lib/utils/data-scrubber.ts` when handling error contexts
- **Redact sensitive fields**: Password, token, email, SSN, credit card, and other PII fields must be masked or redacted
- **Sanitize stack traces**: Remove environment variables and tokens from error stack traces
- **Never log raw input**: Always scrub user input data before logging or error reporting

### Common Security Patterns
```typescript
// ❌ BAD: Sending raw input to Sentry
Sentry.captureException(error, {
  extra: { input: rawInput }
});

// ✅ GOOD: Using data scrubbing
import { createSafeErrorContext } from 'lib/utils/data-scrubber';
Sentry.captureException(error, {
  extra: createSafeErrorContext(input, ctx)
});
```

## Recent Changes (Updated 2025-01-29)
### VS Code Tasks & Development Workflow (Added 2025-01-29)
- **VS Code Tasks Integration**: Comprehensive task definitions for all services and workflows
- **Smart Port Management**: Automatic port cleanup and health checks
- **Local API Support**: `dev:with-api` scripts for seamless local development
- **Service Orchestration**: Combined tasks for frontend apps and full stack development
- **Database Operations**: Integrated migration tasks in VS Code
- **Utility Scripts**: Status checking (`status.sh`) and API management (`dev-with-api.mjs`)
- **Environment Detection**: Smart routing with `NUDJ_LOCAL_API` flag
- **Auto-API Startup**: Automatic API server initialization when needed

### Architecture Documentation Enhancements
- **Comprehensive Port Mapping**: Detailed service port assignments and purposes
- **Data Flow Documentation**: Clear API → Database → Frontend relationships
- **Turbo Configuration**: Build system optimization and caching strategies
- **PNPM Workspace Structure**: Complete monorepo organization overview
- **Development Scripts**: Automated tooling for seamless local development

## Previous Changes (Added 2025-01-25)
### Documentation Platform Migration
- **Mintlify Integration**: Complete migration from HelpKit to Mintlify platform
- **Enhanced Authentication**: Updated API authentication with comprehensive subdomain support
- **Auto-generation**: 200+ API endpoint pages generated from OpenAPI specs
- **Content Structure**: New organized structure with Getting Started, User Guide, Admin Guide, Enterprise sections
- **Interactive Playground**: Mintlify API playground with token authentication support
- **GitHub Actions**: Automated sync workflow for API documentation updates

### API Documentation Enhancements
- **Subdomain Configuration**: Enhanced authentication page with subdomain requirements
- **OpenAPI Specs**: Three comprehensive specs (admin.json, integration.json, analytics.json)
- **Navigation Generation**: Automated navigation structure updates via JavaScript
- **Multi-header Authentication**: Support for Authorization, x-api-token, and variants

### Platform Updates
- **Variable Configuration**: Enhanced variable page with validation endpoints (NUDJ-3397)
- **Nudj Platform Migration**: Integration of nudj-platform into monorepo (NUDJ-3350)
- **API Route Expansion**: New admin achievement recalculation and leaderboard processing routes

## App-Specific Guidelines

### Docs App Development
- **Content Updates**: Use MDX format for all documentation pages
- **API Documentation**: Auto-generated from OpenAPI - do not edit MDX files directly
- **Navigation Changes**: Update `docs.json` and regenerate with `pnpm run generate:nav`
- **Testing**: Use Mintlify's broken link checker with `pnpm run lint`
- **Authentication Testing**: Always specify subdomain in API playground
- **Local Development**: Run `pnpm dev` for Mintlify development server on port 3004

### Documentation Standards
- **OpenAPI Integration**: All API endpoints documented via OpenAPI specifications
- **Interactive Examples**: Use Mintlify's code groups and interactive components
- **Authentication Headers**: Document all supported header variants (Authorization, x-api-token, etc.)
- **Error Handling**: Include comprehensive error response examples
- **Migration Planning**: Follow phased approach for content updates (see MIGRATION_PLAN.md)

## Important Rules
- **Build Optimization**: Prefer typecheck over builds
- **File Organization**: Max 200-300 lines per file
- **State Management**: Always handle loading/error states
- **Accessibility**: All interactive elements keyboard accessible
- **Documentation**: Update CLAUDE.md for significant features
- **API Documentation**: Never edit auto-generated MDX files - update OpenAPI specs instead
- **Mintlify Deployment**: Documentation deploys automatically via Mintlify platform
- **Git Hooks**: Pre-commit only runs lint-staged (no doc generation during commits)
- **Doc Generation**: Happens automatically on merge to main, preview available on PRs