# 🌱 Baby Milestone Tracker

> **An AI-powered system that helps parents capture and understand their child's development through voice memories**
>
> **Standalone project** - Can be integrated with any voice note or memory system

---

## 🎯 What This Is

The Baby Milestone Tracker transforms any voice note or memory system into a powerful tool for documenting your child's growth. Simply speak about your child's day, and AI automatically detects and organizes developmental milestones.

**This is a standalone project that can be integrated with**:
- Polymath (creative synthesis engine)
- MemoryOS (personal knowledge graph)
- Any voice note system (Audiopen, etc.)
- Custom memory/journaling apps

### The Problem It Solves

Parents want to remember precious developmental moments, but:
- ❌ Baby books feel like homework
- ❌ Photos don't capture the context or feeling
- ❌ Memory fades fast
- ❌ Hard to see patterns in development

### The Solution

- ✅ **Voice-first**: Just talk naturally about your day
- ✅ **AI detection**: Automatically identifies milestones
- ✅ **Timeline view**: See progress at a glance
- ✅ **Insights**: Understand patterns in development
- ✅ **Evidence-based**: Every milestone linked to your actual words

---

## ✨ Key Features

### 1. **Automatic Milestone Detection**

Speak naturally about your child:
> "She rolled over today for the first time! I was changing her diaper and she just flipped right onto her tummy. I couldn't believe it!"

AI detects:
- 🎯 Milestone: **First roll over**
- 📍 Domain: Gross Motor
- 💬 Evidence: Direct quote from your voice note
- 🎂 Age: Estimated from context or stated age
- ✨ Confidence: 0.95 (high)

### 2. **Scientific Taxonomy**

Based on WHO, CDC, and AAP guidelines:
- 🏃 **Gross Motor** - Rolling, sitting, crawling, walking
- ✋ **Fine Motor** - Grasping, pincer grip, stacking
- 💬 **Language** - First words, phrases, sentences
- 🧠 **Cognitive** - Problem-solving, memory, pretend play
- ❤️ **Social-Emotional** - Smiles, laughs, sharing, empathy
- 🍽️ **Self-Care** - Feeding, dressing, potty training

### 3. **Timeline View**

Beautiful visual timeline showing:
- All milestones in chronological order
- Grouped by developmental domain
- Evidence quotes from your memories
- Age at time of milestone
- Pattern insights

### 4. **AI Insights**

Weekly AI-generated insights like:
- **Pattern Recognition**: "Your little one hit 4 motor milestones in 6 weeks!"
- **Achievement Highlights**: "First word is magical - communication breakthrough!"
- **Progression Analysis**: "Strong language development alongside motor skills"
- **Gentle Suggestions**: "Might enjoy activities that combine reaching and grasping"

---

## 🏗️ How It Works

```
Voice Note (Audiopen)
    ↓
Base Memory Processing
    • Entity extraction
    • Theme detection
    • Embedding generation
    ↓
Milestone Detection (NEW!)
    • Analyze for developmental content
    • Match against 60+ milestone patterns
    • Extract evidence quotes
    • Estimate child age
    ↓
Storage
    • child_milestones table
    • Linked to original memory
    ↓
Timeline & Insights
    • Visual timeline
    • Pattern analysis
    • AI-generated insights
```

---

## 📁 Files Created

### Core Logic (`/lib`)
- **`milestone-taxonomy.ts`** - 60+ milestones across 6 domains
- **`milestone-detector.ts`** - AI detection using Gemini
- **`process-memory-with-milestones.ts`** - Enhanced processing pipeline
- **`process-memory.ts`** - Base memory processing interface (stub for integration)
- **`logger.ts`** - Logging utility
- **`env.ts`** - Environment configuration

### Database (`/scripts`)
- **`add-milestone-tables.sql`** - Complete database schema
  - `child_milestones` - Detected milestones
  - `milestone_insights` - AI-generated insights
  - `child_profiles` - Multi-child support
  - Views and functions for analytics

### API (`/api`)
- **`milestones.ts`** - GET timeline and insights
- **`milestones/insights.ts`** - POST generate new insights

### Frontend (`/src/components`)
- **`milestones/MilestoneTimeline.tsx`** - Beautiful timeline UI component

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd projects/baby-milestone-tracker
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_ANON_KEY` - Anonymous key for client operations
- `GEMINI_API_KEY` - Google Gemini API key for milestone detection

### 3. Database Migration

Run the SQL migration in your Supabase SQL editor:

```bash
# Copy and execute the contents of:
scripts/add-milestone-tables.sql
```

This creates:
- `child_milestones` table
- `milestone_insights` table
- `child_profiles` table (optional, for multiple children)
- Views for analytics
- Helper functions

### 4. Integration with Your Memory System

This project provides a `processMemoryWithMilestones()` function that you can integrate into your existing memory processing pipeline.

**Option A: Replace the stub with your actual memory processing**

Edit `lib/process-memory.ts` to implement your actual memory processing logic:

```typescript
export async function processMemory(memoryId: string): Promise<void> {
  // Your implementation:
  // 1. Extract entities (people, places, topics)
  // 2. Detect themes
  // 3. Generate embeddings
  // 4. Update memory record
}
```

**Option B: Call milestone detection from your existing system**

In your memory processing webhook/API:

```typescript
import { processMemoryWithMilestones } from 'baby-milestone-tracker/lib/process-memory-with-milestones.js'

// After your base memory processing:
processMemoryWithMilestones(memory.id, userId).catch(err => {
  logger.error({ memory_id: memory.id, error: err }, 'Milestone processing error')
})
```

### 5. Add to Your UI

Add the milestone timeline to your app:

```tsx
import { MilestoneTimeline } from './components/milestones/MilestoneTimeline'

function MemoriesPage() {
  return (
    <div>
      {/* Existing memories UI */}

      {/* Add milestone timeline */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Development Timeline</h2>
        <MilestoneTimeline userId={currentUserId} />
      </section>
    </div>
  )
}
```

### 6. Deploy (Optional)

If deploying as a standalone app:

```bash
npm run build
npm run deploy
```

Or deploy to Vercel:
- The `/api` folder contains Vercel serverless functions
- Frontend builds to `/dist` via Vite

---

## 📝 Usage Examples

### Voice Note Examples

**Gross Motor Milestone:**
> "Today was HUGE - he took his first steps! Just two little steps from the couch to the coffee table, but he did it all by himself. I cried. He's 11 months old."

Detected:
- Milestone: First steps
- Domain: Gross Motor
- Age: 11 months
- Evidence: "took his first steps... from the couch to the coffee table"

**Language Milestone:**
> "She said 'mama' today - like really clearly. Not just babbling. She looked right at me and said 'mama'. Best moment of my week."

Detected:
- Milestone: First word
- Domain: Language
- Evidence: "said 'mama' today - like really clearly"

**Cognitive Milestone:**
> "He's obsessed with peek-a-boo now. He knows I'm still there even when I cover my face. It's like he just figured out object permanence. So cute."

Detected:
- Milestone: Object permanence
- Domain: Cognitive
- Evidence: "knows I'm still there even when I cover my face"

### Multi-Domain Detection

A single voice note can detect multiple milestones:

> "Park day! She climbed up the slide stairs by herself (so proud!), went down on her tummy, and then said 'more' when she wanted to go again. She's also started sharing her snacks with other kids - such a sweetie."

Detects:
1. **Climbing** (Gross Motor) - "climbed up the slide stairs by herself"
2. **Two-word phrases** (Language) - "said 'more'"
3. **Sharing** (Social-Emotional) - "sharing her snacks with other kids"

---

## 🎨 UI Features

### Timeline View

- **Visual timeline** with color-coded domains
- **Evidence quotes** from your actual memories
- **Age tracking** if mentioned in notes
- **Domain filtering** - view just language, motor, etc.
- **Confidence indicators** - see AI certainty level

### Insights Dashboard

- **Total milestones** count
- **Active domains** showing balanced development
- **Progression velocity** (faster/typical/slower)
- **AI insights** generated weekly
  - Pattern recognition
  - Achievement celebrations
  - Development trajectory
  - Gentle suggestions

### Domain Badges

Each domain has a distinct look:
- 🏃 **Gross Motor** - Blue
- ✋ **Fine Motor** - Purple
- 💬 **Language** - Green
- 🧠 **Cognitive** - Yellow
- ❤️ **Social-Emotional** - Pink
- 🍽️ **Self-Care** - Orange

---

## 🔬 Technical Details

### AI Detection

Uses **Gemini 2.5 Flash** with:
- 60+ milestone patterns from taxonomy
- Context-aware evidence extraction
- Confidence scoring (0-1)
- Age estimation from context
- Duplicate prevention

### Confidence Levels

- **High (0.9+)**: Explicit mention - "she rolled over today"
- **Medium (0.6-0.8)**: Strong implication - "getting better at walking"
- **Low (0.4-0.5)**: Weak signal - considered but flagged

### Milestone Library

**60+ milestones** across age ranges:
- 0-6 months: Social smile, grasping, cooing
- 6-12 months: Sitting, crawling, babbling, object permanence
- 12-18 months: Walking, first words, pointing
- 18-24 months: Running, two-word phrases, pretend play
- 24-36 months: Jumping, sentences, sharing, self-care

### Privacy & Security

- All processing server-side (Gemini API)
- Voice notes stored in your Supabase
- No third-party milestone tracking services
- Full data ownership
- Can export or delete anytime

---

## 📊 Database Schema

### `child_milestones`

```sql
id                UUID PRIMARY KEY
user_id           UUID NOT NULL
memory_id         UUID NOT NULL
milestone_id      TEXT NOT NULL          -- e.g., 'first_steps'
milestone_name    TEXT NOT NULL          -- e.g., 'First steps'
domain            TEXT NOT NULL          -- e.g., 'motor_gross'
confidence        FLOAT (0-1)
evidence          TEXT NOT NULL          -- Quote from memory
is_new            BOOLEAN                -- First detection of this milestone
detected_at       TIMESTAMP
child_age_months  INTEGER
child_name        TEXT                   -- For multiple children
```

### `milestone_insights`

```sql
id                UUID PRIMARY KEY
user_id           UUID NOT NULL
insight_type      TEXT                   -- pattern, achievement, progression, suggestion
title             TEXT NOT NULL
description       TEXT NOT NULL
milestone_ids     TEXT[]
domains_active    TEXT[]
confidence        FLOAT (0-1)
generated_at      TIMESTAMP
dismissed         BOOLEAN
```

### `child_profiles` (Optional)

```sql
id                UUID PRIMARY KEY
user_id           UUID NOT NULL
name              TEXT NOT NULL
birth_date        DATE
milestone_notifications BOOLEAN
```

---

## 🎯 Roadmap & Ideas

### Near-term
- [ ] PDF export of milestone timeline
- [ ] Email digest of new milestones
- [ ] Milestone sharing with family
- [ ] Photo attachments to milestones
- [ ] Month-by-month summaries

### Future Vision
- [ ] Integration with Wizard of Oz photos
  - Link milestones to daily baby photos
  - "First smile" with actual smile photo
  - Visual + text timeline
- [ ] Multi-child support
  - Compare siblings' timelines
  - "Your second learned to walk earlier!"
- [ ] Developmental assessments
  - Gentle questionnaires
  - Age-appropriate milestone checklists
- [ ] Milestone predictions
  - "Based on patterns, crawling likely in next 2-4 weeks"
- [ ] Pediatrician reports
  - Generate summaries for doctor visits
  - Track concerns or questions

---

## 💡 Why This Matters

### For Parents

**Before:**
- Trying to remember when first word happened
- "Was she 9 or 10 months when she started crawling?"
- Missing patterns in development
- Baby book collecting dust

**After:**
- Complete timeline with your exact words
- Pattern insights: "Strong motor development!"
- See progression across all domains
- Effortless - just talk naturally

---

## 🔌 Integration Examples

### With Polymath

Polymath already has memory processing, so you can:

```typescript
// In polymath/lib/process-memory.ts
import { detectMilestones } from '../../baby-milestone-tracker/lib/milestone-detector.js'

// After base processing, add milestone detection
const detectionResult = await detectMilestones(memory.title, memory.body, geminiApiKey)
// Store detectionResult.milestones in database
```

### With MemoryOS

Similar integration - add milestone detection to your voice note processing pipeline.

### Standalone Use

Can be deployed as its own app with a simple voice note capture interface

### For Researchers (Future)

With user consent, anonymized milestone data could help:
- Understanding developmental variation
- Cultural differences in parenting observations
- Language used to describe milestones
- Improving milestone detection accuracy

### For Families

- Share timeline with grandparents
- Compare siblings (gently!)
- Preserve memories with context
- Celebrate small victories

---

## 🛠️ Troubleshooting

### Milestones not detecting

**Check:**
1. Is memory processing completing? (Check `processed` field)
2. Does memory have developmental themes?
3. Are you mentioning specific achievements?

**Try:**
- Be specific: "She sat up by herself" vs "playing with baby"
- Include context: age, what happened, your reaction
- Natural language works best

### False detections

**Causes:**
- Hypothetical language: "I wonder when she'll walk"
- Questions: "Do you think he's ready to crawl?"
- Historical: "My brother walked at 9 months"

**Solution:**
- AI trained to recognize these patterns
- Low confidence scores help filter
- Can dismiss or delete false positives

### Missing domain coverage

**Expected:**
- Not all domains active simultaneously
- Normal for 0-6 months to be mostly motor + social-emotional
- Language develops later
- Self-care milestones start 12+ months

---

## 📚 References

### Developmental Guidelines
- **WHO**: Motor milestone windows
- **CDC**: Developmental monitoring guidelines
- **AAP**: Bright Futures milestones

### Evidence-Based Approach
- Age ranges based on research (5th-95th percentile)
- No prescriptive "should be doing"
- Celebrates neurodiversity
- Encourages observation without anxiety

---

## 🤝 Contributing

### Adding New Milestones

Edit `lib/milestone-taxonomy.ts`:

```typescript
{
  id: 'new_milestone_id',
  domain: 'motor_gross',
  name: 'Milestone name',
  typical_age_months: { min: 12, max: 18 },
  significance: 'major',
  indicators: ['keyword1', 'phrase to match', 'another indicator']
}
```

### Improving Detection

AI prompt is in `lib/milestone-detector.ts` - tune for better accuracy.

### UI Enhancements

Timeline component in `src/components/milestones/MilestoneTimeline.tsx`

---

## 📄 Project Info

**Part of the Aperture monorepo** - Personal projects by Dan Croome-Horgan

This is a standalone project that was originally developed as part of Polymath and then extracted into its own independent module for better reusability and integration with other memory/voice note systems.

**Status**: Active development
**Created**: October 2025
**Extracted from Polymath**: October 2025

---

## ❤️ Acknowledgments

Built with:
- **Polymath** - Creative synthesis engine
- **Gemini AI** - Milestone detection
- **Supabase** - Database & storage
- **React** - UI framework

Inspired by:
- Parents who forget precious moments
- The magic of seeing development unfold
- The belief that remembering matters

---

**Ready to capture your child's journey? Start with a voice note!**

🎙️ *"Today she smiled at me for the first time..."*
