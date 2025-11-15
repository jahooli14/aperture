# Polymath Rating System UX

> How you interact with project suggestions to tune the creative synthesis engine

## Design Principles

1. **Lightweight** - Rating shouldn't feel like work
2. **Expressive** - Capture nuance beyond binary yes/no
3. **Contextual** - Different contexts need different actions
4. **Invisible Learning** - System learns from implicit + explicit signals

## Rating Actions

### Quick Actions (Always Visible)

**On each suggestion card:**
```
┌──────────────────────────────────────────────────────┐
│  Voice-Annotated Photo Timeline                   78 │ <- Points
│  Combine MemoryOS voice notes with photo metadata    │
│                                                       │
│  Capabilities: voice-processing, face-alignment       │
│  Inspired by: "memory systems", "baby photos"         │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │    👍   │  │    👎   │  │   💡    │  │   ⋯     │ │
│  │  Spark  │  │  Meh    │  │  Build  │  │  More   │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │
└──────────────────────────────────────────────────────┘
```

**Action Effects:**

| Action | Rating | Effect | What It Means |
|--------|--------|--------|---------------|
| 👍 Spark | +1 | Boost these capabilities in future synthesis | "This is interesting, show me more like this" |
| 👎 Meh | -1 | Penalize this combination (but keep for diversity) | "Not for me" |
| 💡 Build | +2 | Create project, link to suggestion, strong boost | "I'm doing this" |
| ⋯ More | 0 | Expand details, show reasoning | "Tell me why you suggested this" |

### Extended Actions (In "More" Menu)

**Click "More" → Dropdown:**
```
┌──────────────────────────────────────┐
│  👍 Spark this idea                  │
│  👎 Not interested                   │
│  💡 Build it now                     │
│  ─────────────────────────────────   │
│  📌 Save for later                   │
│  🔄 Show me variations               │
│  🎲 Why did you suggest this?        │
│  🚫 Never suggest this combo again   │
└──────────────────────────────────────┘
```

**Additional Actions:**

| Action | Effect |
|--------|--------|
| 📌 Save for later | Move to "Saved Ideas" list, neutral rating |
| 🔄 Show variations | Generate 3 similar ideas with same capabilities |
| 🎲 Why suggest? | Show AI reasoning (which memories/interests triggered) |
| 🚫 Never again | Hard block this capability combo (overrides diversity) |

## Implicit Signals

**System learns without explicit rating:**

| User Behavior | Implicit Rating | Effect |
|---------------|-----------------|--------|
| Clicked "More" 3+ times | +0.5 | Interested, exploring |
| Viewed for 10+ seconds | +0.3 | Considering it |
| Dismissed immediately | -0.2 | Not compelling |
| Came back to it later | +0.4 | Resonating over time |
| Shared it (if sharing exists) | +1 | Excited about it |
| Built it (detected via git) | +2 | Ultimate validation |

## Rating Views

### 1. Suggestion Feed (Default)

**Weekly digest of new suggestions:**
```
┌────────────────────────────────────────────────────────────┐
│  New Ideas This Week                          Week of Nov 4 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Voice-Annotated Photo Timeline                 78 │    │
│  │  [card with quick actions]                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Self-Documenting Creative Portfolio           65 │    │
│  │  [card with quick actions]                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  🎲 Wild Card: Blockchain Art Gallery          42 │    │
│  │  [card with quick actions]                         │    │
│  │  This idea is outside your usual range - try it?   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  [Show 7 more suggestions]                                  │
└────────────────────────────────────────────────────────────┘
```

### 2. Permanent Ideas List

**Every suggestion ever made, filterable:**
```
┌────────────────────────────────────────────────────────────┐
│  All Ideas                        [New] [Saved] [Built] [All]│
│  Sort by: [Points ▼] [Recent] [Rating]                      │
│                                                              │
│  ┌─────┐ Voice-Photo Timeline          78pts  Nov 4  👍    │
│  │ 💡  │ Status: Built  |  Project: /projects/voice-photos │
│  └─────┘                                                     │
│                                                              │
│  ┌─────┐ AI Color Theory Assistant      65pts  Nov 4  📌   │
│  │ 🎨  │ Status: Saved                                      │
│  └─────┘                                                     │
│                                                              │
│  ┌─────┐ Generative Music from Code     58pts  Oct 28 👎   │
│  │ 🎵  │ Status: Dismissed                                  │
│  └─────┘                                                     │
│                                                              │
│  ┌─────┐ Blockchain Art Gallery         42pts  Nov 4  ⏳   │
│  │ 🎲  │ Status: Pending (Wild Card)                        │
│  └─────┘                                                     │
└────────────────────────────────────────────────────────────┘
```

**Filters:**
- **New** - This week's suggestions
- **Saved** - User marked "save for later"
- **Built** - Successfully turned into projects
- **All** - Everything ever suggested (permanent list)

**Sort:**
- **Points** - Highest rated by AI
- **Recent** - Newest first
- **Rating** - Your ratings (👍 first)

### 3. "Why This?" Detail View

**When user clicks "Why did you suggest this?":**
```
┌────────────────────────────────────────────────────────────┐
│  ← Back to suggestions                                      │
│                                                              │
│  Voice-Annotated Photo Timeline                          78 │
│                                                              │
│  Why this idea?                                              │
│                                                              │
│  📊 Scoring Breakdown                                        │
│  ├─ Novelty: 85%  (Rarely combined these capabilities)      │
│  ├─ Feasibility: 90%  (High code reuse potential)           │
│  └─ Interest: 60%  (Matches recent thoughts on memories)    │
│                                                              │
│  🧩 Capabilities Combined                                    │
│  ├─ voice-processing (from MemoryOS) - strength: 8.2        │
│  └─ face-alignment (from Wizard of Oz) - strength: 6.5      │
│                                                              │
│  💭 Inspired by Your Memories                                │
│  ├─ "Memory systems fascinate me" (Oct 30)                  │
│  ├─ "Baby photos bring so much joy" (Oct 28)                │
│  └─ "Voice notes feel effortless" (Oct 25)                  │
│                                                              │
│  🔄 Similar Ideas You Might Like                             │
│  ├─ Audio-Tagged Recipe Collection (72pts)                  │
│  ├─ Voice Journal with Photo Context (68pts)                │
│  └─ Spoken Memory Bookmarks (61pts)                         │
│                                                              │
│  [👍 Spark] [👎 Meh] [💡 Build] [🔄 Show Variations]        │
└────────────────────────────────────────────────────────────┘
```

## Notification Strategy

**Weekly Email Digest (Optional):**
```
Subject: 10 New Project Ideas This Week ✨

Hey Dan,

Polymath generated 10 new project ideas for you this week.
Here are the top 3:

1. Voice-Annotated Photo Timeline (78pts)
   Combines: voice-processing + face-alignment
   → View & Rate: [link]

2. Self-Documenting Portfolio (65pts)
   Combines: autonomous-docs + project-tracking
   → View & Rate: [link]

3. 🎲 Wild Card: Blockchain Art Gallery (42pts)
   This one's outside your usual range - try it?
   → View & Rate: [link]

[See all 10 suggestions]

---
Your creative landscape is growing:
- 3 active projects
- 12 saved ideas
- 2 projects built this month

Keep creating,
Polymath
```

**In-App Badge (Subtle):**
```
┌────────────────────────────────────┐
│  [Memories]  [Projects]  [Ideas •10] │  <- Badge shows unrated count
└────────────────────────────────────┘
```

## Mobile Experience

**Swipe Actions (Tinder-style, optional):**
```
┌────────────────────────────────────┐
│                                     │
│   Voice-Annotated Photo Timeline   │
│                                     │
│   [Card details]                    │
│                                     │
│   Swipe → for 👍                    │
│   Swipe ← for 👎                    │
│   Tap for details                   │
│   Swipe ↑ for 💡 Build              │
│                                     │
└────────────────────────────────────┘
```

**Or traditional buttons (safer UX):**
```
┌────────────────────────────────────┐
│  Voice-Annotated Photo Timeline    │
│  [Card details]                     │
│                                     │
│  [ 👍 ]  [ 👎 ]  [ 💡 ]  [ ⋯ ]      │
└────────────────────────────────────┘
```

## Feedback Loop Visualization

**Show how your ratings are shaping suggestions:**
```
┌────────────────────────────────────────────────────────────┐
│  Your Creative Graph                                        │
│                                                              │
│  Strongest Capabilities (you use these most)                │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ voice-processing│  │ embeddings      │                  │
│  │ ████████ 8.2    │  │ ██████ 6.8      │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  Emerging Interests (from MemoryOS)                         │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ memory systems  │  │ creative tools  │                  │
│  │ █████ 5.4       │  │ ████ 4.1        │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  Most Likely Next Suggestions                               │
│  - voice + creative tools (high overlap)                    │
│  - memory systems + embeddings (strong nodes)               │
│  - 🎲 Wild card: something completely different            │
│                                                              │
│  Your ratings this month: 👍 12  👎 3  💡 2                 │
└────────────────────────────────────────────────────────────┘
```

## Anti-Pattern Warnings

**What NOT to do:**

❌ **Survey fatigue** - Don't ask for ratings on every interaction
❌ **Pressure to rate** - Never block access until user rates
❌ **Over-gamification** - No points, badges, streaks for rating
❌ **Dark patterns** - Don't pre-select ratings or manipulate choices
❌ **Annoying notifications** - Weekly digest max, opt-out available

✅ **Do instead:**
- Make rating effortless (one click)
- Learn from implicit signals
- Respect user's time and attention
- Show, don't tell (visualize impact of ratings)

## Success Indicators

**Good UX if:**
- 60%+ of suggestions get rated (high engagement)
- Average time to rate < 5 seconds (effortless)
- User revisits ideas list (exploring possibility space)
- Wild cards occasionally get 👍 (diversity working)
- Built projects increase over time (ultimate validation)

**Bad UX if:**
- Most suggestions ignored (not compelling)
- Only 👎 ratings (poor synthesis quality)
- User never opens suggestions (notification fatigue)
- All wild cards dismissed (echo chamber forming)

---

**Status:** Design phase - ready for prototyping
**Next:** Build MVP suggestion card with quick actions
**See also:** `ARCHITECTURE.md` (rating logic implementation)
