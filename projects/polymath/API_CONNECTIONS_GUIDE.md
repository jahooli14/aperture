# Connections API Implementation Guide

This document outlines the API changes needed to support the new Connections (Sparks) system.

## Database Setup

**First**, run the migration:
```bash
# Apply migration 006
psql $DATABASE_URL -f migrations/006-connections-and-priority.sql
```

This creates:
- `connections` table
- `projects.priority` field
- Helper functions: `get_item_connections()`, `get_item_thread()`

---

## API Design: Consolidated Approach

**To stay within 12 API limit**, we extend the existing `/api/related` endpoint to handle both semantic search AND explicit connections.

---

## Extended `/api/related` Endpoint

### 1. GET `/api/related` - Get Connections

**Purpose**: Get explicit connections for a specific item OR get AI-suggested connections

**Query Parameters**:
- `type` (string): Item type ('project', 'thought', 'article', 'suggestion')
- `id` (UUID): Item ID
- `connections=true` (flag): Return explicit connections instead of semantic search
- `ai_suggested=true` (boolean, optional): Filter to AI-suggested connections only
- `limit` (number, optional): Max results (default: 10)

**NEW Behavior with `?connections=true`**:
```json
{
  "connections": [
    {
      "connection_id": "uuid",
      "related_type": "thought",
      "related_id": "uuid",
      "connection_type": "inspired_by",
      "direction": "inbound",
      "created_by": "ai",
      "created_at": "2025-10-28T...",
      "ai_reasoning": "Both discuss surreal moments",
      "related_item": {
        "id": "uuid",
        "title": "...",
        // ... item details
      }
    }
  ],
  "total": 5
}
```

**Existing Behavior (semantic search unchanged)**:
```json
{
  "related": [
    {
      "id": "uuid",
      "type": "thought",
      "title": "...",
      "snippet": "...",
      "relevance": 0.85
    }
  ]
}
```

**Implementation**:
```typescript
// In /api/related.ts
if (req.query.connections) {
  // Use SQL function: get_item_connections(item_type, item_id)
  // Filter by ai_suggested if requested
  // Enrich with actual item data
} else {
  // Existing semantic search logic
}
```

---

### 2. POST `/api/related` - Create Connection

**Purpose**: Create a new explicit connection (manual or AI-generated)

**Request Body**:
```json
{
  "source_type": "project",
  "source_id": "uuid",
  "target_type": "thought",
  "target_id": "uuid",
  "connection_type": "manual",  // optional, defaults to 'manual'
  "ai_reasoning": "...",         // optional, for AI-created connections
  "created_by": "user"           // optional, defaults to 'user'
}
```

**Response**:
```json
{
  "success": true,
  "connection": {
    "id": "uuid",
    "source_type": "project",
    "source_id": "uuid",
    "target_type": "thought",
    "target_id": "uuid",
    "connection_type": "manual",
    "created_by": "user",
    "created_at": "2025-10-28T..."
  }
}
```

**Error Handling**:
- 409 Conflict: Connection already exists
- 400 Bad Request: Invalid types or IDs

**Implementation**:
```typescript
// In /api/related.ts
if (req.method === 'POST') {
  // INSERT INTO connections (...)
  // ON CONFLICT DO NOTHING (prevent duplicates)
}
```

---

### 3. DELETE `/api/related` - Remove Connection

**Purpose**: Remove an explicit connection

**Query Parameters**:
- `connection_id` (UUID): Connection to delete

**Response**:
```json
{
  "success": true
}
```

**Implementation**:
```typescript
// In /api/related.ts
if (req.method === 'DELETE' && req.query.connection_id) {
  // DELETE FROM connections WHERE id = connection_id
}
```

---

### 4. GET `/api/related` - Get Thread

**Purpose**: Get all items in a thread (connected graph) starting from a given item

**Query Parameters**:
- `type` (string): Root item type
- `id` (UUID): Root item ID
- `thread=true` (flag): Return thread instead of related items
- `max_depth` (number, optional): Max recursion depth (default: 10)

**Response**:
```json
{
  "items": [
    {
      "item_type": "article",
      "item_id": "uuid",
      "depth": 0,
      "item": {
        "id": "uuid",
        "title": "Introducing Claude 3.5",
        // ... item details
      }
    },
    {
      "item_type": "thought",
      "item_id": "uuid",
      "depth": 1,
      "item": { /* ... */ }
    },
    {
      "item_type": "project",
      "item_id": "uuid",
      "depth": 2,
      "item": { /* ... */ }
    }
  ],
  "root_item": {
    "item_type": "project",
    "item_id": "uuid",
    "depth": 0
  }
}
```

**Implementation**:
```typescript
// In /api/related.ts
if (req.query.thread) {
  // Use SQL function: get_item_thread(item_type, item_id, max_depth)
  // Fetch actual item data for each result
}
```

---

## Existing API Endpoints to Extend

### 5. PATCH `/api/projects/:id` (Extend Existing)

**Add support for**:
```json
{
  "priority": true  // NEW field
}
```

Update logic to handle the new `priority` boolean field.

---

### 6. POST `/api/memories` (Extend Existing)

**When creating a memory from reading flow**, automatically create a connection:

```typescript
// After creating memory from article
if (sourceArticleId) {
  await createConnection({
    source_type: 'article',
    source_id: sourceArticleId,
    target_type: 'thought',
    target_id: newMemory.id,
    connection_type: 'reading_flow',
    created_by: 'system'
  })
}
```

**Note**: This maintains backward compatibility with existing `source_reference` field while also creating explicit connection.

---

## API Endpoint Budget

**Current endpoints**: 10
1. `/api/projects`
2. `/api/analytics`
3. `/api/memories`
4. `/api/process`
5. `/api/transcribe`
6. `/api/init-tags`
7. `/api/reading`
8. `/api/onboarding`
9. `/api/related` ← **EXTENDED**
10. `/api/suggestions`

**New endpoints added**: 0 ✅

**Existing modified**: 3
- `/api/related` - Extended with connections, thread, POST/DELETE
- `/api/projects` - Accept `priority` field
- `/api/memories` - Auto-create connections from reading flow

**Total API routes**: **10** (within budget, 2 under limit)

---

## Testing Checklist

- [ ] Run migration 006
- [ ] Test GET `/api/related?type=project&id=...&connections=true`
- [ ] Test POST `/api/related` (manual connection creation)
- [ ] Test DELETE `/api/related?connection_id=...`
- [ ] Test GET `/api/related?type=project&id=...&thread=true`
- [ ] Test GET `/api/related?connections=true&ai_suggested=true&limit=3` (for HomePage)
- [ ] Test PATCH `/api/projects/:id` with `priority: true`
- [ ] Test auto-connection creation from reading flow
- [ ] Verify existing semantic search still works: GET `/api/related?type=project&id=...`

---

## Frontend Integration Points

### HomePage
- Fetches AI Sparks: `GET /api/related?connections=true&ai_suggested=true&limit=3`
- Displays priority projects: Filter `projects.priority === true`

### ScrollTimelinePage
- View Thread: `GET /api/related?type=X&id=Y&thread=true`

### ProjectDetailPage
- List connections: `GET /api/related?type=project&id=X&connections=true`
- Create connection: `POST /api/related`
- Delete connection: `DELETE /api/related?connection_id=X`

### MemoryCard (future)
- Same as ProjectDetailPage

### ReaderPage (future)
- Auto-create connection when thought is created from article

---

## Notes on API Budget

To stay within 12 API routes max (we're at 10), we:
- **Extended `/api/related`** instead of creating new `/api/connections` endpoint
- Use query parameters to multiplex functionality:
  - `?connections=true` → explicit connections
  - `?thread=true` → thread view
  - `?ai_suggested=true` → filter AI sparks
  - No flags → semantic search (existing behavior)
- Extended existing endpoints (projects, memories) rather than creating new ones
- One endpoint handles GET/POST/DELETE via HTTP methods

This design is efficient, backward-compatible, and stays well within the constraint.
