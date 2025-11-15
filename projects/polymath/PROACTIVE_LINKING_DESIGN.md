# Proactive AI Linking System - Timeline Evolution Design

## Philosophy: Intentional yet Effortless

Connections should feel like they **discover themselves** - the system suggests, the user approves with minimal friction, and the timeline shows the evolution of ideas as they naturally connect over time.

---

## Core Principles

1. **Proactive, Not Reactive** - AI suggests connections automatically when content is created/edited
2. **Timeline as Narrative** - Connection events appear in timeline showing when/how ideas linked
3. **Frictionless Approval** - One tap to accept suggestions, no dialogs or forms
4. **Subtle but Discoverable** - UI feels natural, not intrusive
5. **Evolution Over Time** - Timeline shows how projects grow through connected thoughts/articles

---

## System Architecture

### 1. Auto-Suggestion Engine

**When it runs:**
- Immediately after saving new content (thought, project, article)
- On edit if content changed significantly (>30% diff)
- Background refresh every 24h for recent items (<7 days old)

**How it works:**
```typescript
// src/services/connections/autoSuggest.ts
export async function autoSuggestConnections(
  item: { type: 'project' | 'thought' | 'article', id: string, content: string }
): Promise<SuggestedConnection[]> {

  // Call AI to find relevant connections
  const response = await fetch('/api/connections/auto-suggest', {
    method: 'POST',
    body: JSON.stringify({
      itemType: item.type,
      itemId: item.id,
      content: item.content,
      existingConnections: await getExistingConnections(item.id)
    })
  })

  const suggestions = await response.json()

  // Store suggestions in local state (not dismissed until user acts)
  await storeSuggestions(item.id, suggestions)

  return suggestions
}
```

**API Endpoint Changes:**
```typescript
// api/connections/auto-suggest/route.ts
// New endpoint that:
// 1. Uses embeddings to find semantically similar content
// 2. Filters out existing connections
// 3. Returns top 3-5 suggestions with confidence scores
// 4. Includes reasoning snippet for each suggestion
```

---

### 2. Timeline Connection Events

**New Timeline Item Type: Connection**
```typescript
interface ConnectionTimelineEvent {
  type: 'connection_created'
  timestamp: string
  fromItem: { type: string, id: string, title: string }
  toItem: { type: string, id: string, title: string }
  connectionType: 'ai_suggested' | 'user_created'
  reasoning?: string // Why AI suggested this
}
```

**Timeline Display:**
```
┌─────────────────────────────────────────┐
│ Today                                   │
├─────────────────────────────────────────┤
│ ○ Thought: "Need better auth system"   │
│   2:34 PM                               │
│                                         │
│ ⟿ Connected to "User Security Project" │  ← Connection event
│   2:35 PM                               │
│   "Both discuss authentication flows"  │
│                                         │
│ ○ Linked 3 articles to reading list    │
│   1:15 PM                               │
└─────────────────────────────────────────┘
```

**Visual Design:**
- Connection events use ⟿ icon (flowing arrow)
- Subtle colored line connecting the two items if both visible
- Tap to see both connected items in split view
- Show AI reasoning as subtle gray text

---

### 3. Suggestion UI - Frictionless Approval

**Location: Everywhere content appears**

**Variant A: Inline Suggestion Card** (after saving content)
```
┌─────────────────────────────────────────────┐
│ ✓ Thought saved                             │
│                                             │
│ ✨ This might connect to:                   │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📦 User Security Project                │ │
│ │ "Both discuss authentication patterns"  │ │
│ │                                         │ │
│ │ [Link these] [Not now]                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📰 "OAuth 2.0 Best Practices"           │ │
│ │ "Implements the security approach..."   │ │
│ │                                         │ │
│ │ [Link these] [Not now]                  │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Variant B: Floating Suggestion Badge** (on cards in lists)
```
┌─────────────────────────────────┐
│ 💭 Authentication thoughts      │
│ Just now                    [3] │ ← Suggestion count badge
│                                 │
│ Need to implement 2FA...        │
└─────────────────────────────────┘

Tap badge → Shows suggestions → One tap to link
```

**Interaction Flow:**
1. User saves content → Auto-suggest runs in background
2. Subtle badge/card appears with suggestions
3. User taps "Link these" → Connection created immediately
4. Timeline event added showing the connection
5. Toast: "✓ Linked to [Project Name]"

**No dialogs, no forms, no friction.**

---

### 4. Components to Build

#### `<AutoSuggestionProvider>`
- Wraps app to manage suggestion state globally
- Listens for save events, triggers auto-suggest
- Stores pending suggestions per item

#### `<SuggestionToast>`
- Appears after saving content
- Shows 1-3 top suggestions
- Auto-dismisses after 10s if ignored
- "View all suggestions" → Opens full list

#### `<SuggestionBadge>`
- Small numbered badge on cards
- Glows subtly to draw attention
- Tap to expand suggestion list inline

#### `<TimelineConnectionEvent>`
- Timeline item showing connection creation
- Displays both connected items with reasoning
- Tap to open both in split view

#### `<ConnectionLine>`
- Visual line connecting related timeline items
- Subtle gradient in premium theme colors
- Only shown when both items visible

---

### 5. Database Schema Changes

**New Table: `connection_suggestions`**
```sql
CREATE TABLE connection_suggestions (
  id UUID PRIMARY KEY,
  from_item_type TEXT NOT NULL,
  from_item_id UUID NOT NULL,
  to_item_type TEXT NOT NULL,
  to_item_id UUID NOT NULL,
  reasoning TEXT,
  confidence FLOAT,
  status TEXT, -- 'pending', 'accepted', 'dismissed'
  created_at TIMESTAMP,
  resolved_at TIMESTAMP,
  user_id UUID REFERENCES users(id)
);
```

**Update `item_connections` table:**
```sql
ALTER TABLE item_connections
ADD COLUMN connection_type TEXT DEFAULT 'user_created',
ADD COLUMN suggestion_id UUID REFERENCES connection_suggestions(id);
```

This lets us track:
- Which connections came from AI vs manual
- Show "AI discovered this connection" in timeline
- Improve AI over time based on accepted/dismissed patterns

---

### 6. Timeline Query Changes

**Current timeline shows:**
- Projects created/updated
- Thoughts created
- Articles added to reading list

**New timeline should include:**
- Connection events (when links are created)
- Suggestion events (when AI recommends links)
- Link strengthening (when multiple items link to same thing)

**Example Timeline Query:**
```typescript
// Fetch all timeline events including connections
const timelineEvents = await supabase
  .from('timeline_events')
  .select(`
    *,
    connection:item_connections(
      from_item:from_item_id(*),
      to_item:to_item_id(*),
      reasoning
    )
  `)
  .order('created_at', { ascending: false })
```

---

## UX Flows

### Flow 1: Creating a Thought
1. User writes thought: "Need to add rate limiting to API"
2. User taps Save
3. **[Background]** Auto-suggest runs, finds connection to "API Security" project
4. **[Immediately]** Toast appears: "✨ This might connect to API Security Project"
5. User taps "Link these"
6. **[Immediately]** Connection created, timeline event added
7. Toast: "✓ Linked to API Security Project"
8. User continues working - no interruption

### Flow 2: Viewing Timeline
1. User scrolls timeline
2. Sees: "Thought: Need rate limiting" at 2:34 PM
3. Below: "⟿ Connected to API Security Project" at 2:35 PM with reasoning
4. Taps connection event
5. Split view opens showing both items
6. User sees how idea evolved into project

### Flow 3: Discovering Connections Later
1. User views "API Security" project
2. Sees suggestion badge: [2]
3. Taps badge
4. Inline list shows 2 suggested thoughts to link
5. Taps "Link" on first suggestion
6. Badge updates to [1]
7. Timeline event created showing connection

---

## Visual Design

### Colors (Premium Theme)
- Suggestion indicator: `var(--premium-purple)` with subtle glow
- Connection lines: Gradient from `--premium-blue` to `--premium-indigo`
- Timeline connection events: `var(--premium-cyan)` accent
- AI reasoning text: `rgba(255, 255, 255, 0.5)`

### Animations
- Suggestion badge: Gentle pulse (0.7s ease-in-out)
- Connection line: Draw from top to bottom (0.3s)
- Toast appearance: Slide up from bottom (0.2s spring)
- Link button: Scale to 0.95 on tap (0.1s)

### Spacing
- Suggestion toast: Bottom sheet, 50% screen height max
- Connection events: Same padding as other timeline items
- Suggestion badges: 20px circle, top-right of card

---

## Implementation Phases

### Phase 1: Auto-Suggestion Engine (Core)
- [ ] Create `/api/connections/auto-suggest` endpoint
- [ ] Build `autoSuggestConnections()` service
- [ ] Add `connection_suggestions` table
- [ ] Test AI quality with real content

### Phase 2: Timeline Integration
- [ ] Add connection events to timeline query
- [ ] Create `<TimelineConnectionEvent>` component
- [ ] Update timeline to show when/why connections made
- [ ] Add split-view on connection event tap

### Phase 3: Frictionless UI
- [ ] Build `<SuggestionToast>` for post-save suggestions
- [ ] Create `<SuggestionBadge>` for card-level indicators
- [ ] Implement one-tap linking (no dialogs)
- [ ] Add subtle animations and transitions

### Phase 4: Polish & Intelligence
- [ ] Track accepted/dismissed patterns to improve AI
- [ ] Add connection strength visualization
- [ ] Show "AI discovered" vs "User created" in timeline
- [ ] Background refresh for older content

---

## Success Metrics

**Effortless:**
- Average time from suggestion to link: <5 seconds
- Zero dialogs or forms required
- 90%+ of links created via AI suggestions

**Intentional:**
- Timeline shows clear evolution of ideas
- Users can see why/when connections were made
- AI reasoning helps users understand relationships

**Discoverable:**
- Every piece of content gets suggestions
- Timeline naturally exposes connections
- Users discover linking without being taught

---

## Next Steps

1. Get feedback on this design
2. Implement Phase 1 (auto-suggestion engine)
3. Test AI quality with your real content
4. Build timeline integration
5. Launch and iterate based on usage
