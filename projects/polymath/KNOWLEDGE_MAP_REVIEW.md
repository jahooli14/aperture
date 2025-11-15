# Knowledge Map - User Journey & Improvement Plan

## Executive Summary

I've traced through the complete knowledge map implementation, from initial page load through data generation to visualization and interaction. Here are the findings organized by user journey stage.

---

## User Journey Analysis

### Stage 1: Page Load (`/map`)

**What Happens:**
1. User navigates to `/map`
2. `KnowledgeMapPage` component mounts
3. `useEffect` triggers `fetchMap()` from useMapStore
4. Loading state shows: "Generating Your Knowledge Map - Analyzing your projects, thoughts, and articles..."

**Expected Output:** Loading spinner with message
**Actual Output:** ✅ Works as expected

**Code Path:**
- `src/pages/KnowledgeMapPage.tsx:16-21` - useEffect triggers fetch
- `src/stores/useMapStore.ts:38-80` - fetchMap() implementation

---

### Stage 2: Map Generation (First Time)

**What Happens:**
1. API call: `GET /api/projects?resource=knowledge_map`
2. Check if map exists in database (`knowledge_map_state` table)
3. If not found → generate initial map
4. Save to database
5. Return map data to frontend

**Expected Output:** Map with semantic clusters of items
**Actual Output:** ⚠️ **POTENTIAL ISSUE**

**Code Path:**
- `api/projects.ts:402-518` - knowledge_map resource handler
- `api/projects.ts:438-458` - Load existing or generate
- `api/lib/map-generation.ts:280-573` - generateInitialMap()

**Issues Found:**

#### Issue 1: Memories Query (FIXED ✅)
- **Location:** `api/lib/map-generation.ts:246`
- **Problem:** Was filtering by `user_id` column that doesn't exist
- **Status:** Fixed in commit 045cbd7
- **Result:** Memories now load correctly

#### Issue 2: No Items with Embeddings?
- **Location:** `api/lib/map-generation.ts:351-363`
- **Check:** If `allItems.length === 0`, returns empty map
- **Potential Problem:**
  - Do memories have embeddings? Only if they've been processed
  - Do projects have embeddings? Only if created after backfill
  - Do articles have embeddings? Yes, from RSS import
- **Test Required:** Check actual database state

#### Issue 3: Embedding Clustering Math
- **Location:** `api/lib/map-generation.ts:376`
- **Formula:** `Math.max(3, Math.min(20, Math.floor(Math.sqrt(allItems) * 2)))`
- **Examples:**
  - 5 items → 4 clusters (almost 1:1, not useful)
  - 10 items → 6 clusters
  - 25 items → 10 clusters
  - 50 items → 14 clusters
  - 100 items → 20 clusters (capped)
- **Potential Issue:** Too many clusters for small datasets

---

### Stage 3: Map Rendering

**What Happens:**
1. Map data arrives from API
2. Cities, roads, and regions render in SVG
3. Viewport culling filters visible elements
4. Pan/zoom gestures enabled

**Expected Output:** Google Maps-style visualization with cities and roads
**Actual Output:** ⚠️ **VISUAL ISSUES**

**Code Path:**
- `src/components/map/MapCanvas.tsx:157-395` - Main rendering
- `src/components/map/MapCanvas.tsx:233-265` - Regions
- `src/components/map/MapCanvas.tsx:267-279` - Cities
- `src/components/map/MapCanvas.tsx:268-270` - Roads

**Issues Found:**

#### Issue 4: Region Rendering
- **Location:** `MapCanvas.tsx:234-265`
- **Current Behavior:** One region per cluster (since each cluster = 1 city)
- **Problem:** Regions overlap cities exactly - not useful visual distinction
- **User Expectation:** Regions should group multiple related cities
- **Fix Needed:** Either remove regions or redesign to group semantically similar clusters

#### Issue 5: City Labels (Keyword Extraction)
- **Location:** `api/lib/map-generation.ts:382-404` - generateClusterLabel()
- **Current Behavior:** Extracts most common word from cluster member titles
- **Examples of Output:**
  - "paint" (from "Paint pouring communist stencil")
  - "tame" (from "Tame Impala's telepathic synths")
  - "learning" (generic word that appears often)
- **Problem:**
  - Stop words filter may be too weak
  - Single-word labels aren't descriptive
  - Common words dominate (e.g., "learning", "project", "idea")
- **User Expectation:** Meaningful cluster names like "Music Production" or "Art Projects"
- **Fix Needed:** Better label generation (2-3 words, noun phrases, or use AI)

#### Issue 6: Roads Based on Similarity
- **Location:** `api/lib/map-generation.ts:455-511`
- **Current Behavior:** Roads connect cities with >0.6 cosine similarity
- **Math:** Similarity of 0.6-1.0 → strength 1-15
- **Potential Problem:**
  - 0.6 threshold may create too many connections
  - With semantic clustering, nearby clusters should already be similar
  - Result: Dense mesh of roads, not highways between distinct regions
- **User Expectation:** Clear highways between major concept areas
- **Test Required:** Check if too many roads render

---

### Stage 4: Map Interaction

**What Happens:**
1. User pans and zooms the map
2. Viewport culling shows only visible items
3. Click city → opens CityDetailsPanel
4. Transform state auto-saves every 2 seconds

**Expected Output:** Smooth interaction, details panel shows city contents
**Actual Output:** ⚠️ **PERFORMANCE & UX ISSUES**

**Code Path:**
- `MapCanvas.tsx:46-73` - Gesture handlers
- `MapCanvas.tsx:100-122` - Viewport culling
- `MapCanvas.tsx:383-392` - Performance indicator

**Issues Found:**

#### Issue 7: Viewport Culling Dependency
- **Location:** `MapCanvas.tsx:122`
- **Problem:** `useMemo` depends on `transformRef.current.{x,y,scale}`
- **Issue:** transformRef is a ref, not state - useMemo won't re-run on changes
- **Result:** Culling only updates on mapData changes, not during pan/zoom
- **Fix Needed:** Convert transform to state or use different approach

#### Issue 8: Transform Application
- **Location:** `MapCanvas.tsx:34-43`
- **Current:** Directly manipulates SVG transform via style
- **Problem:** Not reactive - React doesn't know about changes
- **Performance:** Fine for transforms, but breaks culling dependency
- **Fix Needed:** Either keep imperative (and fix culling) or make reactive

#### Issue 9: Gesture Library Integration
- **Location:** `MapCanvas.tsx:46-73`
- **Library:** `@use-gesture/react`
- **Potential Issue:** onDrag offset may not work as expected with cumulative transforms
- **Test Required:** Verify pan doesn't "jump" on interaction

---

### Stage 5: City Details

**What Happens:**
1. User clicks city
2. `CityDetailsPanel` opens showing:
   - City name and population
   - List of items (memories/projects/articles)
3. Can click items to navigate

**Expected Output:** Panel with all items in cluster
**Actual Output:** ⚠️ **DATA RETRIEVAL ISSUE**

**Code Path:**
- `src/pages/KnowledgeMapPage.tsx:23-28` - Click handler
- `src/pages/KnowledgeMapPage.tsx:174-180` - Panel rendering

**Issues Found:**

#### Issue 10: Item Data Not Included
- **Location:** Map generation returns city with `itemIds: string[]`
- **Problem:** Frontend needs to fetch actual item data separately
- **Current:** City has `itemIds` but not item details (title, type, etc.)
- **User Impact:** Can't show item list without additional API calls
- **Fix Options:**
  1. Include item metadata in map generation
  2. Add API endpoint to fetch items by IDs
  3. Use existing stores (memories, projects, articles) to look up

---

### Stage 6: Door Suggestions

**What Happens:**
1. After map loads, fetch door suggestions
2. API generates "doors" - suggested new connections/topics
3. Render door icons on map
4. User can accept/dismiss

**Expected Output:** Doors appear for potential improvements
**Actual Output:** ⚠️ **UNCLEAR INTEGRATION**

**Code Path:**
- `src/stores/useMapStore.ts:82-103` - fetchDoorSuggestions()
- `api/projects.ts:409-435` - Door suggestions endpoint
- `api/lib/map-suggestions.ts` - Generation logic

**Issues Found:**

#### Issue 11: Door Suggestions Not Implemented
- **Location:** `api/lib/map-suggestions.ts` (imported but not checked)
- **Status:** Unclear if this file exists and works
- **Test Required:** Verify door generation works with new clustering approach

---

## Performance Analysis

### Good Decisions ✅

1. **Viewport Culling:** Only rendering visible cities (MapCanvas.tsx:100-130)
2. **SVG Transform:** Using CSS transforms instead of re-rendering (MapCanvas.tsx:34-43)
3. **Debounced Saves:** Viewport saves every 2s, not on every pan (MapCanvas.tsx:86-98)
4. **Roads Filter:** Only showing roads between visible cities (MapCanvas.tsx:124-130)

### Performance Issues ⚠️

1. **K-means Clustering:** Runs in generateInitialMap (expensive for large datasets)
   - Current: O(n * k * iterations) with n=items, k=clusters, iterations=10
   - For 100 items, 20 clusters: 20,000 distance calculations
   - **Impact:** Slow initial map generation (3-5 seconds)
   - **Fix:** Cache embeddings, use approximate k-means, or defer to worker

2. **Force-Directed Layout:** Runs for 50 iterations (api/lib/map-generation.ts:496)
   - Physics simulation for city positioning
   - **Impact:** Additional 2-3 seconds on generation
   - **Fix:** Reduce iterations or use grid layout

3. **Centroid Calculation:** Recalculated for every cluster (api/lib/map-generation.ts:458-478)
   - Averages all embeddings in cluster (768 dimensions each)
   - **Impact:** O(items * 768) operations
   - **Fix:** Calculate once, reuse

### Current Performance Estimate
- **Small dataset** (5-20 items): ~1 second
- **Medium dataset** (20-100 items): ~3-5 seconds
- **Large dataset** (100-500 items): ~10-15 seconds

**User Reported:** "Performance is slow"
**Likely Culprit:** K-means + Force-directed layout during initial generation

---

## Visual Design Issues

### What User Expects: "Google Maps-style"

**Google Maps Characteristics:**
- Clear hierarchy (countries → states → cities)
- Labeled regions with boundaries
- Color-coded areas
- Roads between cities with clear importance (highways vs streets)
- Zoom levels show different detail

### What We Currently Have:

1. **Regions:** ⚠️ Overlapping circles, one per city (not useful)
2. **Cities:** ✅ Sized by population, but labels are unclear
3. **Roads:** ⚠️ Potentially too dense (>0.6 similarity threshold)
4. **Zoom:** ✅ Works but no level-of-detail changes
5. **Colors:** ⚠️ Regions use random colors, no semantic meaning
6. **Labels:** ❌ Single-word keywords, often unhelpful

### User Reported Issues

> "Content is wrong (doesn't relate to any topics in thoughts etc.)"

**Root Cause:** Memories query was broken (now fixed)
**Secondary Issue:** Label generation uses generic keywords

> "Visuals are wrong"

**Specific Problems:**
1. Regions don't group multiple cities meaningfully
2. City labels are single generic words
3. No clear visual hierarchy
4. Roads may create visual clutter

> "Performance is slow"

**Specific Problems:**
1. Initial generation takes 3-5+ seconds
2. Loading state doesn't show progress

> "It doesn't look like a map at all"

**Specific Problems:**
1. Lacks familiar map elements (borders, territories, etc.)
2. Regions are just overlapping circles
3. No visual grouping or hierarchy
4. Cities are scattered points, not grouped areas

---

## Improvement Plan

### Priority 1: Fix Data Issues (Critical) 🔴

#### 1.1 Verify Embeddings Exist
**Action:** Query database to check:
```sql
SELECT
  (SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL) as memories_with_embeddings,
  (SELECT COUNT(*) FROM projects WHERE embedding IS NOT NULL) as projects_with_embeddings,
  (SELECT COUNT(*) FROM reading_queue WHERE embedding IS NOT NULL) as articles_with_embeddings;
```
**Why:** Empty map if no embeddings
**Priority:** Do first

#### 1.2 Better Cluster Labels
**Current:** `extractTopicsFromText()` returns single common word
**Fix:**
- Option A: Generate 2-3 word noun phrases ("Music Production", "Art Projects")
- Option B: Use Gemini to summarize cluster (1 API call per cluster)
- Option C: Use most descriptive title from cluster members
**Effort:** 1-2 hours
**Impact:** High - directly addresses "content is wrong"

#### 1.3 Include Item Metadata in Cities
**Current:** City has `itemIds: string[]`
**Fix:** Add `items: Array<{id, type, title}>` to city object
**Effort:** 30 minutes
**Impact:** Medium - enables item display in CityDetailsPanel

### Priority 2: Fix Visual Issues (High) 🟠

#### 2.1 Redesign Regions
**Current Problem:** One region per cluster (not useful)
**Fix Options:**
1. **Remove regions entirely** (simplest)
2. **Hierarchical clustering:** Group similar clusters into regions
3. **Manual regions:** User-defined territories
**Recommendation:** Start with #1 (remove), add #2 later
**Effort:** 15 minutes (remove) or 3-4 hours (hierarchical)
**Impact:** High - major visual improvement

#### 2.2 Adjust Road Threshold
**Current:** >0.6 similarity creates road
**Fix:** Increase threshold to 0.7-0.75 to reduce clutter
**Test:** Generate map with different thresholds, compare visuals
**Effort:** 15 minutes
**Impact:** Medium - cleaner visualization

#### 2.3 Improve City Labels Typography
**Current:** Single word in uppercase
**Fix:**
- Show 2-3 words in title case
- Add truncation with ellipsis
- Adjust font size based on city importance
**Effort:** 1 hour
**Impact:** Medium - better readability

### Priority 3: Performance Improvements (Medium) 🟡

#### 3.1 Optimize K-means Clustering
**Current:** 10 iterations for all items
**Fix:**
- Reduce to 5 iterations (usually sufficient)
- Use k-means++ initialization (better starting centroids)
- Cache cluster assignments
**Effort:** 1-2 hours
**Impact:** ~30-40% faster generation

#### 3.2 Optimize Force-Directed Layout
**Current:** 50 iterations
**Fix:** Reduce to 20-30 iterations (visual quality vs speed tradeoff)
**Effort:** 15 minutes
**Impact:** ~30-40% faster generation

#### 3.3 Add Progress Indicator
**Current:** Generic "Generating..." message
**Fix:** Show steps:
1. "Loading items..." (embeddings fetch)
2. "Clustering topics..." (k-means)
3. "Positioning cities..." (force-directed)
4. "Creating map..." (final assembly)
**Effort:** 1 hour
**Impact:** High - better perceived performance

#### 3.4 Fix Viewport Culling
**Current:** useMemo doesn't re-run on transform changes
**Fix:** Convert transformRef to state:
```typescript
const [transform, setTransform] = useState({x: 0, y: 0, scale: 1})
```
**Effort:** 30 minutes
**Impact:** Medium - smoother rendering during interaction

### Priority 4: Feature Improvements (Low) 🟢

#### 4.1 Better Cluster Count Logic
**Current:** `Math.floor(Math.sqrt(items) * 2)`
**Problem:** Too many clusters for small datasets
**Fix:**
```typescript
const numClusters = allItems.length < 10 ? 3 :
                    allItems.length < 30 ? Math.floor(Math.sqrt(allItems.length)) :
                    Math.min(20, Math.floor(Math.sqrt(allItems.length) * 1.5))
```
**Examples:**
- 5 items → 3 clusters
- 10 items → 3 clusters
- 25 items → 7 clusters
- 50 items → 10 clusters
- 100 items → 15 clusters
**Effort:** 15 minutes
**Impact:** Medium - more meaningful clusters

#### 4.2 Door Suggestions Verification
**Action:** Test if map-suggestions.ts works with new clustering
**Effort:** 1 hour (testing + fixes)
**Impact:** Low - nice-to-have feature

#### 4.3 Level-of-Detail Rendering
**Current:** Same detail at all zoom levels
**Fix:**
- Zoom out: Hide roads, show only large cities, show region labels
- Zoom in: Show all details, individual item icons
**Effort:** 2-3 hours
**Impact:** Medium - better Google Maps feel

#### 4.4 Semantic Region Colors
**Current:** Random colors per region
**Fix:** Color based on content type or theme
- Blue: Tech/projects
- Green: Learning/articles
- Purple: Creative/ideas
**Effort:** 1-2 hours (requires theme detection)
**Impact:** Low - visual polish

---

## Testing Checklist

### Before ANY changes:
- [ ] Check database for embeddings count
- [ ] Generate map with current code
- [ ] Screenshot current state
- [ ] Count cities, roads, regions generated
- [ ] Note generation time
- [ ] Test pan/zoom interaction
- [ ] Test city click → details panel

### After Priority 1 fixes:
- [ ] Verify better cluster labels appear
- [ ] Confirm items show in CityDetailsPanel
- [ ] Check labels match actual content

### After Priority 2 fixes:
- [ ] Verify regions removed or improved
- [ ] Count roads (should be fewer)
- [ ] Check visual clarity

### After Priority 3 fixes:
- [ ] Measure generation time improvement
- [ ] Test progress indicator
- [ ] Verify viewport culling works during pan

---

## Recommended Implementation Order

### Phase 1: Critical Fixes (Do Tonight)
1. Verify embeddings exist (**15 min**)
2. Test current map generation (**15 min**)
3. Better cluster labels (**1-2 hours**)
4. Include item metadata (**30 min**)
5. Remove regions (**15 min**)

**Total: ~2.5-3 hours**
**Impact: Addresses all major "content wrong" and "visuals wrong" complaints**

### Phase 2: Performance (Tomorrow)
1. Optimize k-means (**1-2 hours**)
2. Optimize force-directed layout (**15 min**)
3. Add progress indicator (**1 hour**)
4. Fix viewport culling (**30 min**)

**Total: ~3-4 hours**
**Impact: Addresses "performance slow" complaint**

### Phase 3: Polish (Later)
1. Adjust road threshold (**15 min**)
2. Better cluster count logic (**15 min**)
3. Improve typography (**1 hour**)
4. Level-of-detail rendering (**2-3 hours**)

**Total: ~4-5 hours**
**Impact: Makes it truly "Google Maps-style"**

---

## Critical Questions to Answer

1. **Do embeddings exist for all items?**
   - Run SQL query to check counts
   - If low, need to process memories and backfill projects

2. **What does the current map actually look like?**
   - Generate a map with current code
   - Screenshot and review
   - Compare to user expectations

3. **How many roads are being created?**
   - If >50% of possible connections, too many
   - Need to adjust threshold

4. **What are the actual cluster labels?**
   - Check if they're meaningful or generic
   - Determines urgency of label fix

5. **How long does generation actually take?**
   - Measure with console.time()
   - Determines if performance optimization is critical

---

## Files That Need Changes

### Priority 1 (Critical):
- `api/lib/map-generation.ts:382-404` - Better label generation
- `api/lib/map-generation.ts:430-450` - Include item metadata in cities
- `MapCanvas.tsx:233-265` - Remove or fix regions

### Priority 2 (Performance):
- `api/lib/map-generation.ts:73-156` - Optimize k-means
- `api/lib/map-generation.ts:496` - Reduce iterations
- `KnowledgeMapPage.tsx:31-47` - Add progress states
- `MapCanvas.tsx:100-122` - Fix culling dependencies

### Priority 3 (Polish):
- `api/lib/map-generation.ts:495` - Adjust road threshold
- `api/lib/map-generation.ts:376` - Better cluster count
- `CityNode.tsx` - Typography improvements
- `MapCanvas.tsx:100-122` - LOD rendering

---

## Success Metrics

After fixes, the map should:
- ✅ Generate in <2 seconds (medium dataset)
- ✅ Show clusters with 2-3 word descriptive labels
- ✅ Have clear visual hierarchy (no overlapping regions)
- ✅ Display 20-40% of possible roads (not too dense)
- ✅ Open city details showing actual items
- ✅ Pan/zoom smoothly with culling working
- ✅ Look like a "territory map" with distinct areas
