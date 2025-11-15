# 🧪 API Testing Guide

> **Quick curl commands to test your API endpoints**

---

## Setup

```bash
# Set your base URL
export API_BASE="http://localhost:5173"  # Local
# or
export API_BASE="https://your-domain.vercel.app"  # Production
```

---

## Suggestions API

### List All Suggestions
```bash
curl "$API_BASE/api/suggestions"
```

### Filter by Status
```bash
# Pending only
curl "$API_BASE/api/suggestions?status=pending"

# Sparks
curl "$API_BASE/api/suggestions?status=spark"

# Built
curl "$API_BASE/api/suggestions?status=built"
```

### With Pagination
```bash
curl "$API_BASE/api/suggestions?limit=5&offset=0"
```

---

## Rate Suggestion

### Spark (👍)
```bash
curl -X POST "$API_BASE/api/suggestions/SUGGESTION_ID/rate" \
  -H "Content-Type: application/json" \
  -d '{"rating": 1}'
```

### Meh (👎)
```bash
curl -X POST "$API_BASE/api/suggestions/SUGGESTION_ID/rate" \
  -H "Content-Type: application/json" \
  -d '{"rating": -1}'
```

---

## Build Project from Suggestion

```bash
curl -X POST "$API_BASE/api/suggestions/SUGGESTION_ID/build" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "project": {
    "id": "uuid",
    "title": "Project Title",
    "status": "active",
    ...
  },
  "strengthened_capabilities": 2
}
```

---

## Projects API

### List All Projects
```bash
curl "$API_BASE/api/projects"
```

### Filter by Status
```bash
# Active projects
curl "$API_BASE/api/projects?status=active"

# Dormant projects
curl "$API_BASE/api/projects?status=dormant"

# Completed projects
curl "$API_BASE/api/projects?status=completed"
```

### Get Single Project
```bash
curl "$API_BASE/api/projects/PROJECT_ID"
```

---

## Create Project

```bash
curl -X POST "$API_BASE/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Project",
    "description": "Building something cool",
    "type": "personal",
    "status": "active"
  }'
```

**Project Types**:
- `personal` - Personal creative project
- `technical` - Technical/coding project
- `meta` - Meta/infrastructure project

**Statuses**:
- `active` - Currently working on
- `dormant` - On hold
- `completed` - Finished
- `archived` - No longer relevant

---

## Update Project

```bash
curl -X PATCH "$API_BASE/api/projects/PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

---

## Delete Project

```bash
curl -X DELETE "$API_BASE/api/projects/PROJECT_ID"
```

---

## Cron Jobs (Vercel Only)

### Trigger Weekly Synthesis
```bash
curl -X POST "$API_BASE/api/cron/weekly-synthesis" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Trigger Node Strengthening
```bash
curl -X POST "$API_BASE/api/cron/strengthen-nodes" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Note**: Cron secret only needed in production. Local dev doesn't require it.

---

## Voice Capture (Audiopen Webhook)

### Test Capture Endpoint
```bash
curl -X POST "$API_BASE/api/capture" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I want to build a photo timeline app for my baby with face detection",
    "transcript": "I want to build a photo timeline app for my baby with face detection",
    "summary": "Idea for baby photo app",
    "created_at": "2024-10-21T12:00:00Z"
  }'
```

**Response**:
```json
{
  "success": true,
  "memory_id": "uuid",
  "processing": "queued"
}
```

---

## Common Workflows

### 1. Seed → View → Rate → Build

```bash
# 1. Seed test data
npm run seed

# 2. List suggestions
curl "$API_BASE/api/suggestions" | jq

# 3. Get a suggestion ID from response
SUGGESTION_ID="uuid-from-response"

# 4. Rate it as Spark
curl -X POST "$API_BASE/api/suggestions/$SUGGESTION_ID/rate" \
  -H "Content-Type: application/json" \
  -d '{"rating": 1}'

# 5. Build project from it
curl -X POST "$API_BASE/api/suggestions/$SUGGESTION_ID/build" \
  -H "Content-Type: application/json"

# 6. View projects
curl "$API_BASE/api/projects" | jq
```

### 2. Create Custom Project

```bash
# Create project
curl -X POST "$API_BASE/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Personal Website",
    "description": "Building a new portfolio site",
    "type": "technical",
    "status": "active"
  }' | jq

# Get project ID from response
PROJECT_ID="uuid-from-response"

# Update status later
curl -X PATCH "$API_BASE/api/projects/$PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' | jq
```

---

## Testing with jq (Prettier Output)

Install jq: `brew install jq`

```bash
# Pretty print suggestions
curl "$API_BASE/api/suggestions" | jq '.suggestions[] | {title, total_points, status}'

# Show only high-scoring suggestions (>70pts)
curl "$API_BASE/api/suggestions" | jq '.suggestions[] | select(.total_points > 70)'

# Count suggestions by status
curl "$API_BASE/api/suggestions" | jq '.suggestions | group_by(.status) | map({status: .[0].status, count: length})'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid rating value"
}
```

### 404 Not Found
```json
{
  "error": "Suggestion not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Database connection failed"
}
```

---

## NPM Scripts for Testing

```bash
# Seed test data
npm run seed

# Scan capabilities
npm run scan

# Run synthesis
npm run synthesize

# Strengthen nodes
npm run strengthen
```

---

## Full Integration Test

```bash
#!/bin/bash
# save as: test-integration.sh

API_BASE="http://localhost:5173"

echo "1. Seeding test data..."
npm run seed

echo "2. Fetching suggestions..."
SUGGESTIONS=$(curl -s "$API_BASE/api/suggestions")
echo $SUGGESTIONS | jq '.suggestions | length'

echo "3. Getting first suggestion ID..."
SUGGESTION_ID=$(echo $SUGGESTIONS | jq -r '.suggestions[0].id')

echo "4. Rating suggestion as Spark..."
curl -s -X POST "$API_BASE/api/suggestions/$SUGGESTION_ID/rate" \
  -H "Content-Type: application/json" \
  -d '{"rating": 1}' | jq

echo "5. Building project..."
curl -s -X POST "$API_BASE/api/suggestions/$SUGGESTION_ID/build" \
  -H "Content-Type: application/json" | jq

echo "6. Listing projects..."
curl -s "$API_BASE/api/projects" | jq '.projects | length'

echo "✅ Integration test complete!"
```

Run with: `bash test-integration.sh`

---

**Quick Reference**:
- `GET /api/suggestions` - List suggestions
- `POST /api/suggestions/:id/rate` - Rate (1 or -1)
- `POST /api/suggestions/:id/build` - Create project
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project

**See full API spec**: `API_SPEC.md`
