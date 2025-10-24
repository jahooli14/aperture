# Polymath UI Component Structure

> React component architecture for MemoryOS + Polymath frontend

## Overview

Polymath extends MemoryOS with new routes and components. It reuses existing MemoryOS patterns:
- React + TypeScript
- Vite for dev/build
- Zustand for state management
- Minimal, clean UI

## File Structure

```
projects/memory-os/
├── src/
│   ├── components/
│   │   ├── memories/          # Existing MemoryOS components
│   │   │   ├── MemoryCard.tsx
│   │   │   ├── MemoryList.tsx
│   │   │   └── BridgeList.tsx
│   │   │
│   │   ├── projects/          # NEW - Personal/technical projects
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectTimeline.tsx
│   │   │
│   │   ├── suggestions/       # NEW - AI-generated project suggestions
│   │   │   ├── SuggestionCard.tsx
│   │   │   ├── SuggestionList.tsx
│   │   │   ├── SuggestionDetail.tsx
│   │   │   ├── RatingActions.tsx
│   │   │   └── WildcardBadge.tsx
│   │   │
│   │   ├── capabilities/      # NEW - Technical capabilities
│   │   │   ├── CapabilityList.tsx
│   │   │   ├── CapabilityBadge.tsx
│   │   │   └── StrengthBar.tsx
│   │   │
│   │   ├── interests/         # NEW - MemoryOS interests
│   │   │   ├── InterestList.tsx
│   │   │   └── InterestBadge.tsx
│   │   │
│   │   └── shared/            # Shared components
│   │       ├── Nav.tsx        # UPDATED - Add Projects/Ideas links
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── pages/
│   │   ├── MemoriesPage.tsx       # Existing
│   │   ├── ProjectsPage.tsx       # NEW
│   │   ├── SuggestionsPage.tsx    # NEW (or IdeasPage.tsx)
│   │   ├── AllIdeasPage.tsx       # NEW - Permanent ideas list
│   │   ├── SuggestionDetailPage.tsx # NEW - "Why this?" view
│   │   └── GraphPage.tsx          # NEW - Creative graph visualization
│   │
│   ├── stores/
│   │   ├── useMemoryStore.ts      # Existing
│   │   ├── useProjectStore.ts     # NEW
│   │   ├── useSuggestionStore.ts  # NEW
│   │   └── useCapabilityStore.ts  # NEW
│   │
│   ├── lib/
│   │   ├── supabase.ts            # Existing - shared client
│   │   ├── api/
│   │   │   ├── memories.ts        # Existing
│   │   │   ├── projects.ts        # NEW
│   │   │   ├── suggestions.ts     # NEW
│   │   │   ├── capabilities.ts    # NEW
│   │   │   └── synthesis.ts       # NEW
│   │   └── types.ts               # UPDATED - Add Polymath types
│   │
│   └── App.tsx                    # UPDATED - Add new routes
```

## Core Components

### 1. SuggestionCard.tsx

**Purpose:** Display single project suggestion with rating actions

**Props:**
```typescript
interface SuggestionCardProps {
  suggestion: ProjectSuggestion
  onRate: (suggestionId: string, rating: number) => void
  onBuild: (suggestionId: string) => void
  onViewDetail: (suggestionId: string) => void
  compact?: boolean // For list view
}
```

**UI:**
```tsx
<Card className="suggestion-card">
  {suggestion.is_wildcard && <WildcardBadge />}

  <div className="header">
    <h3>{suggestion.title}</h3>
    <span className="points">{suggestion.total_points}pts</span>
  </div>

  <p className="description">{suggestion.description}</p>

  <div className="capabilities">
    {suggestion.capabilities.map(cap => (
      <CapabilityBadge key={cap.id} capability={cap} />
    ))}
  </div>

  <div className="inspired-by">
    <small>Inspired by: {suggestion.interests.join(', ')}</small>
  </div>

  <RatingActions
    onSpark={() => onRate(suggestion.id, 1)}
    onMeh={() => onRate(suggestion.id, -1)}
    onBuild={() => onBuild(suggestion.id)}
    onMore={() => onViewDetail(suggestion.id)}
  />
</Card>
```

---

### 2. RatingActions.tsx

**Purpose:** Quick rating buttons (👍 👎 💡 ⋯)

**Props:**
```typescript
interface RatingActionsProps {
  onSpark: () => void
  onMeh: () => void
  onBuild: () => void
  onMore: () => void
  disabled?: boolean
}
```

**UI:**
```tsx
<div className="rating-actions">
  <button onClick={onSpark} title="This sparks interest">
    <span>👍</span>
    <span>Spark</span>
  </button>

  <button onClick={onMeh} title="Not interested">
    <span>👎</span>
    <span>Meh</span>
  </button>

  <button onClick={onBuild} title="Build this now" className="primary">
    <span>💡</span>
    <span>Build</span>
  </button>

  <button onClick={onMore} title="Learn more">
    <span>⋯</span>
    <span>More</span>
  </button>
</div>
```

---

### 3. ProjectCard.tsx

**Purpose:** Display personal/technical project

**Props:**
```typescript
interface ProjectCardProps {
  project: Project
  onEdit: (projectId: string) => void
  onDelete: (projectId: string) => void
  showActions?: boolean
}
```

**UI:**
```tsx
<Card className="project-card">
  <div className="header">
    <h3>{project.title}</h3>
    <Badge>{project.type}</Badge>
  </div>

  <p>{project.description}</p>

  <div className="metadata">
    <span>Last active: {formatRelativeTime(project.last_active)}</span>
    <span className={`status ${project.status}`}>{project.status}</span>
  </div>

  {project.metadata?.tags && (
    <div className="tags">
      {project.metadata.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
    </div>
  )}

  {showActions && (
    <div className="actions">
      <button onClick={() => onEdit(project.id)}>Edit</button>
      <button onClick={() => onDelete(project.id)}>Delete</button>
    </div>
  )}
</Card>
```

---

### 4. SuggestionDetail.tsx

**Purpose:** "Why this?" detail view

**Props:**
```typescript
interface SuggestionDetailProps {
  suggestionId: string
}
```

**UI:**
```tsx
<div className="suggestion-detail">
  <button onClick={onBack}>← Back</button>

  <h1>{suggestion.title}</h1>
  <p className="points">{suggestion.total_points} points</p>

  <section>
    <h2>📊 Scoring Breakdown</h2>
    <ScoreBar label="Novelty" score={suggestion.novelty_score} />
    <ScoreBar label="Feasibility" score={suggestion.feasibility_score} />
    <ScoreBar label="Interest" score={suggestion.interest_score} />
  </section>

  <section>
    <h2>🧩 Capabilities Combined</h2>
    {suggestion.capabilities.map(cap => (
      <CapabilityCard key={cap.id} capability={cap} />
    ))}
  </section>

  <section>
    <h2>💭 Inspired by Your Memories</h2>
    {suggestion.memories.map(memory => (
      <MemoryCard key={memory.id} memory={memory} compact />
    ))}
  </section>

  <section>
    <h2>🤔 Why This Idea?</h2>
    <p>{suggestion.synthesis_reasoning}</p>
  </section>

  <section>
    <h2>🔄 Similar Ideas</h2>
    {similarSuggestions.map(s => (
      <SuggestionCard key={s.id} suggestion={s} compact />
    ))}
  </section>

  <RatingActions {...ratingProps} />
</div>
```

---

### 5. ProjectTimeline.tsx

**Purpose:** Visual timeline of project activity

**Props:**
```typescript
interface ProjectTimelineProps {
  projects: Project[]
}
```

**UI:**
```tsx
<div className="timeline">
  {sortedProjects.map(project => (
    <div key={project.id} className="timeline-item">
      <div className="date">{formatDate(project.last_active)}</div>
      <div className="project">
        <h4>{project.title}</h4>
        <Badge>{project.status}</Badge>
      </div>
    </div>
  ))}
</div>
```

---

### 6. CapabilityBadge.tsx

**Purpose:** Show capability with strength indicator

**Props:**
```typescript
interface CapabilityBadgeProps {
  capability: Capability
  showStrength?: boolean
}
```

**UI:**
```tsx
<span className="capability-badge" title={capability.description}>
  {capability.name}
  {showStrength && (
    <span className="strength">{capability.strength.toFixed(1)}</span>
  )}
</span>
```

---

### 7. WildcardBadge.tsx

**Purpose:** Visual indicator for diversity injections

**UI:**
```tsx
<div className="wildcard-badge" title="This idea is outside your usual range">
  <span>🎲</span>
  <span>Wild Card</span>
</div>
```

---

## Pages

### SuggestionsPage.tsx

**Route:** `/suggestions` or `/ideas`

**Purpose:** Weekly digest of new suggestions

```tsx
export function SuggestionsPage() {
  const { suggestions, loading } = useSuggestionStore()

  if (loading) return <Loading />

  return (
    <div className="suggestions-page">
      <header>
        <h1>New Ideas This Week</h1>
        <p>{formatDate(Date.now())}</p>
      </header>

      <SuggestionList
        suggestions={suggestions}
        onRate={handleRate}
        onBuild={handleBuild}
        onViewDetail={handleViewDetail}
      />

      <footer>
        <Link to="/ideas/all">View all ideas →</Link>
      </footer>
    </div>
  )
}
```

---

### ProjectsPage.tsx

**Route:** `/projects`

**Purpose:** List all projects (personal + technical)

```tsx
export function ProjectsPage() {
  const { projects, createProject, updateProject, deleteProject } = useProjectStore()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="projects-page">
      <header>
        <h1>Projects</h1>
        <button onClick={() => setShowForm(true)}>
          + New Project
        </button>
      </header>

      <Tabs>
        <Tab label="Active">
          <ProjectList projects={activeProjects} />
        </Tab>
        <Tab label="Personal">
          <ProjectList projects={personalProjects} />
        </Tab>
        <Tab label="Technical">
          <ProjectList projects={technicalProjects} />
        </Tab>
        <Tab label="Timeline">
          <ProjectTimeline projects={projects} />
        </Tab>
      </Tabs>

      {showForm && (
        <ProjectForm
          onSubmit={createProject}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
```

---

### AllIdeasPage.tsx

**Route:** `/ideas/all`

**Purpose:** Permanent ideas list (all suggestions ever)

```tsx
export function AllIdeasPage() {
  const { allSuggestions } = useSuggestionStore()
  const [filter, setFilter] = useState<'all' | 'new' | 'saved' | 'built'>('all')
  const [sortBy, setSortBy] = useState<'points' | 'recent' | 'rating'>('points')

  const filteredSuggestions = filterSuggestions(allSuggestions, filter, sortBy)

  return (
    <div className="all-ideas-page">
      <header>
        <h1>All Ideas</h1>
      </header>

      <div className="filters">
        <button onClick={() => setFilter('new')} className={filter === 'new' ? 'active' : ''}>
          New
        </button>
        <button onClick={() => setFilter('saved')} className={filter === 'saved' ? 'active' : ''}>
          Saved
        </button>
        <button onClick={() => setFilter('built')} className={filter === 'built' ? 'active' : ''}>
          Built
        </button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
          All
        </button>
      </div>

      <div className="sort">
        <label>Sort by:</label>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="points">Points</option>
          <option value="recent">Recent</option>
          <option value="rating">My Rating</option>
        </select>
      </div>

      <SuggestionList
        suggestions={filteredSuggestions}
        compact
        onRate={handleRate}
        onBuild={handleBuild}
        onViewDetail={handleViewDetail}
      />
    </div>
  )
}
```

---

## State Management (Zustand)

### useProjectStore.ts

```typescript
import create from 'zustand'
import * as api from '../lib/api/projects'

interface ProjectStore {
  projects: Project[]
  loading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, data: UpdateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true })
    try {
      const projects = await api.getProjects()
      set({ projects, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  createProject: async (data) => {
    const project = await api.createProject(data)
    set({ projects: [...get().projects, project] })
    return project
  },

  updateProject: async (id, data) => {
    const updated = await api.updateProject(id, data)
    set({
      projects: get().projects.map(p => p.id === id ? updated : p)
    })
    return updated
  },

  deleteProject: async (id) => {
    await api.deleteProject(id)
    set({
      projects: get().projects.filter(p => p.id !== id)
    })
  }
}))
```

---

### useSuggestionStore.ts

```typescript
import create from 'zustand'
import * as api from '../lib/api/suggestions'

interface SuggestionStore {
  suggestions: ProjectSuggestion[] // This week's suggestions
  allSuggestions: ProjectSuggestion[] // Permanent list
  loading: boolean
  error: string | null

  fetchSuggestions: () => Promise<void>
  fetchAllSuggestions: () => Promise<void>
  rateSuggestion: (id: string, rating: number, feedback?: string) => Promise<void>
  buildSuggestion: (id: string) => Promise<Project>
  triggerSynthesis: () => Promise<void>
}

export const useSuggestionStore = create<SuggestionStore>((set, get) => ({
  suggestions: [],
  allSuggestions: [],
  loading: false,
  error: null,

  fetchSuggestions: async () => {
    set({ loading: true })
    try {
      const suggestions = await api.getSuggestions({ status: 'pending' })
      set({ suggestions, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },

  fetchAllSuggestions: async () => {
    const allSuggestions = await api.getAllSuggestions()
    set({ allSuggestions })
  },

  rateSuggestion: async (id, rating, feedback) => {
    await api.rateSuggestion(id, rating, feedback)
    // Update local state
    set({
      suggestions: get().suggestions.map(s =>
        s.id === id ? { ...s, status: rating > 0 ? 'rated' : 'dismissed' } : s
      )
    })
  },

  buildSuggestion: async (id) => {
    const project = await api.buildSuggestion(id)
    // Update suggestion status
    set({
      suggestions: get().suggestions.map(s =>
        s.id === id ? { ...s, status: 'built', built_project_id: project.id } : s
      )
    })
    return project
  },

  triggerSynthesis: async () => {
    set({ loading: true })
    await api.triggerSynthesis()
    await get().fetchSuggestions()
    set({ loading: false })
  }
}))
```

---

## Routing (React Router)

### App.tsx

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Nav } from './components/shared/Nav'
import { MemoriesPage } from './pages/MemoriesPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SuggestionsPage } from './pages/SuggestionsPage'
import { AllIdeasPage } from './pages/AllIdeasPage'
import { SuggestionDetailPage } from './pages/SuggestionDetailPage'

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Nav />

        <main>
          <Routes>
            <Route path="/" element={<MemoriesPage />} />
            <Route path="/memories" element={<MemoriesPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/ideas" element={<SuggestionsPage />} />
            <Route path="/ideas/all" element={<AllIdeasPage />} />
            <Route path="/ideas/:id" element={<SuggestionDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

---

### Nav.tsx (Updated)

```tsx
export function Nav() {
  return (
    <nav>
      <Link to="/memories">Memories</Link>
      <Link to="/projects">Projects</Link>
      <Link to="/ideas">
        Ideas
        <Badge count={newSuggestionsCount} />
      </Link>
    </nav>
  )
}
```

---

## Styling Approach

Use existing MemoryOS styles:
- CSS modules or styled-components
- Minimal, clean design
- Mobile-first responsive
- System font stack
- Simple color palette

**Design tokens (from MemoryOS):**
```css
:root {
  --color-primary: #0066cc;
  --color-text: #1a1a1a;
  --color-text-muted: #666;
  --color-bg: #ffffff;
  --color-border: #e0e0e0;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}
```

---

## Implementation Checklist

- [ ] Create component files
- [ ] Implement Zustand stores
- [ ] Add API client functions
- [ ] Set up routing
- [ ] Add new types to `types.ts`
- [ ] Style components
- [ ] Add loading/error states
- [ ] Mobile optimization
- [ ] Accessibility (a11y)

---

**See also:** `API_SPEC.md`, `ROADMAP.md`, MemoryOS `src/` for existing patterns
