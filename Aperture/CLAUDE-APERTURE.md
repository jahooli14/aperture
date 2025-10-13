# CLAUDE.md - Aperture Projects

> **🚨 IMPORTANT NOTICE**:
>
> This is the **APERTURE** repository for **PERSONAL PROJECTS**.
>
> If you're working on **NUDJ** (work projects), see **`CLAUDE-NUDJ.md`** instead.

---

## Repository Overview

**Aperture** is a multi-project development framework for personal experiments, prototypes, and side projects.

### Current Status
- **Active Projects**: 1 (wizard-of-oz)
- **Framework**: React, TypeScript, Vite
- **Deployment**: Vercel
- **Last Updated**: 2025-10-10

---

## Quick Start

### For New Sessions
Read these files IN ORDER:
1. **`START_HERE.md`** - Session startup guide
2. **`NEXT_SESSION.md`** - Current status and next steps
3. **`SESSION_CHECKLIST.md`** - Workflow and best practices

### For Specific Tasks
- **Wizard of Oz Development**: See `projects/wizard-of-oz/` section below
- **Process Improvements**: See `.process/` directory
- **GitHub Workflows**: See `.github/workflows/`

---

## 🎯 Current Tasks & Status

> **Last Updated**: 2025-10-13 (Session 12)
>
> **📍 For detailed tasks, implementation notes, and verification steps → See `NEXT_SESSION.md`**

**Active Project**: Wizard of Oz (Baby Photo App)
**Status**: 🟢 Upload working end-to-end, ready for client-side alignment implementation
**Blockers**: None

**Session 12 Accomplishments**:
- ✅ Fixed invalid Supabase API key (was truncated)
- ✅ Fixed photos stuck in "processing" state
- ✅ Fixed upload button stuck on "Detecting..."
- ✅ Enhanced logging throughout upload flow

**Next**: Implement client-side photo alignment using Canvas API

---

## Project Structure

```
Aperture/
├── .claude/               # Claude Code configuration
├── .github/              # GitHub workflows and templates
├── .process/             # Process documentation
│   └── COMMON_MISTAKES.md
├── projects/             # Individual projects
│   └── wizard-of-oz/    # Baby photo alignment app
├── knowledge-base/       # Reference materials
├── NEXT_SESSION.md      # 🔥 Current status
├── START_HERE.md        # 🔥 Entry point
└── SESSION_CHECKLIST.md # 🔥 Workflow guide
```

---

## Projects

### Wizard of Oz

**Status**: ✅ LIVE & DEPLOYED

A baby photo alignment application with AI-powered eye detection and timelapse generation.

#### Quick Facts
- **Location**: `projects/wizard-of-oz/`
- **Tech Stack**: React, TypeScript, Vite, Supabase, Gemini AI
- **Deployment**: Vercel (auto-deploy on push to main)
- **Features**:
  - Daily photo uploads (camera or gallery)
  - AI eye detection and face alignment
  - Calendar view for browsing photo history
  - Photo gallery with processing status

#### Key Files
- `projects/wizard-of-oz/src/` - Source code
- `projects/wizard-of-oz/DEPLOYMENT.md` - 🔥 **CRITICAL: Deployment requirements**
- `projects/wizard-of-oz/package.json` - Dependencies and scripts

#### Development
```bash
cd projects/wizard-of-oz
npm install
npm run dev          # Start dev server
npm run build        # Build for production (test before pushing!)
```

#### Deployment
**⚠️ CRITICAL**: All changes MUST be committed to `main` branch for Vercel auto-deployment.

See `projects/wizard-of-oz/DEPLOYMENT.md` for complete deployment workflow.

#### Configuration
- **Supabase**: Database and storage backend
- **Gemini AI**: Eye detection and image processing
- **Vercel**: Hosting and deployment
- **Environment Variables**: Set in Vercel dashboard
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## Code Style & Standards

### TypeScript
- **NO** `any` types - use `unknown`
- Interfaces over types for props
- Strict type safety enabled

### React
- Functional components with hooks
- Handler prefix: `handleClick`, `handleSubmit`
- File size: Keep under 200-300 lines

### Naming Conventions
- Components: PascalCase (`CalendarView.tsx`)
- Directories: kebab-case (`wizard-of-oz/`)
- Hooks: camelCase with `use` prefix (`usePhotoStore`)
- Utils: camelCase (`formatDate`)

### File Organization
- Feature-based organization
- Co-locate related files
- Keep components focused and small

---

## Development Workflow

### Before Starting Work
1. Read `NEXT_SESSION.md` - understand current status
2. Check `SESSION_CHECKLIST.md` - follow workflow
3. Review `.process/COMMON_MISTAKES.md` - avoid known pitfalls

### During Development
1. **Test builds locally**: `npm run build` before pushing
2. **Lint before commit**: Check for errors (not just warnings)
3. **Commit to main**: Required for Vercel deployment
4. **Clear commit messages**: Describe what and why

### After Completing Work
1. Update `NEXT_SESSION.md` with what you completed
2. Document any learnings in `.process/COMMON_MISTAKES.md`
3. Push to main for deployment
4. Verify deployment succeeded

---

## Common Patterns

### HTML File Inputs
```tsx
// ❌ BAD: Single input with capture forces camera for both buttons
<input type="file" accept="image/*" capture="environment" />

// ✅ GOOD: Separate inputs for camera vs gallery
<input ref={cameraInputRef} type="file" accept="image/*" capture="environment" />
<input ref={galleryInputRef} type="file" accept="image/*" />
```

### Vercel Deployment
```bash
# ❌ BAD: Working on feature branch
git checkout -b feature/new-thing
git push origin feature/new-thing  # Won't deploy!

# ✅ GOOD: All work on main
git add .
git commit -m "feat: add new thing"
git push origin main  # Auto-deploys to Vercel
```

---

## Environment & Tools

### Required
- **Node.js**: >= 18.0.0
- **npm**: Latest version
- **Git**: For version control

### Recommended
- **VS Code**: Primary editor
- **Claude Code**: AI assistance (you!)

---

## Documentation

### Key Documents
- **START_HERE.md** - New session entry point
- **NEXT_SESSION.md** - Current status and immediate next steps
- **SESSION_CHECKLIST.md** - Complete workflow guide
- **CONTRIBUTING.md** - Contribution guidelines
- **QUICK_REFERENCE.md** - Common commands and patterns
- **CHEATSHEET.md** - Quick tips and shortcuts

### Process Documentation
- **.process/COMMON_MISTAKES.md** - Lessons learned
- **.github/workflows/** - CI/CD configurations

---

## Critical Reminders

### For Development
- ✅ **Test builds locally first** - `npm run build` catches errors early
- ✅ **Commit to main branch** - Required for Vercel deployment
- ✅ **Read NEXT_SESSION.md first** - Always know current status
- ✅ **Update documentation** - Keep knowledge current

### For File Operations
- ✅ **File inputs with capture** - Forces camera, separate inputs needed
- ✅ **Git paths in Aperture** - Repository adds `Aperture/` prefix in paths

### For Deployment
- ✅ **Vercel auto-deploys from main** - No feature branches
- ✅ **Environment variables in Vercel** - Set in dashboard
- ✅ **Build errors block deployment** - Fix locally first

---

## Getting Help

### Documentation Hierarchy
1. Project-specific docs (e.g., `projects/wizard-of-oz/DEPLOYMENT.md`)
2. Process docs (`.process/COMMON_MISTAKES.md`)
3. Root docs (`NEXT_SESSION.md`, `SESSION_CHECKLIST.md`)

### Common Issues
- **Build fails**: Check TypeScript errors with `npm run build`
- **Deployment not triggered**: Ensure pushing to `main` branch
- **Vercel errors**: Check environment variables in dashboard

---

## Next Steps

See **`NEXT_SESSION.md`** for:
- Current project status
- Immediate next steps
- Priority features
- Known issues

---

**Remember**: This is **APERTURE** (personal projects). For **NUDJ** work, use **`CLAUDE-NUDJ.md`**.
