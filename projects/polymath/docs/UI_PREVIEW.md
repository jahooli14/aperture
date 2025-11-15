# 🎨 UI Preview - What You'll See

> **Visual guide to the Polymath interface**

---

## Home Page (`/`)

```
┌─────────────────────────────────────────────────────────┐
│  🎨 Polymath          Suggestions    Projects           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                     🎨 Polymath                          │
│         Your meta-creative synthesis engine              │
│     Generates novel project ideas by combining           │
│        your capabilities with your interests             │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │    4     │  │    2     │  │    1     │  │    3     ││
│  │New Sugg. │  │⚡ Sparks │  │  Active  │  │  Total   ││
│  │Ready to  │  │Ideas you │  │Currently │  │All time  ││
│  │rate →    │  │liked →   │  │working→  │  │projects→ ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                                                          │
│                  How It Works                            │
│                                                          │
│  ① 📝 Capture     ② 🔍 Scan       ③ 🤖 AI         ④ ⚡ Rate    │
│  Voice notes     Codebase for    Generates      & Build   │
│  reveal themes   capabilities     novel ideas    Learn     │
│                                                          │
│         [View Suggestions →]  [View Projects]            │
│                                                          │
└─────────────────────────────────────────────────────────┘
     Meta-creative synthesis engine • Generates novel ideas
```

---

## Suggestions Page (`/suggestions`)

```
┌─────────────────────────────────────────────────────────┐
│  🎨 Polymath          Suggestions    Projects           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Project Suggestions                                     │
│  AI-generated ideas combining capabilities & interests   │
│                                                          │
│  [New] [⚡Sparks] [💾Saved] [✅Built] [All]   Sort: Points▼│
│                                                          │
│  ┌────────────────────────────┐  ┌─────────────────────┐│
│  │ 🎲 Wild Card              │  │                     ││
│  │ Self-Healing Docs    71pts│  │ Baby Face Journey   ││
│  │                           │  │                65pts││
│  │ Combines doc generation   │  │                     ││
│  │ with health monitoring... │  │ Combines face       ││
│  │                           │  │ alignment + timeline││
│  │ Novelty: 85% Feasible: 70%│  │                     ││
│  │ Interest: 60%             │  │ Novelty: 70%        ││
│  │                           │  │ Feasible: 80%       ││
│  │ [👍Spark] [👎Meh] [💡Build]│  │ Interest: 45%       ││
│  │                    [⋯More]│  │                     ││
│  └────────────────────────────┘  │ [👍] [👎] [💡] [⋯]   ││
│                                  └─────────────────────┘│
│  ┌────────────────────────────┐  ┌─────────────────────┐│
│  │ Voice Memory Timeline      │  │ Personal API        ││
│  │                       68pts│  │ Gateway        58pts││
│  │ ...                        │  │ ...                 ││
│  └────────────────────────────┘  └─────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Projects Page (`/projects`)

```
┌─────────────────────────────────────────────────────────┐
│  🎨 Polymath          Suggestions    Projects           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  My Projects                                             │
│  Track your creative work and strengthen capabilities    │
│                                                          │
│  [All] [🚀Active] [💤Dormant] [✅Completed]    3 projects │
│                                                          │
│  ┌────────────────────────────┐  ┌─────────────────────┐│
│  │ 🚀 Polymath UI             │  │ 🚀 Baby Photo App   ││
│  │ Technical • Active         │  │ Personal • Active   ││
│  │                            │  │                     ││
│  │ Building the meta-creative │  │ Face-aligned photo  ││
│  │ synthesis interface with   │  │ timeline for our    ││
│  │ React and TypeScript...    │  │ daughter's journey  ││
│  │                            │  │                     ││
│  │ Last active: 2 hours ago   │  │ Last: 1 day ago     ││
│  │ From: AI Baby Timeline     │  │ From: Suggestion    ││
│  └────────────────────────────┘  └─────────────────────┘│
│                                                          │
│  ┌────────────────────────────┐                         │
│  │ 💤 Autonomous Docs         │                         │
│  │ Meta • Dormant             │                         │
│  │ ...                        │                         │
│  └────────────────────────────┘                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Empty States

### No Suggestions Yet
```
┌─────────────────────────────┐
│   No suggestions yet        │
│                             │
│   Run the synthesis script  │
│   to generate project ideas:│
│                             │
│   npx tsx scripts/polymath/ │
│   synthesis.ts              │
│                             │
│   Or seed test data:        │
│                             │
│   npx tsx scripts/polymath/ │
│   seed-test-data.ts         │
└─────────────────────────────┘
```

### No Projects Yet
```
┌─────────────────────────────┐
│   No projects yet           │
│                             │
│   Build a project from a    │
│   suggestion to get started!│
│                             │
│   Or add one manually       │
│   via the API               │
└─────────────────────────────┘
```

---

## Interactive Elements

### Suggestion Card (Detailed View)
```
┌──────────────────────────────────────────┐
│ 🎲 Wild Card                             │
│ Self-Healing Documentation System  71pts │
├──────────────────────────────────────────┤
│                                          │
│ Automatically updates documentation when │
│ code changes are detected. Uses AI to    │
│ detect outdated sections and regenerate  │
│ them with latest best practices.         │
│                                          │
│ Combines:                                │
│ [Documentation Generation] [Health       │
│  Monitoring] [AI Code Analysis]          │
│                                          │
│ Novelty: 85%  Feasibility: 70%  Interest: 60% │
│                                          │
│ [👍 Spark]  [👎 Meh]  [💡 Build]  [⋯ More]│
└──────────────────────────────────────────┘
```

### Project Card
```
┌──────────────────────────────────────────┐
│ 🚀 Polymath UI                           │
│ Technical • Active                        │
├──────────────────────────────────────────┤
│                                          │
│ Building the meta-creative synthesis     │
│ interface with React and TypeScript.     │
│ Includes suggestions browser, project    │
│ tracker, and rating system.              │
│                                          │
│ Last active: 2 hours ago                 │
│ Created: 2024-10-21                      │
│                                          │
│ From suggestion: AI Baby Photo Timeline  │
└──────────────────────────────────────────┘
```

---

## Color Scheme

### Primary Colors
- **Primary Blue**: `#2563eb` (buttons, links, highlights)
- **Background**: `#fafafa` (page background)
- **White**: `#ffffff` (cards, nav)
- **Text**: `#1a1a1a` (primary text)
- **Muted**: `#666666` (secondary text)

### Status Colors
- **Spark**: `#f59e0b` (orange/amber)
- **Wild Card**: `#fbbf24` (yellow gradient)
- **Success**: `#16a34a` (green)
- **Error**: `#dc2626` (red)

### Score Colors
- **High** (>70%): Green `#dcfce7` / `#166534`
- **Medium** (40-70%): Yellow `#fef9c3` / `#854d0e`
- **Low** (<40%): Red `#fee2e2` / `#991b1b`

---

## Responsive Design

### Desktop (>768px)
- Grid layout: 2-3 cards per row
- Sticky navigation
- Side-by-side filters and sort

### Mobile (<768px)
- Single column cards
- Stacked navigation
- Full-width buttons
- Collapsible filters

---

## Animations

- **Card Hover**: Lift (translateY -2px) + shadow
- **Button Hover**: Background color + slight lift
- **Filter Active**: Color change
- **Loading**: Simple text spinner
- **Transitions**: 0.2s ease for all

---

## Typography

- **Headings**: System font stack (-apple-system, Segoe UI, etc.)
- **Body**: Same system font
- **Code**: Monospace (Menlo, Monaco, Courier New)
- **Sizes**:
  - H1: 2-3rem
  - H2: 1.5-2rem
  - Body: 1rem
  - Small: 0.875rem
  - Tiny: 0.75rem

---

## Navigation

```
┌──────────────────────────────────────────┐
│ 🎨 Polymath    Suggestions    Projects   │ ← Sticky header
└──────────────────────────────────────────┘
```

Always visible, follows scroll, clear active states

---

## Footer

```
┌──────────────────────────────────────────┐
│ Meta-creative synthesis engine           │
│ Generates novel project ideas            │
└──────────────────────────────────────────┘
```

Simple, centered, muted text

---

**To See It Live**: Run `npm run dev` → http://localhost:5173 🎨
