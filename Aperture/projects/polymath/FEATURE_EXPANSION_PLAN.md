# Polymath Feature Expansion Plan
> Making Polymath a fully-featured personal knowledge & creativity app

**Last updated**: 2025-10-26
**Status**: Planning phase

---

## App Replacement Strategy

Based on analysis of current home screen apps, Polymath can consolidate multiple tools into one unified system.

### ✅ Already Replaced

**Audiopen**
- ✅ Voice notes via Audiopen webhook
- ⚠️ Missing: "Write Like Me" style learning
- ⚠️ Missing: Super Summary (multi-note synthesis)

### 🎯 High-Value Replacements

---

## Phase 1: Read-Later System (Replace Readwise Reader)

**Value**: Replaces $120/year subscription, centralizes knowledge capture
**Timeline**: 2-3 days
**Priority**: 🥇 #1

### Why This Fits Polymath

- Natural extension of memory capture
- Read-later content becomes "memory seeds"
- Highlights → memories with source tracking
- Daily Review already exists (resurfacing queue)
- AI synthesis capabilities already built

### Core Features

#### 1. URL Saving & Content Extraction
- `POST /api/memories` with `url` field
- Auto-fetch article content (Readability API or Jina AI)
- Extract: title, author, publish_date, read_time
- Create memory with `type: 'article'`
- Store original URL and cleaned content

#### 2. Reading Queue Interface
**New route**: `/reading`

**Views**:
- Unread (default)
- Archived
- All articles

**Card display**:
- Title (large)
- Source domain + author
- Read time estimate
- Thumbnail/favicon
- Save date
- Tags (auto-extracted)

**Actions**:
- Open article (clean reader view)
- Mark as read → auto-archive
- Delete
- Add to memory as summary

#### 3. Reader View
**Route**: `/reading/:id`

**Features**:
- Distraction-free layout
- Clean typography
- Text selection → "Save as memory" tooltip
- Progress indicator
- Estimated time remaining
- Dark mode support

#### 4. Highlighting System

**Interaction**:
1. Select text in reader
2. Tooltip appears: "💾 Save as memory"
3. Click → opens memory creation dialog
4. Pre-filled with highlight text
5. Add notes/tags
6. Save → links to article

**Storage**:
```typescript
{
  memory_id: uuid
  source_article_id: uuid
  highlight_text: string
  highlight_position: { start: number, end: number }
  notes: string
  created_at: timestamp
}
```

**Display**:
- Highlights shown in context in article
- Yellow background on highlighted text
- Click highlight → view memory

#### 5. Browser Extension (Optional Phase 1B)

**Functionality**:
- Right-click → "Save to Polymath"
- Highlight text → right-click → "Highlight in Polymath"
- Badge shows unread count
- Quick save popup

**Tech**:
- Chrome/Firefox manifest v3
- Communicates with `/api/reading/save`

---

## Phase 2: Active Learning (Replace Recall)

**Value**: Transforms passive reading into active learning
**Timeline**: 2-3 days
**Priority**: 🥈 #2

### Why This Fits Polymath

- Resurfacing queue already exists
- AI synthesis capabilities (Claude)
- Memory system perfect for learning
- Spaced repetition complements knowledge graph

### Core Features

#### 1. AI Question Generation

**Endpoint**: `POST /api/memories/:id/generate-questions`

**Process**:
1. Send memory content to Claude
2. Generate 3-5 questions testing understanding
3. Store with answers

**Prompt**:
```
Generate 3-5 thoughtful questions to test understanding of this memory:

[memory content]

For each question:
- Test conceptual understanding (not rote memorization)
- Make questions specific to the content
- Provide concise correct answer

Return JSON: [{ question: string, answer: string }]
```

**Storage**:
```sql
CREATE TABLE memory_questions (
  id UUID PRIMARY KEY,
  memory_id UUID REFERENCES memories(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE question_attempts (
  id UUID PRIMARY KEY,
  question_id UUID REFERENCES memory_questions(id),
  attempted_at TIMESTAMP DEFAULT NOW(),
  rating TEXT CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  next_review TIMESTAMP
);
```

#### 2. Review Interface

**New route**: `/review`

**Layout**:
```
┌─────────────────────────────┐
│ Memory Context (top)        │
│ "From: Article about X"     │
├─────────────────────────────┤
│                             │
│ Question displayed here     │
│ (large, centered)           │
│                             │
│ [Show Answer] button        │
│                             │
└─────────────────────────────┘
```

**After "Show Answer"**:
```
┌─────────────────────────────┐
│ Question                    │
├─────────────────────────────┤
│ ✓ Correct Answer            │
│                             │
│ How well did you know this? │
│                             │
│ [Again] [Hard] [Good] [Easy]│
│  1 min   10 min  1 day  4 days│
└─────────────────────────────┘
```

#### 3. Spaced Repetition Scheduling

**Algorithm**: SM-2 (SuperMemo 2)

**Intervals**:
- Again: 1 minute
- Hard: 10 minutes
- Good: 1 day (or current interval × 1.5)
- Easy: 4 days (or current interval × 2.5)

**Integration**:
- Questions appear in existing resurfacing queue
- Mix with memory resurfacing
- Badge shows "X questions due"

#### 4. Learning Analytics

**Add to Timeline page**:
- Retention rate per theme
- Most reviewed questions
- Learning streaks
- "Mastered" vs "Learning" breakdown
- Chart: reviews per week

**Stats tracked**:
- Total questions reviewed
- Accuracy rate
- Current streak
- Hardest concepts (most "Again")

---

## Phase 3: Quick Capture (Replace Google Keep)

**Value**: Reduces app-switching, improves daily UX
**Timeline**: 1-2 days
**Priority**: 🥉 #3

### Core Features

#### 1. Android Widget

**Widget types**:
- **Text input** (4x1): Quick text → instant memory
- **Voice button** (2x1): Tap → record → auto-save
- **Camera button** (1x1): Tap → photo → OCR → memory

**Implementation** (Capacitor):
```typescript
// Use capacitor-widget plugin
import { Widget } from 'capacitor-widget';

Widget.addListener('quickCapture', async (data) => {
  await createMemory({
    content: data.text,
    type: 'quick_note'
  });
});
```

#### 2. Image Memories with OCR

**Flow**:
1. Upload/capture photo
2. Run OCR (Tesseract.js or Google Cloud Vision)
3. Extract text → make searchable
4. Display thumbnail in memory card
5. Click → show full image

**Storage**:
```typescript
{
  memory_id: uuid
  image_url: string  // Supabase Storage
  ocr_text: string   // Searchable
  thumbnail_url: string
}
```

**UI**:
- Memory card shows thumbnail
- Full screen image viewer
- OCR text shown below image
- Editable (if OCR was wrong)

#### 3. Checkbox Lists (Optional)

**Use case**: Quick todos, shopping lists

**Implementation**:
- Add `list_items` JSONB field to memories
- Checkbox UI in memory detail
- Check/uncheck items
- "Convert to project" for complex lists

**Storage**:
```typescript
memory.list_items = [
  { text: "Buy milk", checked: false },
  { text: "Call dentist", checked: true }
]
```

---

## Phase 4: Enhanced Audiopen Features

**Value**: Match/exceed Audiopen capabilities
**Timeline**: 1 day
**Priority**: Medium

### Features

#### 1. "Write Like Me" Style Learning

**Approach**:
- Analyze user's past edited transcripts
- Fine-tune prompt with examples
- Include in Gemini/Claude processing

**Implementation**:
- Store original transcript + final edited version
- Build style guide from diffs
- Include in processing prompt:
  ```
  User's writing style examples:
  - Prefers short paragraphs
  - Uses Oxford comma
  - Casual tone but grammatically correct
  ```

#### 2. Multi-Note Synthesis (Super Summary)

**Endpoint**: `POST /api/memories/synthesize`

**Flow**:
1. Select multiple voice notes
2. Click "Synthesize"
3. Claude combines into coherent summary
4. Creates new memory with source links

**UI**:
- Multi-select mode in memories list
- "Synthesize selected" button
- Shows combined content + synthesis

---

## Implementation Roadmap

### Week 1: Read-Later Foundation
- [ ] Database schema for articles
- [ ] URL saving endpoint
- [ ] Article content extraction
- [ ] Reading queue UI
- [ ] Reader view

### Week 2: Read-Later Complete
- [ ] Highlighting system
- [ ] Highlight → memory flow
- [ ] Article metadata (read time, etc.)
- [ ] Archive/unread states
- [ ] Browser extension (optional)

### Week 3: Active Learning Foundation
- [ ] Question generation endpoint
- [ ] Database schema for questions/attempts
- [ ] Review interface UI
- [ ] Spaced repetition algorithm

### Week 4: Active Learning Complete
- [ ] Integration with resurfacing queue
- [ ] Learning analytics
- [ ] Progress tracking
- [ ] Chart visualizations

### Week 5: Quick Capture
- [ ] Image upload + OCR
- [ ] Android widget (text)
- [ ] Android widget (voice)
- [ ] Android widget (camera)
- [ ] Checkbox lists (optional)

### Week 6: Polish & Enhancement
- [ ] "Write Like Me" for Audiopen
- [ ] Multi-note synthesis
- [ ] Performance optimization
- [ ] Mobile UX improvements

---

## Success Metrics

### Read-Later Success
- ✅ Save 10+ articles in first week
- ✅ Actually read 5+ of them
- ✅ Create 3+ highlight-based memories
- ✅ Cancel Readwise Reader subscription

### Active Learning Success
- ✅ Generate questions for 10+ memories
- ✅ Review daily for 1 week
- ✅ 70%+ retention rate
- ✅ Feel like you're learning (not just saving)

### Quick Capture Success
- ✅ Use widget 5+ times in first week
- ✅ OCR 3+ images successfully
- ✅ Reduce Google Keep usage by 50%

---

## Technical Considerations

### Content Extraction Options

**Option 1: Readability API**
- Pros: Clean, reliable
- Cons: $10/mo for 10k requests
- Best for: Production

**Option 2: Jina AI Reader**
- Pros: Free tier, modern
- Cons: Rate limits
- Best for: MVP/testing

**Option 3: Mozilla Readability**
- Pros: Free, open source
- Cons: Need to run yourself
- Best for: Self-hosted

### OCR Options

**Option 1: Tesseract.js**
- Pros: Free, client-side
- Cons: Lower accuracy
- Best for: MVP

**Option 2: Google Cloud Vision**
- Pros: Very accurate
- Cons: $1.50/1000 requests
- Best for: Production

**Option 3: AWS Textract**
- Pros: Good accuracy
- Cons: Complex pricing
- Best for: High volume

### Storage Considerations

**Article content**:
- Store cleaned HTML in Supabase
- Or: Store URL + cache parsed content
- Consider: Supabase storage limits

**Images**:
- Use Supabase Storage (free tier: 1GB)
- Thumbnail generation server-side
- Or: Use Cloudflare Images ($5/mo)

---

## Database Schema Extensions

```sql
-- Read-later articles
CREATE TABLE reading_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  title TEXT,
  author TEXT,
  content TEXT,  -- Cleaned HTML or markdown
  excerpt TEXT,
  published_date TIMESTAMP,
  read_time_minutes INTEGER,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'archived')),
  source TEXT,  -- Domain name
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Highlights from articles
CREATE TABLE article_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES reading_queue(id),
  memory_id UUID REFERENCES memories(id),
  highlight_text TEXT NOT NULL,
  start_position INTEGER,
  end_position INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Questions for active learning
CREATE TABLE memory_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id UUID REFERENCES memories(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Question review tracking
CREATE TABLE question_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID REFERENCES memory_questions(id),
  user_id UUID REFERENCES auth.users(id),
  attempted_at TIMESTAMP DEFAULT NOW(),
  rating TEXT CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  next_review TIMESTAMP,
  interval_days DECIMAL,
  ease_factor DECIMAL DEFAULT 2.5
);

-- Image memories
ALTER TABLE memories ADD COLUMN image_url TEXT;
ALTER TABLE memories ADD COLUMN ocr_text TEXT;
ALTER TABLE memories ADD COLUMN thumbnail_url TEXT;
ALTER TABLE memories ADD COLUMN list_items JSONB;
```

---

## Next Steps

1. **Review with user** - Get feedback on priorities
2. **Choose Phase 1 starting point** - Read-later most valuable?
3. **Set up development branch** - `feature/read-later`
4. **Create detailed task list** - Break down Phase 1 into tasks
5. **Start building!**

---

**See also**:
- `ROADMAP.md` - Original Polymath synthesis roadmap
- `NEXT_SESSION.md` - Current bugs to fix first
- `ARCHITECTURE.md` - Technical architecture
