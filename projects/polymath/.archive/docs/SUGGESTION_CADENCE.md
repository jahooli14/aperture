# Smart Suggestion Cadence System

## Problem
Users could get overwhelmed with 100s of suggestions if we're not thoughtful about pacing.

## Solution: Adaptive Suggestion Limits

### Initial Experience (First 30 days)
- **Week 1**: Generate 10 suggestions to give variety and help user understand preferences
- **Week 2-4**: Generate 5 suggestions per synthesis
- After rating/building 10+ suggestions: Move to adaptive mode

### Adaptive Mode (Post-onboarding)
AI adjusts suggestion count based on:
1. **Active project load**: More active projects = fewer new suggestions
2. **Engagement rate**: High rating/building rate = can handle more
3. **Dismissal rate**: High dismissal = reduce suggestions
4. **Time since last build**: Long gap = maybe suggest fewer but higher quality

### Formula
```
max_suggestions = base_count - (active_projects * 0.5) + (engagement_bonus)

base_count = 5 (default)
active_projects = count of projects with status 'active'
engagement_bonus = min(3, round(built_count / 10))
```

### Caps
- Minimum: 3 suggestions per synthesis (always give options)
- Maximum: 10 suggestions per synthesis (prevent overwhelm)

### User Control
Settings panel to override:
- "Suggestion pace": Conservative (3-5) | Balanced (5-7) | Exploratory (7-10)
- "Only suggest when I have < X active projects"

### Database Schema
```sql
-- Add to user_settings table
ALTER TABLE user_settings ADD COLUMN suggestion_pace TEXT DEFAULT 'balanced';
ALTER TABLE user_settings ADD COLUMN max_active_projects INTEGER DEFAULT 3;
ALTER TABLE user_settings ADD COLUMN suggestions_per_synthesis INTEGER;
```

### Implementation Notes
- Cron job checks settings before generating
- If `suggestions_per_synthesis` is null, use adaptive formula
- If set, use that exact number (user override)
- Dashboard shows: "You'll receive ~5 suggestions next Monday based on your activity"

## Benefits
1. **Smart defaults**: New users get enough to explore, veterans don't get overwhelmed
2. **Self-adjusting**: System learns from user behavior
3. **User control**: Power users can override if they want more
4. **Transparent**: User knows what to expect
