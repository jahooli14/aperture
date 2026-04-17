# Power Hour Redesign Plan

## Overview

Redesign Power Hour to be a **time-boxed, commitment-driven focus session** where:
1. Tasks are estimated for duration
2. Tasks are selected to fit ~50 minutes (10 min buffer for planning/wrap-up)
3. User reviews, adjusts, and commits to the session
4. Timer runs during active work
5. Session ends with accomplishment summary

---

## Phase 1: Task Duration Estimation (MVP)

### 1.1 Add Duration to AI Task Generation

**File:** `api/_lib/power-hour-generator.ts`

Update the prompt to include `estimated_minutes` for each task:

```typescript
// Add to PowerHourTask interface
interface PowerHourTask {
  // ... existing fields
  checklist_items: {
    text: string
    is_new: boolean
    estimated_minutes: number  // NEW: 5 | 15 | 25 | 45
  }[]
}
```

**Prompt additions:**
- Each checklist item must include `estimated_minutes`
- Use buckets: 5 (quick), 15 (short), 25 (standard), 45 (deep work)
- Base estimate on task complexity and energy level
- Total for all NEW tasks should not exceed available slots in minutes

### 1.2 Display Duration in UI

**File:** `src/components/PowerHourHero.tsx`

Show duration badges next to each task:
- `[15 min] Write unit tests`
- Running total at bottom: "Total: 42 of 50 min"

---

## Phase 2: Session Review & Commitment Flow

### 2.1 Review Modal Component

**New file:** `src/components/PowerHourReview.tsx`

```
┌─────────────────────────────────────┐
│  Your Power Hour Plan               │
│  Project: Website Redesign          │
├─────────────────────────────────────┤
│  ☐ Write homepage copy     [25 min] │
│  ☐ Add contact form        [15 min] │
│  ☐ Optimize images         [10 min] │
├─────────────────────────────────────┤
│  Total: 50 min ████████████░░ 50/50 │
│                                     │
│  [ Adjust ]      [ Start Session ]  │
└─────────────────────────────────────┘
```

**Features:**
- Show all tasks with duration (editable with tap)
- Visual progress bar: green (<50), yellow (50-60), red (>60 blocked)
- Reorder tasks by drag (optional for Phase 3)
- Remove tasks with swipe

### 2.2 Duration Adjustment UI

When user taps duration badge:
- Show picker: [5] [15] [25] [45] [custom]
- Custom allows typing any number
- Total updates in real-time
- Block "Start Session" if >60 min

### 2.3 Commitment Moment

On "Start Session" tap:
1. Haptic feedback (`haptic.medium()`)
2. Brief confirmation toast: "Session started! 50 min of focused work"
3. Store session in Supabase with `started_at` timestamp
4. Navigate to timer view

---

## Phase 3: Active Session Timer

### 3.1 Timer Component

**New file:** `src/components/PowerHourTimer.tsx`

**Layout (mobile-first):**
```
┌─────────────────────┐
│                     │
│     ╭───────╮       │
│    ( 47:23  )       │  ← Circular SVG timer
│     ╰───────╯       │
│                     │
│  ✓ Write homepage   │  ← Completed (faded)
│  → Add contact form │  ← Current (highlighted)
│    Optimize images  │  ← Upcoming
│                     │
│ [Pause]     [Done]  │
└─────────────────────┘
```

**Timer logic:**
- Store `startedAt` timestamp (handles background/return)
- Calculate remaining on each render
- SVG circle with `stroke-dashoffset` animation
- Color shift: blue → warmer as time runs out

### 3.2 Task Completion During Session

When user checks off a task:
1. Light haptic + mini confetti burst
2. Task animates to "completed" state
3. Next task auto-highlights
4. Progress counter updates: "2 of 4 tasks done"

### 3.3 Timer Controls

- **Pause:** Freeze timer, show overlay with "Resume" / "End Early"
- **Extend:** Add 10 min (max 90 min total)
- **Done:** Complete session early (no penalty)
- **5 min warning:** Toast + color shift

---

## Phase 4: Session Completion

### 4.1 Completion Summary

**New file:** `src/components/PowerHourSummary.tsx`

```
┌─────────────────────────────────┐
│       ⚡ Session Complete!      │
│                                 │
│   Duration: 48 min (planned 50) │
│   Tasks: 3/4 completed          │
│   Focus: 96%                    │
│                                 │
│   Sessions this week: 4         │
│                                 │
│  [ Back to Projects ]           │
└─────────────────────────────────┘
```

**Celebration:**
- Use existing `celebrate.epic()` confetti
- Haptic: `haptic.success()`
- Store session in Supabase for history

### 4.2 Early Exit (Graceful)

If user ends early or timer expires with tasks incomplete:
- Gentle message: "You did 32 min of focused work!"
- Still counts toward weekly sessions
- Optional feedback: "What happened?" (distraction, tasks took longer, etc.)

---

## Database Schema Updates

### New Table: `power_hour_sessions`

```sql
CREATE TABLE power_hour_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),

  -- Planning
  planned_duration_minutes INT DEFAULT 50,
  tasks JSONB,  -- snapshot of tasks at session start

  -- Execution
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  paused_duration_seconds INT DEFAULT 0,

  -- Results
  tasks_completed INT,
  tasks_total INT,
  actual_duration_minutes INT,
  was_completed BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `api/_lib/power-hour-generator.ts` | Add `estimated_minutes` to prompt |
| `api/power-hour.ts` | Return duration data, store sessions |
| `src/types.ts` | Add `PowerHourSession` interface |
| `src/components/PowerHourHero.tsx` | Show durations, link to review |
| `src/components/PowerHourReview.tsx` | **NEW** - Review & commit modal |
| `src/components/PowerHourTimer.tsx` | **NEW** - Active session timer |
| `src/components/PowerHourSummary.tsx` | **NEW** - Completion summary |
| `src/stores/usePowerHourStore.ts` | **NEW** - Session state management |

---

## Implementation Order

1. **Duration Estimation** - Update generator prompt, show in UI
2. **Review Modal** - Build commit flow before starting
3. **Session Store** - Zustand store for timer state
4. **Timer Component** - SVG circular timer with task list
5. **Completion Summary** - End-of-session celebration
6. **Database** - Store sessions for analytics

---

## Key Design Decisions

1. **50 min target, not 60** - Leave buffer for planning/wrap-up
2. **Single session timer** - Not per-task timers (preserves flow)
3. **Duration buckets: 5/15/25/45** - Pomodoro-inspired but flexible
4. **No aggressive streaks** - "Sessions this week" counter instead
5. **Graceful early exit** - No shame, still counts
6. **Mobile-first** - Full-screen timer, swipe for tasks

---

## Delight Moments

1. **Flow Entry** - Screen darkens, timer expands from center (800ms)
2. **Task Complete** - Light haptic + mini confetti (constrained to task area)
3. **Milestone Toasts** - "Halfway there!" at 50% (subtle, auto-dismiss)
4. **Session Complete** - Epic confetti + summary reveal
5. **Color Evolution** - Timer ring saturation increases with progress
