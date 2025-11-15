# Progressive Reading Queue Implementation Plan

## Overview
Auto-prioritize reading list by relevance, time estimates, and deadline awareness to help users focus on the most important articles first.

## Core Features

### 1. Smart Prioritization Algorithm
**Priority Score Calculation:**
```typescript
priority_score = (relevance * 0.4) + (urgency * 0.3) + (feasibility * 0.3)

where:
- relevance: Match to user's current projects/interests (0-1)
- urgency: Time sensitivity based on publish date and user deadlines (0-1)
- feasibility: Reading time vs available time (0-1)
```

### 2. Reading Time Estimation
- Extract word count from article content
- Calculate reading time: `words / 200 wpm` (average reading speed)
- Categorize articles:
  - Quick read: < 5 min
  - Medium read: 5-15 min
  - Long read: > 15 min

### 3. Deadline Awareness
- Allow users to set soft deadlines for articles ("read by...")
- Boost priority as deadline approaches
- Urgency formula: `urgency = 1 - (days_until_deadline / 30)`

### 4. Relevance Scoring
**Based on:**
- Keyword match with active projects
- Topic overlap with recent memories
- Connection to user's capabilities
- Historical reading patterns

### 5. Context-Aware Suggestions
**"Read Now" recommendations based on:**
- Current available time (from calendar integration)
- Energy level (morning = complex, evening = lighter)
- Recent activity (complement current project work)

## Database Schema Changes

```sql
-- Add to reading_queue table
ALTER TABLE reading_queue ADD COLUMN reading_time_minutes INTEGER;
ALTER TABLE reading_queue ADD COLUMN priority_score REAL DEFAULT 0;
ALTER TABLE reading_queue ADD COLUMN urgency_score REAL DEFAULT 0;
ALTER TABLE reading_queue ADD COLUMN relevance_score REAL DEFAULT 0;
ALTER TABLE reading_queue ADD COLUMN feasibility_score REAL DEFAULT 0;
ALTER TABLE reading_queue ADD COLUMN deadline TIMESTAMP;
ALTER TABLE reading_queue ADD COLUMN estimated_completion DATE;

-- Index for efficient priority queries
CREATE INDEX idx_reading_priority ON reading_queue(priority_score DESC, created_at DESC);
```

## API Endpoints

### GET /api/reading?mode=progressive
Returns prioritized reading queue with scores:
```json
{
  "queue": [
    {
      "id": "...",
      "title": "...",
      "url": "...",
      "reading_time_minutes": 8,
      "priority_score": 0.85,
      "relevance_score": 0.9,
      "urgency_score": 0.7,
      "feasibility_score": 0.95,
      "deadline": "2025-01-15",
      "recommended_time": "morning",
      "related_projects": ["proj-1", "proj-2"]
    }
  ],
  "recommendations": {
    "read_now": [...],  // Best for current context
    "quick_wins": [...], // < 5 min reads
    "deadline_soon": [...] // Due within 3 days
  }
}
```

### POST /api/reading/:id/deadline
Set or update article deadline:
```json
{
  "deadline": "2025-01-15T00:00:00Z",
  "reason": "for project review meeting"
}
```

### POST /api/reading/:id/complete
Mark as read and update learning:
```json
{
  "completed_at": "2025-01-10T14:30:00Z",
  "actual_reading_time_minutes": 7,
  "usefulness_rating": 4,
  "notes": "great insights on..."
}
```

## UI Components

### 1. Progressive Queue View
- Sort by priority (default)
- Visual priority indicators (🔥 urgent, ⭐ high relevance, ⚡ quick win)
- Time estimates on cards
- Deadline badges
- Filter by: relevance, urgency, time required

### 2. Smart Suggestions Panel
```
📚 Recommended Right Now
• Article 1 (8 min) - Matches your React project
• Article 2 (5 min) - Due tomorrow

⚡ Quick Wins (< 5 min)
• Short article 1
• Short article 2

🎯 High Priority
• Article with deadline
• Highly relevant article
```

### 3. Reading Time Picker
When saving article:
- Auto-detect reading time from content
- Allow manual override
- Set optional deadline
- Tag with projects/topics

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add database columns
- [ ] Implement reading time estimation
- [ ] Create priority scoring algorithm
- [ ] Basic API endpoints

### Phase 2: Smart Scoring (Week 2)
- [ ] Relevance calculation (project/memory matching)
- [ ] Deadline urgency algorithm
- [ ] Feasibility scoring
- [ ] Learning from completion data

### Phase 3: UI Enhancement (Week 3)
- [ ] Progressive queue view
- [ ] Priority indicators
- [ ] Smart suggestions panel
- [ ] Deadline management UI

### Phase 4: Context Awareness (Week 4)
- [ ] Time-of-day recommendations
- [ ] Available time detection
- [ ] Reading pattern learning
- [ ] Adaptive prioritization

## Success Metrics

- **Completion Rate**: % of articles actually read (target: +30%)
- **Time to Read**: Reduce time from save to read (target: -40%)
- **Relevance**: User ratings of article usefulness (target: 4+/5)
- **Deadline Adherence**: % read before deadline (target: 85%)

## Technical Considerations

### Performance
- Pre-calculate scores during save/update
- Cache priority rankings (refresh hourly)
- Efficient indexing for large queues

### Machine Learning (Future)
- Learn user preferences over time
- Predict best reading times
- Personalize priority weights
- Suggest related articles

### Privacy
- All processing happens server-side
- No external API calls for scoring
- User data never leaves infrastructure

## Example Priority Calculation

```typescript
// Article saved for React project, due in 2 days, 6 min read
const article = {
  words: 1200,
  deadline: Date.now() + (2 * 24 * 60 * 60 * 1000),
  projects: ['react-project']
}

// Calculate scores
const reading_time = article.words / 200 // 6 min
const relevance = matchProjects(article.projects, activeProjects) // 0.9
const urgency = 1 - (2 / 30) // 0.93 (due soon!)
const feasibility = reading_time < 10 ? 1 : 0.7 // 1.0 (quick read)

// Final priority
const priority = (relevance * 0.4) + (urgency * 0.3) + (feasibility * 0.3)
// = (0.9 * 0.4) + (0.93 * 0.3) + (1.0 * 0.3) = 0.939

// Result: High priority! 🔥
```

## Future Enhancements

1. **Social Reading**: See what others in your network are reading
2. **Reading Groups**: Shared queues with deadlines
3. **Integration**: Calendar sync for reading time blocking
4. **Analytics**: Reading velocity, topic trends, completion patterns
5. **Mobile Optimization**: Offline reading mode, read-later shortcuts

---

**Status**: Planned - Not yet implemented
**Priority**: High - Significant user value
**Effort**: Medium - 4 weeks with testing
