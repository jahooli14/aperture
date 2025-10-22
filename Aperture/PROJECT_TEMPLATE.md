# 📦 Project Template - Aperture

> **Use this template when creating new projects in the Aperture monorepo**

---

## Quick Start

### 1. Create Project Directory Structure

```bash
# Replace 'project-name' with your actual project name (kebab-case)
PROJECT_NAME="project-name"

mkdir -p projects/${PROJECT_NAME}/{src,api,lib,scripts,.github}
cd projects/${PROJECT_NAME}
```

### 2. Create Core Files

#### `package.json`

```json
{
  "name": "project-name",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Brief description of what this project does",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "deploy": "vercel --prod",
    "deploy:preview": "vercel"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "api", "lib"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

#### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, './lib')
    }
  },
  server: {
    port: 3000 // Change port number to avoid conflicts
  }
})
```

#### `.env.example`

```bash
# Project Environment Variables

# Supabase (if using)
SUPABASE_URL=your-project-url.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI APIs (if using)
GEMINI_API_KEY=your-gemini-api-key
# OPENAI_API_KEY=your-openai-api-key

# Logging
LOG_LEVEL=info
```

#### `.gitignore`

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
dist/
build/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
*.log

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
```

---

## 3. Create Documentation Files

### `README.md`

```markdown
# Project Name

> Brief tagline describing the project

**Status**: 🚧 In Development | ✅ Production | 🎯 Ready to Deploy

---

## 🎯 What This Is

[2-3 sentence description of what the project does and why it exists]

### The Problem It Solves

- Problem 1
- Problem 2
- Problem 3

### The Solution

- Solution 1
- Solution 2
- Solution 3

---

## ✨ Key Features

### Feature 1
Description of feature 1

### Feature 2
Description of feature 2

---

## 🏗️ How It Works

```
[Flow diagram or description of architecture]
```

---

## 📁 Project Structure

```
project-name/
├── src/              # Frontend code
├── api/              # Serverless API functions
├── lib/              # Shared library code
├── scripts/          # Build/deployment scripts
├── package.json      # Dependencies
└── README.md         # This file
```

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd projects/project-name
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Server

```bash
npm run dev
```

---

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Check TypeScript types

### Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Vercel Serverless Functions
- **Database**: [Your database]
- **AI**: [Your AI provider]

---

## 📝 Usage Examples

[Include code examples or screenshots]

---

## 🚢 Deployment

Deployed on Vercel:
- **Production**: [URL]
- **Preview**: Auto-deploys on PR

```bash
npm run deploy
```

---

## 📚 Related Projects

- **[Related Project 1]** (`projects/related-project-1`) - How it relates
- **[Related Project 2]** (`projects/related-project-2`) - How it relates

---

## 🤝 Contributing

This is part of the Aperture monorepo. See main repository README for contribution guidelines.

---

## 📄 Project Info

**Part of the Aperture monorepo** - Personal projects by [Your Name]

**Status**: [Status]
**Created**: [Date]
**Last Updated**: [Date]
```

### `NEXT_SESSION.md`

```markdown
# Project Name - Next Session

**Last Updated**: YYYY-MM-DD

---

## 🎯 Project Status

**Current Phase**: [Planning | Development | Testing | Production]

### What's Complete ✅

1. **Feature Set 1**
   - ✅ Item 1
   - ✅ Item 2

### What's Next 🚀

1. **Feature Set 2**
   - [ ] Item 1
   - [ ] Item 2

---

## 📝 Notes for Next Session

### Current State

[Description of current state]

### Blockers

- [ ] Blocker 1 (if any)

### Environment Variables Needed

```bash
VAR_NAME=value
```

---

## 🛠️ Quick Start Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build
```

---

## 💡 Ideas for Future Sessions

1. **Feature Idea 1**
   - Description
   - Value

---

## 🐛 Known Issues

- Issue 1
- Issue 2

---

## 📚 Related Projects

- **[Related Project]** - Connection description
```

---

## 4. Update Aperture Documentation

After creating the project, update these files:

### Update `CLAUDE-APERTURE.md`

Add project to the projects list:

```markdown
### Project Name

**Status**: 🚧 In Development

[Brief description]

#### Quick Facts
- **Location**: `projects/project-name/`
- **Tech Stack**: React, TypeScript, Vite
- **Deployment**: [Deployment info]
- **Features**:
  - Feature 1
  - Feature 2
```

### Update `PROJECT_IDEAS.md`

Move the idea from active/incubating to "Completed Ideas":

```markdown
### Project Name
**Created**: YYYY-MM-DD
**Location**: `projects/project-name/`
**Original Idea**: [Description]
**Status**: ✅ Created and documented
```

### Update Active Project Count

In `CLAUDE-APERTURE.md`, update:
```markdown
- **Active Projects**: [New Count]
```

---

## 5. Initialize Git (if needed)

```bash
git add .
git commit -m "feat: initialize [project-name] project"
```

---

## 📋 Checklist for New Projects

- [ ] Created directory structure
- [ ] Added package.json
- [ ] Added TypeScript config
- [ ] Added Vite config
- [ ] Created .env.example
- [ ] Added .gitignore
- [ ] Wrote comprehensive README.md
- [ ] Created NEXT_SESSION.md
- [ ] Updated CLAUDE-APERTURE.md
- [ ] Updated PROJECT_IDEAS.md
- [ ] Committed initial files to git

---

## 🎨 Project Categories

When creating projects, categorize them:

### Personal Projects
Applications for personal use or sharing
- Location: `projects/[name]/`
- Examples: wizard-of-oz, polymath, baby-milestone-tracker

### Meta Projects
Infrastructure, tooling, automation
- Location: `scripts/[name]/` or `projects/[name]/`
- Examples: self-healing-tests, autonomous-docs

---

**Template Version**: 1.0.0
**Last Updated**: 2025-10-22
