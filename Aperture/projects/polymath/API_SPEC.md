

 # Polymath API Specification

> Complete API documentation for MemoryOS + Polymath endpoints

## Overview

All endpoints extend the existing MemoryOS API. They follow the same patterns:
- Vercel serverless functions in `/api/`
- Supabase for data storage
- TypeScript with type safety
- Row Level Security for auth

## Base URL

```
Production: https://memoryos.vercel.app
Development: http://localhost:5173
```

---

## Projects API

### GET `/api/projects`

List all user projects.

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `dormant`, `completed`, `archived`)
- `type` (optional): Filter by type (`personal`, `technical`, `meta`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```typescript
{
  projects: Array<{
    id: string
    title: string
    description: string | null
    type: 'personal' | 'technical' | 'meta'
    status: 'active' | 'dormant' | 'completed' | 'archived'
    last_active: string // ISO 8601
    created_at: string
    updated_at: string
    metadata: Record<string, any>
  }>
  total: number
}
```

**Example:**
```bash
GET /api/projects?status=active&type=personal
```

---

### POST `/api/projects`

Create a new project.

**Request Body:**
```typescript
{
  title: string // Required
  description?: string
  type: 'personal' | 'technical' | 'meta' // Required
  status?: 'active' | 'dormant' | 'completed' | 'archived' // Default: 'active'
  metadata?: Record<string, any>
}
```

**Response:**
```typescript
{
  project: {
    id: string
    title: string
    description: string | null
    type: string
    status: string
    last_active: string
    created_at: string
    updated_at: string
    metadata: Record<string, any>
  }
}
```

**Example:**
```bash
POST /api/projects
Content-Type: application/json

{
  "title": "Watercolor portrait series",
  "description": "Practice watercolor techniques with focus on faces",
  "type": "personal",
  "metadata": {
    "materials": ["watercolors", "canvas", "brushes"],
    "energy_level": "medium"
  }
}
```

---

### PATCH `/api/projects/:id`

Update an existing project.

**URL Parameters:**
- `id`: Project UUID

**Request Body:**
```typescript
{
  title?: string
  description?: string
  status?: 'active' | 'dormant' | 'completed' | 'archived'
  metadata?: Record<string, any>
}
```

**Response:**
```typescript
{
  project: {
    id: string
    // ... full project object
  }
}
```

---

### DELETE `/api/projects/:id`

Delete a project.

**URL Parameters:**
- `id`: Project UUID

**Response:**
```typescript
{
  success: boolean
  message: string
}
```

---

## Suggestions API

### GET `/api/suggestions`

List project suggestions.

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `rated`, `built`, `dismissed`, `saved`)
- `is_wildcard` (optional): Filter wildcards (`true`, `false`)
- `min_points` (optional): Minimum points threshold
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```typescript
{
  suggestions: Array<{
    id: string
    title: string
    description: string
    synthesis_reasoning: string
    novelty_score: number // 0-1
    feasibility_score: number // 0-1
    interest_score: number // 0-1
    total_points: number
    capability_ids: string[]
    memory_ids: string[]
    is_wildcard: boolean
    suggested_at: string
    status: string
    built_project_id: string | null
    capabilities?: Array<{ id: string, name: string }> // If expanded
    memories?: Array<{ id: string, title: string }> // If expanded
  }>
  total: number
}
```

**Example:**
```bash
GET /api/suggestions?status=pending&limit=10
```

---

### GET `/api/suggestions/:id`

Get single suggestion with full details.

**URL Parameters:**
- `id`: Suggestion UUID

**Query Parameters:**
- `expand` (optional): Comma-separated fields to expand (`capabilities`, `memories`, `ratings`)

**Response:**
```typescript
{
  suggestion: {
    id: string
    title: string
    description: string
    synthesis_reasoning: string
    novelty_score: number
    feasibility_score: number
    interest_score: number
    total_points: number
    capability_ids: string[]
    memory_ids: string[]
    is_wildcard: boolean
    suggested_at: string
    status: string
    built_project_id: string | null

    // If expanded:
    capabilities?: Array<{
      id: string
      name: string
      description: string
      source_project: string
      strength: number
    }>
    memories?: Array<{
      id: string
      title: string
      body: string
      created_at: string
    }>
    ratings?: Array<{
      id: string
      rating: number
      feedback: string | null
      rated_at: string
    }>
  }
}
```

---

### POST `/api/suggestions/:id/rate`

Rate a suggestion.

**URL Parameters:**
- `id`: Suggestion UUID

**Request Body:**
```typescript
{
  rating: -1 | 1 | 2 // -1 = meh, 1 = spark, 2 = built
  feedback?: string // Optional user notes
}
```

**Response:**
```typescript
{
  success: boolean
  rating: {
    id: string
    suggestion_id: string
    rating: number
    feedback: string | null
    rated_at: string
  }
  updated_suggestion: {
    id: string
    status: string // Updated based on rating
  }
}
```

**Side Effects:**
- Updates suggestion status
- Strengthens capability nodes if positive rating
- Records combination penalty if negative rating

**Example:**
```bash
POST /api/suggestions/123e4567-e89b-12d3-a456-426614174000/rate
Content-Type: application/json

{
  "rating": 1,
  "feedback": "This is really interesting! Love the combination."
}
```

---

### POST `/api/suggestions/:id/build`

Mark suggestion as built and create project.

**URL Parameters:**
- `id`: Suggestion UUID

**Request Body:**
```typescript
{
  project_title?: string // Override suggestion title
  project_description?: string // Override suggestion description
  metadata?: Record<string, any> // Additional project metadata
}
```

**Response:**
```typescript
{
  success: boolean
  project: {
    id: string
    title: string
    // ... full project object
  }
  suggestion: {
    id: string
    status: 'built'
    built_project_id: string
  }
}
```

**Side Effects:**
- Creates new project
- Updates suggestion status to 'built'
- Links suggestion to project
- Gives +2 rating automatically
- Strengthens capability nodes significantly

---

## Synthesis API

### POST `/api/synthesis/run`

Trigger manual synthesis (weekly synthesis runs automatically via cron).

**Request Body:**
```typescript
{
  user_id?: string // Optional, defaults to authenticated user
  num_suggestions?: number // Optional, default: 10
}
```

**Response:**
```typescript
{
  success: boolean
  suggestions_generated: number
  suggestions: Array<{
    id: string
    title: string
    total_points: number
    is_wildcard: boolean
  }>
  interests_found: number
  capabilities_used: number
}
```

**Note:** This is a long-running operation (30-60 seconds). Consider using in background.

---

### POST `/api/synthesis/strengthen-nodes`

Update node strengths based on git activity (runs daily via cron).

**Request Body:**
```typescript
{
  since?: string // ISO 8601 timestamp, default: 24 hours ago
}
```

**Response:**
```typescript
{
  success: boolean
  nodes_strengthened: number
  updates: Array<{
    node_type: 'capability' | 'project'
    node_id: string
    old_strength: number
    new_strength: number
  }>
}
```

---

## Capabilities API

### GET `/api/capabilities`

List all capabilities.

**Query Parameters:**
- `source_project` (optional): Filter by source project
- `min_strength` (optional): Minimum strength threshold
- `limit` (optional): Number of results (default: 100)

**Response:**
```typescript
{
  capabilities: Array<{
    id: string
    name: string
    description: string
    source_project: string
    code_references: Array<{
      file: string
      function?: string
      line?: number
    }>
    strength: number
    last_used: string | null
    created_at: string
  }>
  total: number
}
```

---

### POST `/api/capabilities/scan`

Trigger capability scan (populates capabilities table from codebase).

**Request Body:**
```typescript
{
  force?: boolean // Force rescan even if capabilities exist
}
```

**Response:**
```typescript
{
  success: boolean
  capabilities_found: number
  capabilities_updated: number
  capabilities_created: number
}
```

**Note:** Long-running operation. Run once during setup, then manually when adding new projects.

---

### GET `/api/capabilities/search`

Search capabilities by semantic similarity.

**Query Parameters:**
- `q`: Search query text
- `threshold` (optional): Similarity threshold (0-1, default: 0.7)
- `limit` (optional): Number of results (default: 5)

**Response:**
```typescript
{
  capabilities: Array<{
    id: string
    name: string
    description: string
    strength: number
    similarity: number // 0-1
  }>
}
```

**Example:**
```bash
GET /api/capabilities/search?q=voice%20processing&limit=3
```

---

## Interests API

### GET `/api/interests`

List user interests extracted from MemoryOS.

**Query Parameters:**
- `min_strength` (optional): Minimum strength threshold
- `limit` (optional): Number of results (default: 20)

**Response:**
```typescript
{
  interests: Array<{
    id: string
    name: string
    type: string // 'person', 'topic', 'place', etc.
    strength: number
    mentions: number
    last_mentioned: string | null
  }>
  total: number
}
```

---

## Node Strengths API

### GET `/api/node-strengths`

Get strength rankings across all nodes.

**Query Parameters:**
- `node_type` (optional): Filter by type (`capability`, `interest`, `project`)
- `limit` (optional): Number of results (default: 20)

**Response:**
```typescript
{
  nodes: Array<{
    id: string
    node_type: 'capability' | 'interest' | 'project'
    node_id: string
    strength: number
    activity_count: number
    last_activity: string | null

    // Expanded node details:
    node_details: {
      name: string
      // ... type-specific fields
    }
  }>
}
```

---

## Cron Endpoints

These endpoints are called by Vercel Cron (not exposed to users).

### GET `/api/cron/weekly-synthesis`

Runs weekly synthesis for all users.

**Vercel Cron Config:**
```json
{
  "path": "/api/cron/weekly-synthesis",
  "schedule": "0 9 * * 1"
}
```

---

### GET `/api/cron/strengthen-nodes`

Runs daily node strengthening.

**Vercel Cron Config:**
```json
{
  "path": "/api/cron/strengthen-nodes",
  "schedule": "0 0 * * *"
}
```

---

## Error Responses

All endpoints return consistent error format:

```typescript
{
  error: string // Human-readable error message
  code?: string // Machine-readable error code
  details?: any // Additional error details (dev only)
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `405` - Method Not Allowed
- `500` - Internal Server Error

---

## Authentication

Uses existing MemoryOS Supabase auth:

```typescript
// All requests must include Supabase auth token
headers: {
  'Authorization': 'Bearer <supabase_access_token>'
}
```

Row Level Security ensures users only access their own data.

---

## Rate Limiting

Same as MemoryOS:
- 100 requests per minute per user
- 10 synthesis runs per day per user (expensive operation)

---

## Webhooks (Future)

Not implemented in MVP, but planned:

### POST `/api/webhooks/github`

Listen for git commits to trigger node strengthening.

### POST `/api/webhooks/audiopen`

Existing MemoryOS webhook, extended to:
- Extract interests in real-time
- Trigger project surfacing based on note content

---

## TypeScript Types

See `src/types.ts` for full type definitions:

```typescript
// Core types
export interface Project { ... }
export interface Capability { ... }
export interface ProjectSuggestion { ... }
export interface SuggestionRating { ... }
export interface Interest { ... }
export interface NodeStrength { ... }
```

---

## Implementation Checklist

- [ ] `GET /api/projects` - List projects
- [ ] `POST /api/projects` - Create project
- [ ] `PATCH /api/projects/:id` - Update project
- [ ] `DELETE /api/projects/:id` - Delete project
- [ ] `GET /api/suggestions` - List suggestions
- [ ] `GET /api/suggestions/:id` - Get suggestion details
- [ ] `POST /api/suggestions/:id/rate` - Rate suggestion
- [ ] `POST /api/suggestions/:id/build` - Build suggestion
- [ ] `POST /api/synthesis/run` - Manual synthesis
- [ ] `POST /api/synthesis/strengthen-nodes` - Strengthen nodes
- [ ] `GET /api/capabilities` - List capabilities
- [ ] `POST /api/capabilities/scan` - Scan codebase
- [ ] `GET /api/capabilities/search` - Semantic search
- [ ] `GET /api/interests` - List interests
- [ ] `GET /api/node-strengths` - Get strength rankings
- [ ] `GET /api/cron/weekly-synthesis` - Cron: weekly synthesis
- [ ] `GET /api/cron/strengthen-nodes` - Cron: daily strengthening

---

**See also:** `ARCHITECTURE.md`, `ROADMAP.md`
