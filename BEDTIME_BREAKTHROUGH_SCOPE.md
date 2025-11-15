# Bedtime Breakthrough Prompt - Feature Scope

## Overview
A feature that analyzes the user's active projects, recent insights, and blockers to generate a thought-provoking prompt delivered at bedtime, leveraging the creative potential of the hypnagogic state and dream processing.

## Research Foundation
- **Hypnagogic state**: The transition to sleep is associated with increased creative thinking and problem-solving
- **Sleep-dependent memory consolidation**: The brain actively processes and connects information during sleep
- **Incubation effect**: Stepping away from a problem and allowing subconscious processing leads to breakthroughs
- **Edison/Dalí technique**: Famous creatives deliberately used the edge of sleep for insights

## User Experience

### Happy Path
1. User sets their typical bedtime in settings (e.g., 10:30 PM)
2. At bedtime, user receives a notification with a custom prompt
3. User reads the prompt (30 seconds - 2 minutes)
4. User goes to sleep, mulling the question
5. Morning: User can capture any insights that emerged via voice note
6. System links morning insights back to the prompt

### Example Prompts
Based on user's project: "Building a meditation app"
- "What would a meditation app look like if it could only use sound, no visuals?"
- "If your meditation app had a personality, what would it be like? How would that shape the experience?"
- "What's the opposite of what all meditation apps do? What would happen if you tried that?"

Based on blocker: "Stuck on database schema design"
- "If your database could only have 3 tables, what would they be?"
- "What would this schema look like from the perspective of the data itself?"

## Technical Architecture

### 1. Database Schema Changes

```sql
-- User bedtime preferences
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  bedtime_enabled BOOLEAN DEFAULT false,
  bedtime_hour INTEGER DEFAULT 22, -- 24-hour format
  bedtime_minute INTEGER DEFAULT 30,
  timezone TEXT DEFAULT 'UTC',
  delivery_method TEXT DEFAULT 'push', -- 'push' | 'email' | 'both'
  prompt_style TEXT DEFAULT 'question', -- 'question' | 'challenge' | 'meditation' | 'mixed'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bedtime prompts history
CREATE TABLE bedtime_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  prompt_text TEXT NOT NULL,
  prompt_type TEXT, -- 'blocker' | 'exploration' | 'connection' | 'wildcard'

  -- Context used for generation
  source_project_ids UUID[],
  source_memory_ids UUID[],
  analysis_data JSONB, -- AI's reasoning for the prompt

  -- Delivery tracking
  scheduled_for TIMESTAMP,
  delivered_at TIMESTAMP,
  delivery_status TEXT, -- 'pending' | 'delivered' | 'failed'
  delivery_method TEXT,

  -- User feedback
  opened_at TIMESTAMP,
  rating INTEGER, -- 1-5 stars
  resulted_in_breakthrough BOOLEAN,
  follow_up_memory_ids UUID[], -- Memories captured after this prompt
  user_notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_bedtime_prompts_user_scheduled
  ON bedtime_prompts(user_id, scheduled_for);
CREATE INDEX idx_bedtime_prompts_delivery_status
  ON bedtime_prompts(delivery_status, scheduled_for);
```

### 2. Cron Job Modifications

**Current:** Single daily job at 00:00 UTC
**Needed:** More frequent checks to accommodate different timezones

**Option A: Hourly Cron (Recommended)**
```json
{
  "crons": [
    {
      "path": "/api/cron/jobs?job=hourly",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

**Hourly tasks:**
- Check for users whose bedtime matches current hour
- Generate and deliver bedtime prompts
- Process follow-up insights from previous night's prompts

**Option B: Per-Timezone Scheduling (Complex)**
- Maintain separate cron jobs for major timezone groups
- More resource-intensive, but more precise timing

### 3. AI Prompt Generation System

**New API Endpoint:** `/api/bedtime/generate-prompt`

**Algorithm:**
```typescript
async function generateBedtimePrompt(userId: string): Promise<BedtimePrompt> {
  // 1. Gather context
  const activeProjects = await getActiveProjects(userId)
  const priorityProject = activeProjects.find(p => p.is_priority)
  const blockedProjects = activeProjects.filter(p => p.blockers?.length > 0)
  const recentMemories = await getRecentMemories(userId, { days: 7 })
  const recentThemes = extractTopThemes(recentMemories, 5)

  // 2. Determine prompt focus
  const focus = selectPromptFocus({
    hasPriority: !!priorityProject,
    hasBlockers: blockedProjects.length > 0,
    recentActivity: recentMemories.length,
    lastPromptType: await getLastPromptType(userId)
  })

  // 3. Build context for AI
  const contextPrompt = buildContextPrompt({
    focus,
    project: priorityProject || blockedProjects[0] || activeProjects[0],
    themes: recentThemes,
    userStyle: await getUserPromptStyle(userId)
  })

  // 4. Generate via Gemini
  const prompt = await generateText(contextPrompt, {
    maxTokens: 200,
    temperature: 0.9, // Higher creativity
    responseFormat: 'json'
  })

  // 5. Store and schedule
  return await storeBedtimePrompt({
    userId,
    promptText: prompt.question,
    promptType: focus,
    sourceProjectIds: [project.id],
    analysisData: prompt.reasoning,
    scheduledFor: calculateBedtime(userId)
  })
}
```

**Prompt Focus Selection:**
```typescript
type PromptFocus =
  | 'blocker'      // Help unstick a blocked project
  | 'exploration'  // Deepen thinking on priority project
  | 'connection'   // Find links between disparate ideas
  | 'wildcard'     // Random creative challenge

// Distribution:
// 40% blocker (if blockers exist)
// 30% exploration (priority or active project)
// 20% connection (recent memories + projects)
// 10% wildcard (random creativity boost)
```

**Example System Prompt:**
```
You are a creative coach helping someone prepare for sleep-assisted problem solving.

Context:
- Project: "${project.title}"
- Description: "${project.description}"
- Recent work: "${recentMemories.map(m => m.title).join(', ')}"
- Blocker: "${project.blockers?.[0] || 'none'}"

Generate a single thought-provoking question or prompt that:
1. Takes 30-90 seconds to read and contemplate
2. Encourages lateral thinking, not direct problem-solving
3. Uses metaphor, reframing, or perspective shifts
4. Feels open-ended and inviting, not pressuring
5. Connects to their actual work but pushes into new territory

Style: ${userStyle} (question | challenge | meditation | koan)

Return JSON:
{
  "question": "...",
  "reasoning": "Why this prompt connects to their work and might unlock insights"
}
```

### 4. Notification/Delivery System

**Current State:** No push notification system exists
**Required:** Capacitor Push Notifications or email fallback

#### Option A: Push Notifications (Native Experience)

**Dependencies:**
```json
{
  "@capacitor/push-notifications": "^6.0.0"
}
```

**Implementation:**
```typescript
// /src/lib/pushNotifications.ts
import { PushNotifications } from '@capacitor/push-notifications'

export async function requestPushPermissions() {
  const result = await PushNotifications.requestPermissions()
  if (result.receive === 'granted') {
    await PushNotifications.register()
  }
  return result
}

export async function registerPushToken(userId: string) {
  PushNotifications.addListener('registration', async (token) => {
    // Store token in database
    await fetch('/api/users/register-push-token', {
      method: 'POST',
      body: JSON.stringify({ userId, token: token.value })
    })
  })
}
```

**Database:**
```sql
CREATE TABLE user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  token TEXT NOT NULL,
  platform TEXT, -- 'ios' | 'android' | 'web'
  registered_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  UNIQUE(user_id, token)
);
```

**Delivery Service:**
- iOS: Apple Push Notification Service (APNs)
- Android: Firebase Cloud Messaging (FCM)
- Estimated cost: Free tier covers ~1000 users

#### Option B: Email Fallback (Lower Engagement)

**Pros:**
- No additional permissions needed
- Works on all platforms
- Can include richer formatting

**Cons:**
- Lower open rates
- Not integrated into app flow
- Requires email service (Resend, SendGrid)

**Recommended:** Implement both, let user choose preference

### 5. User Settings UI

**New Settings Section:** "Bedtime Breakthroughs"

```typescript
interface BedtimeSettings {
  enabled: boolean
  time: { hour: number; minute: number }
  timezone: string // Auto-detected, user can override
  deliveryMethod: 'push' | 'email' | 'both'
  promptStyle: 'question' | 'challenge' | 'meditation' | 'mixed'
  frequency: 'daily' | 'weeknights' | 'custom' // v2 feature
}
```

**Settings UI Location:** `/src/pages/Settings.tsx`

**Components:**
- Toggle switch: Enable/disable feature
- Time picker: Set bedtime
- Radio buttons: Delivery method
- Segmented control: Prompt style
- Test button: "Send me a prompt now"

### 6. Morning Follow-Up Flow

**Insight Capture:**
- Morning notification: "Did you have any insights from last night's prompt?"
- Quick link to voice capture
- Auto-link captured memory to the bedtime prompt
- Track "breakthrough" flag if user marks it as valuable

**API Endpoint:** `PATCH /api/bedtime/prompts/:id`
```typescript
{
  followUpMemoryIds: [newMemoryId],
  resultedInBreakthrough: true,
  rating: 5,
  userNotes: "Realized I was overcomplicating the schema..."
}
```

### 7. Analytics & Optimization

**Track:**
- Delivery success rate
- Open rate (if push notification clicked)
- Breakthrough rate (user-reported)
- Rating distribution
- Prompt types that work best
- Time-to-insight (prompt → follow-up memory)

**Optimization Loop:**
1. Weekly analysis of prompt performance
2. Adjust AI system prompt based on high-rated examples
3. Personalize prompt style per user over time
4. A/B test different prompt strategies

## Implementation Phases

### Phase 1: MVP (1-2 weeks)
**Goal:** Basic feature working for email delivery

- [ ] Database schema (user_preferences, bedtime_prompts)
- [ ] User settings UI (time picker, enable/disable)
- [ ] AI prompt generation endpoint
- [ ] Email delivery system (Resend or SendGrid)
- [ ] Hourly cron job for delivery
- [ ] Basic prompt generation algorithm

**Outcome:** Users can opt-in and receive nightly email prompts

### Phase 2: Native Push (1 week)
**Goal:** Better engagement via native notifications

- [ ] Capacitor push notifications setup
- [ ] iOS APNs configuration
- [ ] Android FCM configuration
- [ ] Push token registration flow
- [ ] Permission request UI
- [ ] Update delivery system for push

**Outcome:** Native push notifications on iOS/Android

### Phase 3: Follow-Up & Feedback (1 week)
**Goal:** Close the loop and track effectiveness

- [ ] Morning follow-up notification
- [ ] Link voice notes to prompts
- [ ] Rating/feedback UI
- [ ] Breakthrough tracking
- [ ] Analytics dashboard (internal)

**Outcome:** Can measure feature impact and iterate

### Phase 4: Optimization (Ongoing)
**Goal:** Improve prompt quality and personalization

- [ ] Analyze high-performing prompts
- [ ] Personalize based on user feedback
- [ ] Add prompt style variations
- [ ] A/B testing infrastructure
- [ ] Advanced scheduling (skip weekends, etc.)

## Technical Considerations

### Timezone Handling
- Use user's device timezone initially
- Allow manual override in settings
- Store timestamps in UTC, convert for delivery
- Handle daylight saving time transitions

### Notification Permissions
- Don't gate feature behind permissions initially
- Gracefully degrade to email if push denied
- Explain value before requesting permissions
- Allow changing delivery method anytime

### AI Cost Management
- Single prompt generation per user per day
- Estimated: ~500 tokens/prompt = negligible cost on Gemini
- Total: <$1/month for 1000 daily users

### Cron Frequency Limitations
**Vercel Hobby Plan:** 1 cron job
**Vercel Pro Plan:** Multiple cron jobs allowed

**Solution for Hobby Plan:**
- Use single hourly cron
- Check all users, filter by timezone
- Batch prompt generation and delivery

### Testing Strategy
- Unit tests for prompt generation logic
- Mock AI responses for deterministic testing
- Timezone testing across major zones
- Manual testing: "Send me a prompt now" button
- User feedback loop for real-world validation

## Dependencies

### New npm Packages
```json
{
  "@capacitor/push-notifications": "^6.0.0",
  "resend": "^3.0.0" // or alternative email service
}
```

### External Services
1. **Push Notifications:**
   - Apple Developer Account (for APNs)
   - Firebase account (for FCM)
   - Cost: Free tier sufficient initially

2. **Email Delivery:**
   - Resend (recommended): 3000 emails/month free
   - Alternative: SendGrid, AWS SES
   - Cost: Free tier → $20/mo at scale

### Infrastructure
- No additional database needed (Supabase existing)
- No additional AI provider needed (Gemini existing)
- Vercel Pro upgrade needed if >1 cron job desired (~$20/mo)

## Open Questions

1. **Optimal delivery timing:**
   - Exactly at bedtime, or 30 minutes before?
   - User testing needed

2. **Prompt length:**
   - Short (1-2 sentences) vs longer (paragraph)
   - May vary by prompt style

3. **Frequency:**
   - Every night, or fewer nights per week?
   - Should adapt based on user engagement?

4. **Multi-project prompts:**
   - Focus on one project, or synthesize across multiple?
   - Could be a "connection" prompt type

5. **Visual components:**
   - Text-only, or include images/diagrams?
   - Could enhance certain prompt types

6. **Breakthrough attribution:**
   - How to prove causality between prompt and insight?
   - Self-reported is subjective but practical

## Success Metrics

### Adoption
- % of users who enable the feature
- % who keep it enabled after 1 week
- % who keep it enabled after 1 month

### Engagement
- Average open rate (push notifications)
- Average rating of prompts
- % of prompts that result in follow-up memories

### Impact
- Self-reported breakthrough rate
- Connection strength (prompt → memory → project progress)
- User testimonials/qualitative feedback

### Goals (3 months post-launch)
- 20% of active users enable feature
- 60% retention after 1 month
- 10% breakthrough rate (high bar)
- 3.5+ average rating

## Risks & Mitigations

### Risk: Low engagement
**Mitigation:**
- A/B test delivery timing
- Iterate on prompt quality
- Add personalization over time
- Make it easy to skip nights

### Risk: Notification fatigue
**Mitigation:**
- Start with low frequency (opt-in)
- Allow easy disable
- Make prompts genuinely valuable
- Track and respond to feedback

### Risk: Technical delivery failures
**Mitigation:**
- Implement retry logic
- Monitor delivery rates
- Provide email fallback
- Alert on delivery issues

### Risk: Poor prompt quality
**Mitigation:**
- Iterate on system prompt
- Learn from high-rated examples
- Add human review for edge cases
- Allow users to regenerate prompt

## Future Enhancements (v2+)

- **Morning insight journaling:** Structured template for capturing dreams/insights
- **Weekly synthesis:** Connect multiple bedtime prompts into larger patterns
- **Collaborative prompts:** Share anonymized breakthroughs with community
- **Voice-based prompts:** Audio delivery of prompt (voice actor or AI voice)
- **Biometric integration:** Detect actual sleep onset (Apple Watch, Oura)
- **Dream journaling:** Full dream capture and analysis
- **Prompt marketplace:** User-contributed prompt templates
- **Integration with projects:** Auto-update project based on breakthrough insights

## Estimated Effort

### Total: 3-4 weeks (for Phases 1-3)

**Breakdown:**
- Database & API: 3 days
- UI (settings + notifications): 3 days
- AI prompt generation: 4 days
- Email delivery: 2 days
- Push notifications: 5 days
- Follow-up flow: 3 days
- Testing & polish: 3 days

**Team:** 1 full-stack engineer

## Conclusion

This feature uniquely leverages the brain's natural creative potential during sleep, providing users with a gentle, thought-provoking prompt that primes their subconscious for breakthrough insights. By carefully timing delivery, crafting personalized prompts, and closing the feedback loop, we can create a genuinely valuable tool for creative problem-solving.

The technical implementation builds naturally on Polymath's existing infrastructure (AI, cron jobs, user preferences) and requires only modest new dependencies (push notifications, email service). The phased rollout allows for early validation and iteration based on real user behavior.

If executed well, this could become a signature feature that differentiates Polymath from other productivity tools—one that works *with* users' natural rhythms rather than demanding more conscious effort.
