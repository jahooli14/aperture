# Polymath Demo Onboarding

## Overview

Polymath now has a polished demo onboarding experience that makes it easy to showcase the platform's capabilities and helps new users understand the voice notes → synthesis → projects flow.

## Onboarding Flow

### 1. First Visit - Welcome Modal

**When**: User visits for the first time (checked via `localStorage.polymath_has_visited`)

**What Shows**: Beautiful modal explaining:
- How Polymath works (3-step process with icons)
- What demo data includes (8 memories, 7 suggestions, 4 projects)
- Two clear CTAs:
  - **"Load Demo Data"** - Populates with template data
  - **"Start Fresh"** - Skip demo, start with clean slate

**Key Details**:
- Modal can be closed/dismissed
- User choice is remembered in localStorage
- Demo data showcases cross-domain synthesis (tech + hobbies)

### 2. Demo Data Banner

**When**: User has demo data loaded (detected by `demo-` prefix in memory IDs)

**What Shows**: Sticky banner at top explaining:
- "You're viewing demo data"
- Shows counts: 8 memories, 7 suggestions, 4 projects
- Two CTAs:
  - **"Keep Exploring"** - Dismiss banner but keep data
  - **"Clear Demo Data"** - Remove all template data

**Confirmation Flow**:
- Click "Clear Demo Data" → Shows confirmation
- Warns: "This cannot be undone"
- Clears all memories, suggestions, projects for user
- Sets `polymath_demo_dismissed` flag

### 3. Empty State

**When**: User has no data (cleared demo or started fresh)

**What Shows**:
- Explains 3-step process to get started
- Links to Audiopen setup
- Button to reload demo data
- Helpful tip about recording 5-10 notes

## Demo Data Contents

### 8 Demo Memories (Voice Notes)
Spanning diverse themes to show synthesis:
1. **Coding breakthrough** - Algorithm optimization (tech)
2. **Woodworking idea** - Standing desk build (craft)
3. **Parenting observation** - Hands-on learning (education)
4. **Financial planning** - Cloud cost optimization (business)
5. **Photography technique** - Composition methods (art)
6. **ML model performance** - Image classification (tech)
7. **Meditation practice** - Mindfulness insights (wellness)
8. **Recipe experimentation** - Sourdough baking (cooking)

### 7 AI-Generated Suggestions
Cross-domain synthesis examples:
1. **Interactive Learning Platform** (parenting + tech) - 86 pts
2. **Smart Workshop Planner** (woodworking + tech) - 82 pts, SPARK
3. **SaaS Cost Optimizer** (finance + tech) - 78 pts, SPARK
4. **Photography Analyzer** (ML + photography) - 80 pts
5. **Mindful Coding Timer** (meditation + coding) - 76 pts
6. **Sourdough Logger** (cooking + tech) - 72 pts
7. **Neural Sourdough Predictor** (ML + baking) - 58 pts, WILDCARD

### 4 Demo Projects
Various stages to show progression:
1. **Standing Desk Build** - COMPLETED (100%)
2. **Portfolio Website** - ACTIVE (65%)
3. **Image Classifier** - ACTIVE (80%)
4. **Meditation Routine** - ACTIVE (40%)

## Technical Implementation

### API Endpoint: `/api/demo-data`
```typescript
POST /api/demo-data
Body: { userId: string }
Response: { success: true, counts: { memories, suggestions, projects } }
```

- Inserts all demo data with user-specific IDs
- Creates proper relationships (memory_ids, capability_ids)
- Uses `demo-${userId}-N` pattern for memory IDs (easy to detect)

### Components

**`WelcomeModal.tsx`**
- Shows 3-step process with icons
- Explains demo data benefits
- Two CTAs with loading states

**`DemoDataBanner.tsx`**
- Sticky banner with gradient background
- Shows data counts
- Confirmation flow for clearing
- Dismissible

**`EmptyState.tsx`**
- Guidance for new users
- Links to Audiopen
- Option to reload demo
- Tips for getting started

### State Management

**localStorage Keys**:
- `polymath_has_visited` - Boolean, tracks first visit
- `polymath_demo_dismissed` - Boolean, tracks if user dismissed banner

**Detection Logic**:
```typescript
// Demo data detected by memory ID prefix
const hasDemoMemory = memories.some(m => m.audiopen_id?.startsWith('demo-'))
```

### Data Clearing Flow
```typescript
// Clear in order (respecting foreign keys)
await supabase.from('project_suggestions').delete().eq('user_id', user.id)
await supabase.from('projects').delete().eq('user_id', user.id)
await supabase.from('memories').delete().eq('user_id', user.id)
```

## Usage

### For Demos

**Quick Start**:
1. Navigate to Polymath homepage
2. Click "Load Demo Data" on welcome modal
3. Explore:
   - **Memories page** - See 8 diverse voice notes with themes
   - **Suggestions page** - See AI synthesis with 2 sparks, 1 wildcard
   - **Projects page** - See projects in various stages with progress

**Clear Demo After**:
1. Click "Clear Demo Data" in banner
2. Confirm deletion
3. Start fresh or reload demo

### For New Users

**Path 1: Demo First** (Recommended)
1. Load demo data
2. Explore features
3. Clear when ready
4. Connect Audiopen
5. Start recording

**Path 2: Direct Start**
1. Click "Start Fresh"
2. See empty state
3. Connect Audiopen
4. Record 5-10 notes
5. Wait for synthesis

## Design Decisions

### Why Demo Data?

**Problem**: Empty Polymath is hard to understand
- Can't see synthesis without memories
- Can't demonstrate cross-pollination
- Unclear what "good" voice notes look like

**Solution**: Rich template data
- Shows diverse memory types
- Demonstrates theme clustering
- Illustrates cross-domain synthesis
- Provides "aha moment" instantly

### Why Clearable?

**Trust & Control**:
- Users need to know it's template data (banner)
- Must be easy to start fresh (one click)
- Should feel temporary, not permanent
- No confusion about "whose thoughts are these?"

### Why These Examples?

**Realistic & Relatable**:
- Mix of technical and personal (balanced)
- Common interests (photography, cooking, parenting)
- Show unexpected connections (ML + sourdough)
- Demonstrate wildcard suggestions
- Include completed + active projects

## Files

### New Files
- `src/components/onboarding/WelcomeModal.tsx` - First-time modal
- `src/components/onboarding/DemoDataBanner.tsx` - Demo data banner
- `src/components/onboarding/EmptyState.tsx` - No data state
- `api/demo-data.ts` - Demo data loading endpoint
- `scripts/seed-demo-data.ts` - Script version for direct seeding

### Modified Files
- `src/pages/HomePage.tsx` - Integrated onboarding components

## Next Steps

### Improvements
1. **Onboarding Tour** - Highlight key features after loading demo
2. **Guided Exploration** - "Try rating this suggestion" prompts
3. **Progress Indicators** - "You've explored 3/4 pages"
4. **Video Walkthrough** - Embedded demo video in welcome modal

### Analytics to Track
- % who load demo vs start fresh
- % who clear demo data vs keep it
- Time spent exploring before clearing
- Which pages viewed during demo

## Testing Checklist

- [ ] First visit shows welcome modal
- [ ] "Load Demo Data" button works and shows banner
- [ ] "Start Fresh" button skips to empty state
- [ ] Demo banner shows correct counts
- [ ] "Clear Demo Data" confirmation works
- [ ] Data clears and refreshes to empty state
- [ ] Empty state links work
- [ ] "Load Demo Instead" button resets and shows modal
- [ ] localStorage flags set correctly
- [ ] Banner dismisses and doesn't reappear
- [ ] Works on mobile/tablet viewports

---

**Status**: Ready for production
**Version**: 1.0
**Last Updated**: 2025-10-23
