# Polymath Workflow Improvements

## 🎯 Current State: What's Working Well

✅ **Voice-First Capture**: Voice notes → AI processing → auto-linking is excellent
✅ **AI Pipeline**: Embeddings, entity extraction, auto-suggestions all functional
✅ **RSS Auto-Sync**: Feeds sync automatically on page load (throttled to 2 hours)
✅ **Synthesis Engine**: Generates diverse project ideas from capabilities × interests

---

## 🔧 Suggested Workflow Improvements

### 1. **Connection Suggestions UI** (High Priority)
**Problem**: Connection suggestions are generated but NOT displayed
**Status**: ⚠️ Data exists in `connection_suggestions` table but no UI

**Fix Needed**:
- Add "Suggested Connections" section to memory/project/article detail pages
- Show AI reasoning (e.g., "82% semantic match - both discuss React hooks")
- Accept/Reject buttons
- Update connection strength based on user feedback

**Why Important**: Currently the AI is doing work that users never see!

---

### 2. **Project Scaffold Generator** (Your Request)
**Feature**: Generate GitHub repo structure + README before showing suggestion

**Flow**:
1. Synthesis generates project idea
2. **NEW**: AI generates complete project scaffold:
   - Full README.md
   - File structure (src/, tests/, docs/)
   - Tech stack specifics
   - MVP feature list (ordered)
   - Setup instructions
3. Store scaffold with suggestion
4. User sees complete, actionable project plan

**Benefits**:
- Ideas become immediately actionable
- Reduces friction from "interesting idea" → "started building"
- Professional README from day 1
- Clear MVP scope prevents scope creep

**Implementation**:
- New file: `lib/generate-project-scaffold.ts` (created)
- Add `scaffold` field to `project_suggestions` table (JSONB)
- UI: Show README in suggestion detail with "Copy to Clipboard" button
- Optional: "Create Repo" button → GitHub API to create actual repo

---

### 3. **Capability Scanner Automation**
**Problem**: Synthesis needs capabilities, but scanner must be run manually

**Solutions**:
a) **Auto-scan on project completion**
   - When user marks project as "completed"
   - Extract capabilities immediately

b) **"Scan My Skills" button on Projects page**
   - One-click capability extraction
   - Shows progress: "Analyzing 5 projects..."

c) **Smart prompts**
   - If synthesis fails due to no capabilities
   - Show: "Add technical details to your projects to get better suggestions"

---

### 4. **Global Search** (Missing Feature)
**Problem**: No way to search across all content

**Solution**: Add search bar in header
- **Hybrid search**:
  - Keyword matching (fast)
  - Vector similarity (semantic)
- Search across: memories, projects, articles
- Show results grouped by type
- Highlight matching content

---

### 5. **Daily Queue Intelligence**
**Current**: Articles added to queue based on read/unread status

**Improved**:
- **Smart sorting** based on active projects
  - Check which projects are "active"
  - Prioritize articles with high similarity to active project embeddings
  - Example: Working on React project → React articles float to top

- **Forgotten Content Surfacing**
  - "You captured this memory 3 months ago, might be relevant now"
  - Use embeddings to surface old content related to current work

---

### 6. **PWA + Offline Support**
**Benefit**: Better mobile experience

**Features**:
- Add to Home Screen (PWA manifest)
- Offline voice note capture
- Queue captured notes for when back online
- Background sync API

---

### 7. **Bulk Operations**
**Current**: Must process items one at a time

**Add**:
- Bulk tag editing
- Bulk status changes (mark multiple articles as read)
- Bulk delete
- Already partially implemented (useBulkSelection hook exists!)

---

## 📝 Feature Request: Repo Scaffold Implementation Plan

### Phase 1: Database (1-2 hours)
```sql
-- Add scaffold field to project_suggestions
ALTER TABLE project_suggestions
ADD COLUMN scaffold JSONB DEFAULT NULL;

-- Add index for JSON queries
CREATE INDEX idx_project_suggestions_scaffold
ON project_suggestions USING gin(scaffold);
```

### Phase 2: Scaffold Generation (2-3 hours)
- ✅ Created: `lib/generate-project-scaffold.ts`
- Integrate into synthesis.ts:
  ```typescript
  // After generating suggestion
  const scaffold = await generateProjectScaffold(
    suggestion.title,
    suggestion.description,
    capabilities.map(c => c.name)
  )
  suggestion.scaffold = scaffold
  ```

### Phase 3: UI (2-3 hours)
- Update `SuggestionDetailDialog.tsx`:
  - Tab 1: Overview (current view)
  - Tab 2: **README** (new - shows scaffold.readme with syntax highlighting)
  - Tab 3: **File Structure** (new - shows scaffold.fileStructure as tree)
  - Tab 4: Connections (existing)

- Add "Copy README" button
- Add "Download scaffold as ZIP" (optional)
- Add "Create GitHub Repo" (optional, requires GitHub OAuth)

### Phase 4: GitHub Integration (Optional, 3-4 hours)
- OAuth with GitHub
- Create repo via GitHub API
- Push initial commit with:
  - README.md
  - .gitignore
  - package.json (if applicable)
  - Placeholder files from scaffold

**Total Effort**: 8-12 hours

---

## 🎨 Quick Wins (< 1 hour each)

1. **Show connection suggestions on detail pages**
   - Query `connection_suggestions` table
   - Display in UI with accept/reject

2. **Add "Quick Capture" floating button**
   - Visible on all pages
   - Opens voice recording immediately

3. **Improve empty states**
   - "No suggestions yet? Add more memories to train the AI!"
   - "No connections found. The AI will suggest some after processing."

4. **Add loading states for AI processing**
   - "🤖 AI is analyzing your voice note..."
   - "🔗 Finding related content..."

5. **Toast notifications for background operations**
   - "3 new articles synced from BBC News"
   - "AI found 2 connections to your React project"

---

## 🚀 Recommended Priority

### Must-Have (Next Week):
1. Connection Suggestions UI ⚠️
2. Capability Scanner button
3. Quick Capture floating button

### Should-Have (Next Month):
4. Project Scaffold Generator
5. Global Search
6. Smart Daily Queue sorting

### Nice-to-Have (Future):
7. PWA + Offline
8. GitHub Integration
9. Bulk operations polish

---

## 💡 Long-Term Vision

**The "Zero-Friction Creative Flow"**:

1. **Capture** (voice-first, always accessible)
2. **Connect** (AI auto-links, shows suggestions)
3. **Synthesize** (weekly ideas, with full repo scaffolds)
4. **Build** (one-click from idea → GitHub repo → started)
5. **Complete** (auto-extract capabilities → better future suggestions)

**Feedback loop**: The more you use it, the better suggestions you get.

---

## 📊 Metrics to Track

1. **Capture Rate**: Voice notes per week
2. **Connection Acceptance Rate**: % of AI suggestions accepted
3. **Suggestion Build Rate**: % of suggestions → projects
4. **Time to First Commit**: Idea → code (goal: < 1 day)
5. **Capability Growth**: # capabilities over time

---

**Next Steps**: Pick 1-2 items from "Must-Have" list and I'll implement them!
