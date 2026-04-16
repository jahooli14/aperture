# Polymath Comprehensive Review

*February 2026 — Full codebase audit for reliability, performance, and UX polish*

---

## Executive Summary

Polymath has a solid architecture (offline-first Dexie + Supabase sync, optimistic updates, Zustand stores). But there are **overlapping data-fetching systems fighting each other**, a **pull-to-refresh hook that re-registers event listeners on every render**, and several **patterns that cause visible flickers**. The reading flow has the most friction. Below is every issue found, prioritized by impact.

---

## Critical Issues (Causes visible flicker/unreliability)

### 1. Pull-to-Refresh Effect Re-registers on Every State Change
**File:** `src/hooks/usePullToRefresh.ts:92`
**Problem:** The `useEffect` dependency array includes `[onRefresh, threshold, resistance, isRefreshing, pullDistance]`. Because `pullDistance` changes on every touchmove, the entire effect tears down and re-registers all three event listeners continuously during a drag. This causes:
- Janky pull-to-refresh gesture (listeners detach and reattach mid-drag)
- Potential missed touchend events
- Unnecessary garbage collection pressure on mobile

**Fix:** Remove `pullDistance` and `isRefreshing` from the dependency array. Use refs for values that the handlers need to read but shouldn't cause effect re-runs:
```typescript
// Use refs for values read inside handlers
const pullDistanceRef = useRef(0)
const isRefreshingRef = useRef(false)

// Only re-register when these stable values change
useEffect(() => { ... }, [onRefresh, threshold, resistance])
```

### 2. Dual Data-Fetching Systems Fight for Control
**Files:** `src/hooks/useReadingQueue.ts` + `src/stores/useReadingStore.ts`
**Problem:** There are TWO independent systems fetching reading data:
1. **React Query** (`useReadingQueue`) — fetches directly from Supabase
2. **Zustand store** (`useReadingStore.fetchArticles`) — fetches from `/api/reading` endpoint

Both write to the same Zustand store. `ReadingPage` calls **both** simultaneously. The React Query hook has a guard (`storeState.articles.length === 0`) but there's a race condition window where React Query overwrites fresher data from the Zustand store, causing articles to briefly flicker or reorder.

**Fix:** Pick ONE. The Zustand store's `fetchArticles` is more capable (handles pending articles, offline mode, caching). Remove `useReadingQueue` entirely, or reduce it to a background revalidation that never writes to the store directly.

### 3. Reading Page Makes 3+ Redundant Fetch Calls on Mount
**File:** `src/pages/ReadingPage.tsx:228-254`
**Problem:** On every navigation to ReadingPage:
1. `fetchArticles()` via the useEffect (line 240)
2. `useReadingQueue()` via React Query (line 64)
3. `fetchFeeds()` (line 241)
4. `autoSyncFeeds()` (line 244)
5. `DataSynchronizer.sync()` also runs on a 5-min interval from App.tsx

That's 3 separate article fetches racing. Combined with the query client invalidation (line 237), this creates a cascade:
- Zustand store sets `loading: true` → shows skeleton
- Dexie cache returns first → shows articles
- React Query returns → potentially overwrites with different order
- Zustand API fetch returns → overwrites again

Each state update triggers a re-render of the article list, causing visible flicker.

**Fix:** Single entry point. On mount: load from Dexie cache (instant), then background-revalidate from API (no loading state). React Query should be removed from this page.

### 4. `fetchArticles` Shows Loading Skeleton Even When Cache Exists
**File:** `src/stores/useReadingStore.ts:86`
**Problem:** `set({ loading: true, error: null })` is called immediately, even before checking the Dexie cache. This causes a brief flash of the skeleton loader before the cached data appears.

**Fix:** Only set `loading: true` if Dexie cache is empty:
```typescript
// Check cache BEFORE setting loading
const cachedArticles = await readingDb.articles.toArray()
if (cachedArticles.length === 0) {
  set({ loading: true, error: null })
}
```

### 5. `useMemoryStore.fetchMemories` Has Same Loading Flash
**File:** `src/stores/useMemoryStore.ts:54`
**Problem:** Same pattern — sets `loading: true` before checking if offline cache has data. On every poll cycle, this causes a brief loading flash even when data hasn't changed.

**Fix:** Same approach. Check cache first, only show loading if we have zero data.

---

## High-Impact Issues (Causes subtle UX problems)

### 6. DataSynchronizer Runs 6 Parallel API Calls Every 5 Minutes
**File:** `src/lib/sync/DataSynchronizer.ts:67-74`
**Problem:** Every 5 minutes, fires: syncProjects, syncMemories, syncReadingList, syncLists, syncConnections, syncDashboard. `syncDashboard` alone fires 5 more fetches (inspiration, evolution, patterns, bedtime, RSS). That's **11 API calls every 5 minutes** even when the user hasn't done anything.

The `syncReadingList` also sequentially downloads content for every uncached article (line 123-125), which can be slow and block the main thread.

**Improvement:**
- Only sync the **currently visible section** (if on Reading page, sync reading; if on Home, sync dashboard)
- Use `requestIdleCallback` for non-critical syncs (dashboard, connections)
- Move article content download to a web worker

### 7. App Startup Fires Too Many Simultaneous Requests
**File:** `src/App.tsx:130-172`
**Problem:** On startup, the app simultaneously:
1. `dataSynchronizer.sync()` (11 API calls)
2. `setupAutoSync()` which calls `syncPendingOperations()`
3. Each page also fetches its own data on mount

This creates a thundering herd on app open, especially on mobile where bandwidth is limited.

**Fix:** Stagger startup syncs. Immediate: sync the current route's data only. After 3 seconds: sync everything else.

### 8. PullToRefresh CSS Transition Conflicts With Touch Transform
**File:** `src/components/PullToRefresh.tsx:137-144`
**Problem:** The content div has `className="transition-transform duration-200"` applied always. During an active pull gesture, the CSS transition fights with the JavaScript-driven transform, creating a laggy/elastic feel instead of a smooth 1:1 tracking.

**Fix:** Only apply the CSS transition when snapping back (not during active pull):
```typescript
className={cn(
  isRefreshing || (!isPulling && pullDistance === 0) ? 'transition-transform duration-200' : ''
)}
```

### 9. ReadingPage Article List Uses CSS Columns Instead of Virtualization
**File:** `src/pages/ReadingPage.tsx:889`
**Problem:** The page imports `Virtuoso` but doesn't use it. Instead, it renders articles with CSS `columns-2` layout. For large reading lists (50+ articles), this means:
- All articles rendered in DOM simultaneously
- No scroll virtualization
- Slow initial paint on mobile

Note: `Virtuoso` is imported but unused (line 8).

**Fix:** Either use Virtuoso for the article list, or at minimum add pagination/infinite scroll. The CSS columns layout is fine for <20 articles but doesn't scale.

### 10. HomePage Makes 7+ API Calls on Mount Without Staggering
**File:** `src/pages/HomePage.tsx:617-637`
**Problem:** On mount, simultaneously fires: fetchProjects, fetchSuggestions, fetchMemories, fetchCardOfTheDay, fetchPrompts. Plus the GetInspirationSection fires its own fetch, and InsightsSection fires another. And DataSynchronizer is already running.

**Fix:** Load from Dexie cache immediately (already partially done). Stagger the API revalidations using `setTimeout` or `requestIdleCallback`.

### 11. `location.key` Dependency Causes Refetch on Every Navigation
**File:** `src/pages/ReadingPage.tsx:254`
**Problem:** `useEffect(..., [location.key])` fires on **every** navigation event (including back/forward), triggering a full re-fetch cycle each time. Combined with the React Query invalidation on line 237, this means navigating to an article and pressing back causes a full reload flash.

**Fix:** Use a ref to track if articles are already loaded. On back navigation, just show cached data without triggering loading state.

---

## Medium Issues (Code quality / maintainability)

### 12. Massive Code Duplication in Share Target Handling
**Files:** `src/pages/ReadingPage.tsx:316-437` and `src/pages/ReadingPage.tsx:441-538`
**Problem:** The share URL handling effect and the PWA share custom event handler are near-identical — ~200 lines duplicated. Both process shared URLs, call `articleProcessor.startProcessing`, handle status callbacks, and show toasts.

**Fix:** Extract to a shared `handleSharedUrl(url: string)` function.

### 13. `ReadingPage` is 1065 Lines
**Problem:** Single component handles: tab switching, article filtering, RSS feeds, bulk selection, share target processing, article recovery, pull-to-refresh, save dialog, processing indicators, and connection suggestions.

**Fix:** Extract into focused components:
- `ArticleListView` — renders filtered articles
- `RSSUpdatesTab` — RSS-specific logic
- `ShareTargetHandler` — share processing (can be an effect-only hook)
- `ArticleRecoveryManager` — auto-recovery logic

### 14. Two Separate Dexie Databases for Offline
**Files:** `src/lib/db.ts` (RosetteDB) and `src/lib/offlineQueue.ts` (OfflineQueue)
**Problem:** Two separate IndexedDB databases. The service worker opens a THIRD (`aperture-offline`). This means:
- Three separate IndexedDB connections
- Service worker sync uses raw IndexedDB while app uses Dexie
- No shared state between SW sync and app sync

**Fix:** Consolidate to a single Dexie database. Add the `operations` table to `RosetteDatabase`.

### 15. Service Worker Background Sync Tag is Correct (Previously Reported as Bug)
**Files:** `src/sw.ts:215` and `src/hooks/useOfflineSync.ts:101`
**Problem:** Both use `sync-captures`. The MEMORY.md says there's a mismatch (`sync-voice-notes` vs `sync-captures`), but reviewing the actual code, **both now use `sync-captures`**. This may have been fixed previously. However:
- The SW uses raw IndexedDB (`aperture-offline` database)
- The app uses Dexie (`RosetteDB` database)
- They're writing to/reading from different databases

So background sync still won't work because the SW looks in `aperture-offline.pending-notes` but the app writes to `RosetteDB.pendingCaptures`.

**Fix:** Either have the SW use the same Dexie database, or bridge the two by writing to both.

### 16. Console Logging is Excessive
**Problem:** Nearly every function logs detailed debug info. The share target handler alone has 20+ `console.log` calls. In production, this:
- Clutters the console
- Slightly impacts performance (string interpolation)
- Leaks implementation details

**Fix:** Use the existing `src/lib/logger.ts` with log levels. Strip debug logs in production builds via Vite config.

---

## Low-Impact / Polish Issues

### 17. `any` Types Used in Multiple Stores
**Files:** `useMemoryStore.ts:113`, `useReadingStore.ts:144`, `useProjectStore.ts` (likely), `db.ts:131`
**Problem:** Several `as any` casts, especially for pending operations and Dexie types.

### 18. HomePage Dialog Trigger Uses Hidden DOM Hack
**File:** `src/pages/HomePage.tsx:1170-1177`
**Problem:** Create thought/project dialogs are triggered by rendering hidden buttons and programmatically clicking them via refs. This is fragile.

**Fix:** Give the dialogs an `open` prop and control them directly via state.

### 19. PullToRefresh Hardcodes Colors for Light Theme
**File:** `src/components/PullToRefresh.tsx:85-88`
**Problem:** Arrow icon uses `bg-white`, `text-gray-400`, `text-blue-600`. In a dark app, white backgrounds on pull-to-refresh indicators look intentional but don't match the rest of the premium dark theme.

### 20. VoiceFAB onTap Returns False for No Reason
**File:** `src/components/FloatingNav.tsx:117`
**Problem:** `handleVoiceFABTap` always returns `false`. The comment says "bypassing project-specific interception" but this is dead logic.

---

## Recommended Fix Priority

### Phase 1 — Instant Feel (eliminates flicker)
1. Fix `fetchArticles` to not set `loading: true` when Dexie cache exists (#4)
2. Fix `fetchMemories` same pattern (#5)
3. Remove `useReadingQueue` React Query hook — let Zustand store be the single source (#2)
4. Stop `ReadingPage` from invalidating + refetching on every navigation (#11, #3)

### Phase 2 — Smooth Interactions
5. Fix `usePullToRefresh` effect dependencies (#1)
6. Fix PullToRefresh CSS transition during active pull (#8)
7. Fix background sync database mismatch (#15)
8. Stagger startup API calls (#7)

### Phase 3 — Performance
9. Reduce DataSynchronizer to context-aware syncing (#6)
10. Add virtualization or pagination for large article lists (#9)
11. Consolidate the three IndexedDB databases (#14)

### Phase 4 — Code Quality
12. Extract ReadingPage into focused components (#13)
13. Deduplicate share target handling (#12)
14. Replace `any` types (#17)
15. Fix console logging (#16)
