# Knowledge Map: Complete Implementation Specification

## 📍 IMPLEMENTATION STATUS

### ✅ Phase 1: Foundation - COMPLETE (2025-01-08)

**Status**: Fully implemented and ready for testing

**What's Working**:
- ✅ Database migration created (`supabase/migrations/create_knowledge_map.sql`)
- ✅ API endpoint extended (`/api/projects?resource=knowledge_map`)
  - GET: Loads existing map or generates initial from user data
  - POST: Saves map state changes
  - GET with `?action=suggestions`: Ready for Phase 2 door generation
- ✅ Type definitions (`src/utils/mapTypes.ts`)
- ✅ Map calculations (`src/utils/mapCalculations.ts`)
- ✅ Map generation logic (`api/lib/map-generation.ts`)
  - Analyzes projects, memories, articles
  - Creates cities based on topics/capabilities/tags
  - Builds roads based on shared items
- ✅ Zustand store (`src/stores/useMapStore.ts`)
- ✅ React components:
  - `CityNode.tsx` - Renders cities with size-based styling
  - `Road.tsx` - Connects cities with hierarchy
  - `MapCanvas.tsx` - SVG canvas with pan/zoom
  - `KnowledgeMapPage.tsx` - Main page with loading/error states
- ✅ Routing - `/map` route added to App.tsx

**Files Created**:
```
supabase/migrations/create_knowledge_map.sql
api/lib/map-generation.ts
api/lib/map-suggestions.ts (placeholder for Phase 2)
src/utils/mapTypes.ts
src/utils/mapCalculations.ts
src/stores/useMapStore.ts
src/components/map/CityNode.tsx
src/components/map/Road.tsx
src/components/map/MapCanvas.tsx
src/pages/KnowledgeMapPage.tsx
```

**Next Session**:
1. Run database migration: Apply `create_knowledge_map.sql` to Supabase
2. Test Phase 1: Navigate to `/map` and verify cities/roads render correctly
3. Start Phase 2: Implement glowing doors ✨🚪

### 🚧 Phase 2: The Magic - Doors - NOT STARTED

**Priority**: HIGHEST (this is the killer feature)

**Remaining Tasks**:
1. Create `Door.tsx` with mesmerizing glow animations (framer-motion)
2. Create `DoorDialog.tsx` modal for suggestion details
3. Implement `mapSuggestions.ts` door generation logic:
   - New connection suggestions (bridge two cities)
   - New topic suggestions (cluster unassigned items)
   - Project idea suggestions (cross-domain opportunities)
4. Integrate doors into MapCanvas
5. Implement accept/dismiss actions

### 🚧 Phase 3: Interactions - NOT STARTED

**Remaining Tasks**:
1. Create `CityDetailsPanel.tsx` sidebar
2. Implement city click interactions
3. Add manual road creation (connect mode)
4. Implement auto-save with debouncing
5. Create `MapToolbar.tsx` and `MiniMap.tsx`

### 🚧 Phase 4: Polish - NOT STARTED

**Remaining Tasks**:
1. Upgrade city visuals (isometric buildings)
2. Enhanced road hierarchy styling
3. Growth animations (village → town transitions)
4. Create `EmptyMapState.tsx` onboarding
5. Mobile touch controls optimization
6. Final performance tuning

---

## 🎯 Vision Summary

Transform your knowledge into a living, breathing geographic map where topics become settlements (cities, towns, villages), connections become roads, and AI suggestions appear as **glowing doors** that invite exploration.

**Core Metaphor**: Your knowledge is a territory you're settling. Deep expertise = thriving cities. Strong connections = highways. New opportunities = mysterious glowing doors.

**Killer Feature**: Watching **glowing doors ✨🚪** appear in the wilderness, each one a personalized AI suggestion inviting you to explore a new connection, start a project, or bridge two domains.

---

## 🏗️ Technical Architecture

### Stack

```yaml
Frontend:
  - React 18 + TypeScript (existing)
  - Vite (existing)
  - SVG for rendering (crisp, interactive, no dependencies)
  - react-zoom-pan-pinch (pan/zoom only)
  - Framer Motion (animations only)
  - Zustand (state management, existing)

Backend:
  - Supabase (existing)
  - ZERO new serverless functions (use existing endpoints)

API Strategy (CRITICAL - Vercel limit):
  - DO NOT create new API routes
  - Extend EXISTING endpoints only:
    - GET /api/projects?resource=knowledge_map
    - POST /api/projects?resource=knowledge_map&action=save
    - GET /api/projects?resource=knowledge_map&action=suggestions
```

### Database Schema (Add to existing Supabase)

```sql
-- New table for map state persistence
CREATE TABLE knowledge_map_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  map_data JSONB NOT NULL, -- Stores cities, roads, viewport
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One map per user
);

-- Index for fast lookups
CREATE INDEX idx_knowledge_map_user ON knowledge_map_state(user_id);

-- RLS policies
ALTER TABLE knowledge_map_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own map"
  ON knowledge_map_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own map"
  ON knowledge_map_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own map"
  ON knowledge_map_state FOR UPDATE
  USING (auth.uid() = user_id);
```

### Data Structure (TypeScript)

```typescript
// Core Types
interface MapData {
  cities: City[]
  roads: Road[]
  doors: Door[]
  viewport: Viewport
  version: number
}

interface City {
  id: string // UUID
  name: string // "React", "TypeScript", etc.
  position: { x: number, y: number } // Canvas coordinates
  population: number // Count of items (projects + thoughts + articles)
  size: CitySize // Computed from population
  topicId?: string // Link to existing topic/capability
  itemIds: string[] // IDs of projects/thoughts/articles in this city
  founded: string // ISO date of first item
  lastActive: string // ISO date of most recent item
}

type CitySize = 'homestead' | 'village' | 'town' | 'city' | 'metropolis'

// Size thresholds
const SIZE_THRESHOLDS = {
  homestead: 1,   // 1-2 items
  village: 3,     // 3-9 items
  town: 10,       // 10-19 items
  city: 20,       // 20-49 items
  metropolis: 50  // 50+ items
}

interface Road {
  id: string
  fromCityId: string
  toCityId: string
  strength: number // 1-10 (based on connection count)
  type: RoadType // Computed from strength
  connectionIds: string[] // IDs of actual connections between items
  built: string // ISO date
  lastTraveled: string // ISO date of most recent connection activity
}

type RoadType = 'trail' | 'country' | 'main' | 'highway'

// Road type based on strength
const ROAD_TYPES = {
  trail: 1,    // 1-2 connections
  country: 3,  // 3-5 connections
  main: 6,     // 6-10 connections
  highway: 11  // 11+ connections
}

interface Door {
  id: string
  position: { x: number, y: number }
  type: DoorType
  suggestionData: any // Depends on type
  glowIntensity: number // 0-1 for animation
  created: string // ISO date
  dismissed: boolean
}

type DoorType =
  | 'new_connection' // Suggest connecting two existing cities
  | 'new_topic'      // Suggest creating new city from cluster
  | 'project_idea'   // Suggest project based on knowledge
  | 'bridge'         // Suggest cross-domain opportunity

interface Viewport {
  x: number
  y: number
  scale: number
}
```

---

## 📁 File Structure

Create these new files:

```
src/pages/
  KnowledgeMapPage.tsx              # Main page (replaces ConstellationView)

src/components/map/
  MapCanvas.tsx                      # SVG canvas with pan/zoom wrapper
  CityNode.tsx                       # Individual city rendering
  Road.tsx                           # Road line between cities
  Door.tsx                           # Glowing door portal (PRIORITY)
  DoorDialog.tsx                     # Door suggestion details modal
  CityDetailsPanel.tsx               # Sidebar when clicking city
  MapToolbar.tsx                     # Top toolbar (zoom, connect mode)
  MiniMap.tsx                        # Bottom-right overview
  EmptyMapState.tsx                  # First-time user experience

src/stores/
  useMapStore.ts                     # Zustand store for map state

src/utils/
  mapCalculations.ts                 # City size, road type calculations
  mapGeneration.ts                   # Generate initial map from user data
  mapSuggestions.ts                  # Door/portal suggestion logic
  mapPersistence.ts                  # Save/load to Supabase
```

---

## 🚀 Implementation Phases (Autonomous Agent Timeline)

### Phase 1: Foundation (Days 1-2)

**Goal**: Render basic map with cities and roads

**Tasks**:
1. Create database migration (knowledge_map_state table)
2. Extend `/api/projects` to handle `resource=knowledge_map`
3. Create `useMapStore.ts` with basic state
4. Create `KnowledgeMapPage.tsx` with SVG canvas
5. Create `CityNode.tsx` - simple circles for now
6. Create `Road.tsx` - simple lines
7. Implement pan & zoom with react-zoom-pan-pinch
8. Add route to access page (`/map`)

**Success Criteria**:
- [ ] Can navigate to `/map` page
- [ ] See 5+ cities rendered as circles with labels
- [ ] See roads connecting related cities
- [ ] Pan and zoom works smoothly
- [ ] Cities sized correctly (homestead smallest, metropolis largest)

**Implementation Notes**:

```typescript
// src/utils/mapGeneration.ts
export async function generateInitialMap(userId: string): Promise<MapData> {
  // 1. Fetch all user's projects, thoughts, articles
  const [projects, memories, articles] = await Promise.all([
    fetch('/api/projects').then(r => r.json()),
    fetch('/api/memories').then(r => r.json()),
    fetch('/api/reading').then(r => r.json())
  ])

  // 2. Extract all topics/capabilities/themes
  const topicCounts = new Map<string, { items: string[], connections: Set<string> }>()

  // Count projects by topic
  projects.forEach(p => {
    p.metadata?.capabilities?.forEach(cap => {
      if (!topicCounts.has(cap.name)) {
        topicCounts.set(cap.name, { items: [], connections: new Set() })
      }
      topicCounts.get(cap.name)!.items.push(p.id)
    })
  })

  // Count thoughts by topic
  memories.forEach(m => {
    m.entities?.topics?.slice(0, 3).forEach(topic => {
      if (!topicCounts.has(topic)) {
        topicCounts.set(topic, { items: [], connections: new Set() })
      }
      topicCounts.get(topic)!.items.push(m.id)
    })
  })

  // Count articles by tags/topics
  articles.forEach(a => {
    a.tags?.forEach(tag => {
      if (!topicCounts.has(tag)) {
        topicCounts.set(tag, { items: [], connections: new Set() })
      }
      topicCounts.get(tag)!.items.push(a.id)
    })
  })

  // 3. Create cities from topics with 1+ items
  const cities: City[] = Array.from(topicCounts.entries())
    .filter(([_, data]) => data.items.length > 0)
    .map(([name, data], index) => ({
      id: `city-${index}`,
      name,
      position: gridLayout(index, topicCounts.size), // Simple grid for Phase 1
      population: data.items.length,
      size: getSizeFromPopulation(data.items.length),
      itemIds: data.items,
      founded: new Date().toISOString(),
      lastActive: new Date().toISOString()
    }))

  // 4. Create roads based on shared items
  const roads: Road[] = []
  for (let i = 0; i < cities.length; i++) {
    for (let j = i + 1; j < cities.length; j++) {
      const shared = cities[i].itemIds.filter(id => cities[j].itemIds.includes(id))
      if (shared.length > 0) {
        roads.push({
          id: `road-${i}-${j}`,
          fromCityId: cities[i].id,
          toCityId: cities[j].id,
          strength: shared.length,
          type: getRoadTypeFromStrength(shared.length),
          connectionIds: shared,
          built: new Date().toISOString(),
          lastTraveled: new Date().toISOString()
        })
      }
    }
  }

  return {
    cities,
    roads,
    doors: [], // No doors in Phase 1
    viewport: { x: 0, y: 0, scale: 1 },
    version: 1
  }
}

function gridLayout(index: number, total: number): { x: number, y: number } {
  const cols = Math.ceil(Math.sqrt(total))
  const row = Math.floor(index / cols)
  const col = index % cols
  return {
    x: 200 + col * 300,
    y: 200 + row * 300
  }
}

function getSizeFromPopulation(pop: number): CitySize {
  if (pop >= 50) return 'metropolis'
  if (pop >= 20) return 'city'
  if (pop >= 10) return 'town'
  if (pop >= 3) return 'village'
  return 'homestead'
}

function getRoadTypeFromStrength(strength: number): RoadType {
  if (strength >= 11) return 'highway'
  if (strength >= 6) return 'main'
  if (strength >= 3) return 'country'
  return 'trail'
}
```

```typescript
// src/components/map/CityNode.tsx
export function CityNode({ city, onClick }: { city: City, onClick: () => void }) {
  const radius = {
    homestead: 20,
    village: 35,
    town: 50,
    city: 70,
    metropolis: 100
  }[city.size]

  return (
    <g onClick={onClick} className="cursor-pointer group">
      {/* Main circle */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius}
        className="transition-all"
        style={{
          fill: 'var(--premium-bg-3)',
          stroke: 'var(--premium-blue)',
          strokeWidth: 2,
          filter: 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.3))'
        }}
      />

      {/* Population indicator */}
      <circle
        cx={city.position.x}
        cy={city.position.y}
        r={radius * 0.3}
        fill="var(--premium-blue)"
        opacity={0.5}
      />

      {/* Label */}
      <text
        x={city.position.x}
        y={city.position.y - radius - 15}
        textAnchor="middle"
        fill="var(--premium-text-primary)"
        fontSize={14}
        fontWeight={600}
      >
        {city.name}
      </text>

      {/* Population count */}
      <text
        x={city.position.x}
        y={city.position.y + 5}
        textAnchor="middle"
        fill="white"
        fontSize={12}
      >
        {city.population}
      </text>
    </g>
  )
}
```

### Phase 2: The Magic - Doors (Days 3-4) ⭐ PRIORITY

**Goal**: Glowing doors appear with AI suggestions

**Tasks**:
1. Create `Door.tsx` component with glow animation
2. Create `DoorDialog.tsx` for suggestion details
3. Implement `mapSuggestions.ts` with door generation logic
4. Add door rendering to MapCanvas
5. Add door click interaction
6. Implement "Accept" action (creates city or road)
7. Implement "Dismiss" action (fades door)

**Success Criteria**:
- [ ] Doors appear in appropriate locations on the map
- [ ] Doors have mesmerizing glow/pulse animation
- [ ] Clicking door shows suggestion with context
- [ ] Accepting suggestion creates visible result
- [ ] Dismissed doors fade away gracefully

**Implementation Notes**:

```typescript
// src/components/map/Door.tsx
export function Door({ door, onClick }: { door: Door, onClick: () => void }) {
  return (
    <g
      onClick={onClick}
      className="cursor-pointer"
      style={{ transformOrigin: `${door.position.x}px ${door.position.y}px` }}
    >
      {/* Outer glow */}
      <motion.circle
        cx={door.position.x}
        cy={door.position.y}
        r={40}
        fill="none"
        stroke="var(--premium-gold)"
        strokeWidth={2}
        opacity={0.3}
        animate={{
          r: [40, 50, 40],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Middle glow */}
      <motion.circle
        cx={door.position.x}
        cy={door.position.y}
        r={30}
        fill="rgba(251, 191, 36, 0.2)"
        animate={{
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Door icon */}
      <g transform={`translate(${door.position.x - 12}, ${door.position.y - 12})`}>
        <rect
          x={0}
          y={0}
          width={24}
          height={24}
          rx={2}
          fill="var(--premium-bg-3)"
          stroke="var(--premium-gold)"
          strokeWidth={2}
        />
        <circle
          cx={18}
          cy={12}
          r={2}
          fill="var(--premium-gold)"
        />
      </g>

      {/* Sparkles */}
      <motion.g
        animate={{
          rotate: [0, 360]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        {[0, 90, 180, 270].map(angle => (
          <circle
            key={angle}
            cx={door.position.x + Math.cos(angle * Math.PI / 180) * 35}
            cy={door.position.y + Math.sin(angle * Math.PI / 180) * 35}
            r={2}
            fill="var(--premium-gold)"
            opacity={0.6}
          />
        ))}
      </motion.g>
    </g>
  )
}
```

```typescript
// src/utils/mapSuggestions.ts
export async function generateDoorSuggestions(
  userId: string,
  currentMap: MapData
): Promise<Door[]> {
  const doors: Door[] = []

  // SUGGESTION TYPE 1: New Connection (bridge two cities)
  // Find cities with shared items but no road
  for (let i = 0; i < currentMap.cities.length; i++) {
    for (let j = i + 1; j < currentMap.cities.length; j++) {
      const cityA = currentMap.cities[i]
      const cityB = currentMap.cities[j]

      // Check if road already exists
      const roadExists = currentMap.roads.some(r =>
        (r.fromCityId === cityA.id && r.toCityId === cityB.id) ||
        (r.fromCityId === cityB.id && r.toCityId === cityA.id)
      )

      if (roadExists) continue

      // Check for potential connection (shared items or similar topics)
      const sharedItems = cityA.itemIds.filter(id => cityB.itemIds.includes(id))

      if (sharedItems.length >= 2) {
        // Position door midway between cities
        doors.push({
          id: `door-connect-${i}-${j}`,
          position: {
            x: (cityA.position.x + cityB.position.x) / 2,
            y: (cityA.position.y + cityB.position.y) / 2
          },
          type: 'new_connection',
          suggestionData: {
            cityAId: cityA.id,
            cityBId: cityB.id,
            cityAName: cityA.name,
            cityBName: cityB.name,
            reason: `You have ${sharedItems.length} items that connect ${cityA.name} and ${cityB.name}. Building a road would strengthen this relationship.`,
            sharedItems
          },
          glowIntensity: 0.8,
          created: new Date().toISOString(),
          dismissed: false
        })
      }
    }
  }

  // SUGGESTION TYPE 2: New Topic (cluster of unassigned items)
  // Find items that don't belong to any city but share topics
  const allAssignedIds = new Set(currentMap.cities.flatMap(c => c.itemIds))
  const [memories, projects, articles] = await Promise.all([
    fetch('/api/memories').then(r => r.json()),
    fetch('/api/projects').then(r => r.json()),
    fetch('/api/reading').then(r => r.json())
  ])

  const unassignedItems = [
    ...memories.filter(m => !allAssignedIds.has(m.id)),
    ...projects.filter(p => !allAssignedIds.has(p.id)),
    ...articles.filter(a => !allAssignedIds.has(a.id))
  ]

  // Cluster by shared topics
  const topicClusters = new Map<string, any[]>()
  unassignedItems.forEach(item => {
    const topics = item.entities?.topics || item.metadata?.capabilities || item.tags || []
    topics.forEach(topic => {
      if (!topicClusters.has(topic)) {
        topicClusters.set(topic, [])
      }
      topicClusters.get(topic)!.push(item)
    })
  })

  // Suggest new cities for clusters of 3+ items
  topicClusters.forEach((items, topic) => {
    if (items.length >= 3 && !currentMap.cities.some(c => c.name === topic)) {
      // Position in open space (simplified - just offset from center)
      doors.push({
        id: `door-topic-${topic}`,
        position: {
          x: 500 + Math.random() * 400,
          y: 500 + Math.random() * 400
        },
        type: 'new_topic',
        suggestionData: {
          topicName: topic,
          itemCount: items.length,
          items: items.map(i => ({ id: i.id, title: i.title })),
          reason: `You have ${items.length} items about ${topic}. This could become a new village on your map.`
        },
        glowIntensity: 1.0,
        created: new Date().toISOString(),
        dismissed: false
      })
    }
  })

  // SUGGESTION TYPE 3: Project Idea (based on city combinations)
  // Find two cities with high populations that aren't connected
  const largeCities = currentMap.cities.filter(c => c.population >= 10)
  for (let i = 0; i < largeCities.length; i++) {
    for (let j = i + 1; j < largeCities.length; j++) {
      const cityA = largeCities[i]
      const cityB = largeCities[j]

      const roadExists = currentMap.roads.some(r =>
        (r.fromCityId === cityA.id && r.toCityId === cityB.id) ||
        (r.fromCityId === cityB.id && r.toCityId === cityA.id)
      )

      if (!roadExists) {
        doors.push({
          id: `door-project-${i}-${j}`,
          position: {
            x: (cityA.position.x + cityB.position.x) / 2 + (Math.random() - 0.5) * 100,
            y: (cityA.position.y + cityB.position.y) / 2 + (Math.random() - 0.5) * 100
          },
          type: 'project_idea',
          suggestionData: {
            cityAName: cityA.name,
            cityBName: cityB.name,
            reason: `Your expertise in ${cityA.name} and ${cityB.name} could combine into a unique project. What if you built something at the intersection?`,
            suggestion: `A project combining ${cityA.name} and ${cityB.name}`
          },
          glowIntensity: 0.9,
          created: new Date().toISOString(),
          dismissed: false
        })
      }
    }
  }

  // Limit to 5 doors max (don't overwhelm)
  return doors.slice(0, 5)
}
```

```typescript
// src/components/map/DoorDialog.tsx
export function DoorDialog({
  door,
  open,
  onClose,
  onAccept,
  onDismiss
}: {
  door: Door
  open: boolean
  onClose: () => void
  onAccept: () => void
  onDismiss: () => void
}) {
  if (!open) return null

  const { type, suggestionData } = door

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        className="premium-card p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Icon based on type */}
        <div className="mb-4 flex items-center gap-3">
          {type === 'new_connection' && (
            <>
              <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                <Link2 className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
              </div>
              <div>
                <h3 className="text-xl font-bold premium-text-platinum">New Connection</h3>
                <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                  Bridge two cities
                </p>
              </div>
            </>
          )}

          {type === 'new_topic' && (
            <>
              <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
              </div>
              <div>
                <h3 className="text-xl font-bold premium-text-platinum">New Territory</h3>
                <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                  Found a new settlement
                </p>
              </div>
            </>
          )}

          {type === 'project_idea' && (
            <>
              <div className="p-3 rounded-full" style={{ background: 'var(--premium-bg-3)' }}>
                <Lightbulb className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
              </div>
              <div>
                <h3 className="text-xl font-bold premium-text-platinum">Project Opportunity</h3>
                <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                  Cross-domain innovation
                </p>
              </div>
            </>
          )}
        </div>

        {/* Reason */}
        <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--premium-bg-3)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
            {suggestionData.reason}
          </p>
        </div>

        {/* Details based on type */}
        {type === 'new_connection' && (
          <div className="mb-6">
            <p className="text-sm mb-2" style={{ color: 'var(--premium-text-tertiary)' }}>
              This would connect:
            </p>
            <div className="flex items-center gap-3 justify-center">
              <span className="px-3 py-1 rounded-lg" style={{ background: 'var(--premium-bg-3)', color: 'var(--premium-blue)' }}>
                {suggestionData.cityAName}
              </span>
              <ArrowRight className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
              <span className="px-3 py-1 rounded-lg" style={{ background: 'var(--premium-bg-3)', color: 'var(--premium-blue)' }}>
                {suggestionData.cityBName}
              </span>
            </div>
          </div>
        )}

        {type === 'new_topic' && (
          <div className="mb-6">
            <p className="text-sm mb-2" style={{ color: 'var(--premium-text-tertiary)' }}>
              Found {suggestionData.itemCount} items:
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {suggestionData.items.slice(0, 5).map(item => (
                <div key={item.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--premium-bg-3)', color: 'var(--premium-text-secondary)' }}>
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--premium-gold), #d97706)',
              color: 'white'
            }}
          >
            Open This Door
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-3 rounded-lg font-medium transition-all"
            style={{
              background: 'var(--premium-bg-3)',
              color: 'var(--premium-text-secondary)'
            }}
          >
            Not Now
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

### Phase 3: Interactions (Days 5-6)

**Goal**: Full interactivity - click cities, create roads, save state

**Tasks**:
1. Create `CityDetailsPanel.tsx`
2. Implement city click → show details
3. Implement manual road creation (connect mode)
4. Add save/load from Supabase
5. Add auto-save (debounced)
6. Add toolbar with controls
7. Add minimap

**Success Criteria**:
- [ ] Clicking city shows details panel
- [ ] Can manually connect two cities
- [ ] Map state persists across sessions
- [ ] Minimap shows overview
- [ ] All interactions feel smooth

### Phase 4: Polish (Days 7-8)

**Goal**: Production-ready beautiful experience

**Tasks**:
1. Upgrade city visuals (isometric buildings)
2. Add road hierarchy styling
3. Add growth animations (village → town)
4. Add night mode
5. Add empty state onboarding
6. Performance optimization
7. Mobile touch controls

**Success Criteria**:
- [ ] Cities look like actual settlements
- [ ] Roads show visual hierarchy
- [ ] Growth transitions are satisfying
- [ ] Works smoothly on mobile
- [ ] New users understand immediately

---

## 🔧 API Integration (CRITICAL - No New Routes)

### Extend Existing `/api/projects` Endpoint

```typescript
// In api/projects.ts - ADD these cases to existing handler

if (resource === 'knowledge_map') {
  // GET: Load map state
  if (req.method === 'GET') {
    const action = req.query.action as string

    if (action === 'suggestions') {
      // Generate door suggestions
      const { data: mapState } = await supabase
        .from('knowledge_map_state')
        .select('map_data')
        .eq('user_id', userId)
        .single()

      if (!mapState) {
        return res.status(404).json({ error: 'Map not found' })
      }

      const doors = await generateDoorSuggestions(userId, mapState.map_data)
      return res.status(200).json({ doors })
    }

    // Default: Load existing map or generate initial
    const { data: existingMap } = await supabase
      .from('knowledge_map_state')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (existingMap) {
      return res.status(200).json({
        mapData: existingMap.map_data,
        version: existingMap.version
      })
    }

    // No map exists - generate initial
    const initialMap = await generateInitialMap(userId)

    // Save it
    const { error } = await supabase
      .from('knowledge_map_state')
      .insert({
        user_id: userId,
        map_data: initialMap,
        version: 1
      })

    if (error) throw error

    return res.status(200).json({
      mapData: initialMap,
      version: 1,
      generated: true
    })
  }

  // POST: Save map state
  if (req.method === 'POST') {
    const { mapData } = req.body

    const { error } = await supabase
      .from('knowledge_map_state')
      .upsert({
        user_id: userId,
        map_data: mapData,
        version: mapData.version,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (error) throw error

    return res.status(200).json({ success: true })
  }
}
```

---

## ✅ Testing & Validation Checklist

### Phase 1 Validation
- [ ] Navigate to `/map` and see cities
- [ ] Pan around the map smoothly
- [ ] Zoom in and out without lag
- [ ] City sizes match their population
- [ ] Roads connect related cities
- [ ] City labels are readable
- [ ] Colors use premium palette

### Phase 2 Validation (MOST IMPORTANT)
- [ ] At least one door appears on the map
- [ ] Door has mesmerizing glow animation
- [ ] Clicking door opens suggestion dialog
- [ ] Dialog explains suggestion clearly
- [ ] Accepting creates visible result (new road or city)
- [ ] Dismissing makes door fade away
- [ ] Multiple door types work (connection, topic, project)

### Phase 3 Validation
- [ ] Clicking city shows details panel
- [ ] Panel shows correct data (population, items, connections)
- [ ] Connect mode allows linking two cities
- [ ] New road appears immediately
- [ ] Map saves after changes
- [ ] Reloading page shows saved state
- [ ] Minimap reflects current view

### Phase 4 Validation
- [ ] Cities look polished (not just circles)
- [ ] Roads show hierarchy (highway vs trail)
- [ ] Growth animation plays when city upgrades
- [ ] Empty state guides new users
- [ ] Works on mobile with touch
- [ ] No performance issues with 20+ cities

---

## 🎨 Visual Style Guide

### Colors (Use Existing Premium Palette)
```css
/* From your existing CSS variables */
--premium-bg-1: rgba(20, 27, 38, 0.95)
--premium-bg-2: rgba(26, 35, 50, 0.95)
--premium-bg-3: rgba(32, 43, 62, 0.95)
--premium-blue: #3b82f6
--premium-indigo: #6366f1
--premium-purple: #8b5cf6
--premium-gold: #fbbf24
--premium-emerald: #10b981
--premium-platinum: #e5e7eb
```

### City Styling
```typescript
const cityColors = {
  homestead: 'rgba(156, 163, 175, 0.5)', // Gray
  village: 'rgba(59, 130, 246, 0.3)',     // Blue
  town: 'rgba(99, 102, 241, 0.4)',        // Indigo
  city: 'rgba(139, 92, 246, 0.5)',        // Purple
  metropolis: 'rgba(251, 191, 36, 0.6)'   // Gold
}
```

### Road Styling
```typescript
const roadStyles = {
  trail: {
    width: 2,
    color: 'rgba(255, 255, 255, 0.2)',
    dashArray: '5,5'
  },
  country: {
    width: 3,
    color: 'rgba(255, 255, 255, 0.3)',
    dashArray: undefined
  },
  main: {
    width: 5,
    color: 'rgba(59, 130, 246, 0.4)',
    dashArray: undefined
  },
  highway: {
    width: 8,
    color: 'rgba(59, 130, 246, 0.6)',
    dashArray: undefined
  }
}
```

### Door/Portal Styling
```css
/* Glowing door - MUST be mesmerizing */
.door-glow {
  filter: drop-shadow(0 0 20px var(--premium-gold))
         drop-shadow(0 0 40px var(--premium-gold));
}

/* Pulse animation */
@keyframes door-pulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}
```

---

## 🚨 Common Pitfalls & How to Avoid

### 1. Vercel Function Limit
**Problem**: We're at 11/12 serverless functions
**Solution**:
- ✅ Use `resource=knowledge_map` on existing `/api/projects` route
- ❌ DO NOT create new `/api/knowledge-map` route
- ✅ Use query params for different actions (`?action=suggestions`)

### 2. Performance with Many Items
**Problem**: 100+ cities could lag
**Solution**:
- Use viewport culling (only render visible cities)
- Use CSS transforms instead of SVG attributes where possible
- Debounce zoom/pan events
- Use `will-change` CSS property on animated elements

### 3. Door Positioning
**Problem**: Doors could overlap cities
**Solution**:
- Check distance from all cities before placing door
- Minimum 100px from any city center
- Use open space in wilderness

### 4. Initial Map Generation
**Problem**: User with 1000+ items takes too long
**Solution**:
- Limit to top 20 topics by item count
- Process in background, show loading state
- Cache generated map in database

### 5. Mobile Touch
**Problem**: Pan/zoom conflicts with door clicks
**Solution**:
- Use touch-action: none on SVG
- Distinguish between drag (pan) and tap (click)
- Larger tap targets on mobile (50px min)

---

## 📊 Success Metrics

### Engagement Metrics
- **Activation**: % users who interact with first door (Target: >70%)
- **Retention**: % users who return to map within 7 days (Target: >40%)
- **Discovery**: Average doors clicked per session (Target: >2)
- **Growth**: Average cities created per user per week (Target: >1)

### Quality Metrics
- **Performance**: Map loads in <2s (Target: <1.5s)
- **Smoothness**: Pan/zoom at 60fps (Target: Always)
- **Delight**: Door animation wow factor (Target: Qualitative feedback)

---

## 🎯 Final Instructions for Implementation

### For the Autonomous Agent:

1. **Start with Phase 1**: Get the basic map rendering first. Don't skip ahead.

2. **Check After Each Phase**: Run the validation checklist. If something doesn't work, fix it before moving on.

3. **Prioritize Doors**: Phase 2 is the most important. The door experience must be magical.

4. **Use Existing Code**: You have access to:
   - Existing Supabase setup
   - Existing API routes (extend, don't create new)
   - Existing UI components (premium-card, etc.)
   - Existing stores (Zustand pattern)

5. **Test Continuously**: After each component, test it in the browser. Don't build blind.

6. **Build Incrementally**:
   - Day 1: Cities rendering
   - Day 2: Roads + pan/zoom
   - Day 3: Doors component
   - Day 4: Door suggestions logic
   - Day 5: Click interactions
   - Day 6: Save/load
   - Day 7: Polish visuals
   - Day 8: Mobile + final testing

7. **When in Doubt**: Refer back to this spec. Everything you need is documented here.

---

## 🚪 The Door is Open

This specification is complete and ready for implementation. The autonomous agent has everything needed to build the Knowledge Map.

**Expected Timeline**: 8 days with autonomous agents working continuously

**Expected Outcome**: A living, breathing map where knowledge becomes geography, and glowing doors invite endless exploration.

Build it. Make the doors mesmerizing. Ship it.
