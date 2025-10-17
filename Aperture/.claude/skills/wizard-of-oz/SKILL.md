---
name: wizard-of-oz
description: Development patterns, architecture, and workflows for the Wizard of Oz baby photo alignment application built with React, TypeScript, Vite, Supabase, and Gemini AI
---

# Wizard of Oz Development Skill

## Overview

Specialized knowledge for developing and maintaining the Wizard of Oz baby photo alignment application - a timelapse creator that uses AI-powered eye detection to align baby photos perfectly.

**Location:** `projects/wizard-of-oz/`
**Status:** ✅ LIVE & DEPLOYED
**Deployment:** Vercel (auto-deploy from main branch)

## When to Use This Skill

Activate when:
- Working with files in `projects/wizard-of-oz/`
- Debugging photo upload, processing, or eye detection
- Implementing photo features or UI components
- Deploying or testing the application
- Integrating with Supabase or Gemini AI

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **AI:** Gemini Vision API (eye detection)
- **Hosting:** Vercel
- **State:** Zustand

## Core Features

### 1. Photo Upload
- Daily photo capture (camera or gallery)
- Client-side resizing and optimization
- Supabase Storage integration
- Status tracking (processing → ready → error)

### 2. AI Eye Detection
- Gemini Vision API for face/eye coordinates
- Alignment calculation based on eye positions
- Error handling for unclear/failed detections

### 3. Photo Management
- Calendar view for browsing photo history
- Gallery with processing status indicators
- Date-based organization
- Metadata storage

### 4. Alignment System (In Progress)
- Client-side Canvas API alignment
- Eye position normalization
- Preview generation
- Timelapse preparation

## File Structure

```
projects/wizard-of-oz/
├── src/
│   ├── components/           # React components
│   │   ├── Calendar.tsx     # Calendar view
│   │   ├── Upload.tsx       # Photo upload UI
│   │   └── Gallery.tsx      # Photo gallery
│   ├── lib/                 # Business logic
│   │   ├── supabase.ts      # Supabase client
│   │   └── uploadToSupabase.ts  # Upload logic
│   ├── hooks/               # Custom React hooks
│   │   └── usePhotoStore.ts # Photo state management
│   └── utils/               # Utilities
│       └── imageUtils.ts    # Image processing
├── DEPLOYMENT.md            # 🔥 CRITICAL deployment guide
└── package.json
```

## Development Commands

```bash
# Local development
cd projects/wizard-of-oz
npm install
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Test production build
npm run typecheck    # TypeScript validation
npm run preview      # Preview production build
```

**Pre-deployment checklist:**
```bash
# ALWAYS run before pushing to main
npm run build        # Must succeed
npm run typecheck    # Must pass
```

## Deployment Workflow

**CRITICAL:** All changes MUST be committed to `main` branch for Vercel auto-deployment.

```bash
git add .
git commit -m "feat: description"
git push origin main    # Triggers Vercel deployment
```

See `projects/wizard-of-oz/DEPLOYMENT.md` for complete workflow.

## Environment Variables

**Required in Vercel Dashboard:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Local development (`.env.local`):**
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Common Development Patterns

### React Components

```typescript
// Functional components with typed props
interface PhotoCardProps {
  photo: Photo
  onSelect: (id: string) => void
}

export function PhotoCard({ photo, onSelect }: PhotoCardProps) {
  // Implementation
}
```

### Error Handling

```typescript
// Always include context in errors
try {
  await uploadPhoto(file)
} catch (error) {
  console.error('Upload failed:', {
    fileName: file.name,
    fileSize: file.size,
    error: error.message
  })
  throw new Error(`Upload failed: ${error.message}`)
}
```

### Supabase Queries

```typescript
// Handle errors and loading states
const { data, error, isLoading } = useQuery({
  queryKey: ['photos', date],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('date', date)

    if (error) throw error
    return data
  }
})
```

## Common Issues & Solutions

### Upload Stuck in "Processing"
- **Cause:** Eye detection API failed or timed out
- **Fix:** Check Gemini API key, network, logs
- **Location:** `src/lib/uploadToSupabase.ts`

### Photos Not Showing
- **Cause:** Supabase query or RLS policy issue
- **Fix:** Check Supabase policies, verify auth
- **Location:** `src/hooks/usePhotoStore.ts`

### Build Failures
- **Cause:** TypeScript errors or missing dependencies
- **Fix:** Run `npm run typecheck` and `npm install`

### Camera/Gallery Issues
- **Cause:** File input config or mobile browser
- **Fix:** Verify separate inputs for camera vs gallery
- **Location:** `src/components/Upload.tsx`

## Performance Targets

- Initial load: < 2s
- Photo upload: < 5s (including AI detection)
- Calendar view: < 1s
- Gallery scroll: 60fps smooth

## Testing Strategy

- Manual testing on mobile devices
- Photo upload with various image sizes/formats
- Eye detection with different lighting conditions
- Calendar navigation across months
- Error state handling

## Key Files to Reference

- `src/lib/uploadToSupabase.ts` - Main upload logic
- `src/components/Upload.tsx` - Upload UI
- `src/hooks/usePhotoStore.ts` - Photo state
- `src/lib/supabase.ts` - Supabase client
- `DEPLOYMENT.md` - Deployment guide

## Additional Resources

See the `architecture.md` file in this skill directory for:
- System architecture diagrams
- Data flow documentation
- Database schema details
- API integration patterns
- Performance optimizations

Use the `common-tasks.sh` script for quick access to common commands:
```bash
./.claude/skills/wizard-of-oz/common-tasks.sh [command]
```

## Success Criteria

When a feature is complete:
- ✅ Builds without errors (`npm run build`)
- ✅ TypeScript validates (`npm run typecheck`)
- ✅ Works on mobile and desktop
- ✅ Error states handled gracefully
- ✅ Pushed to main and deployed
- ✅ Manually tested in production
