# Implementation Plan: Reaching "Google Keep" Standards

**Goal:** Transform `rosette/polymath` into a "Local-First" application with instant capture, reliable offline usage, and seamless background synchronization, matching the UX of Google Keep.

**Reference:** Based on findings from `PWA Offline-First App Design.pdf` and codebase analysis.

---

## Phase 0: Critical Fixes (Immediate Action)
*The current background sync implementation is broken due to mismatched event tags.*

### 1. Fix Background Sync Tags
- **Problem:** `sw.js` listens for `'sync-voice-notes'` but `useOfflineSync.ts` registers `'sync-captures'`.
- **Action:**
    - Update `projects/polymath/public/sw.js` to listen for `'sync-captures'`.
    - Ensure the handler processes the `pendingCaptures` table from Dexie.

### 2. Verify Service Worker Registration
- **Problem:** Service workers can be flaky during development.
- **Action:** Add robust logging to `sw.js` to confirm it is waking up for sync events.

---

## Phase 1: Robust Offline Foundation (Data Confidence)
*Currently, data is only cached when a user manually navigates to a page (cache-on-read). We need cache-on-schedule.*

### 1. Implement Two-Way Sync Strategy
- **Concept:** Unlike Google Keep, we currently don't pull updates in the background.
- **Action:** Create `src/lib/sync/SyncManager.ts`:
    - **Pull:** Periodically (or on online event) fetch the latest `projects`, `memories`, and `reading` list changes.
    - **Merge:** Update Dexie `RosetteDatabase` silently.
    - **Notify:** Use `BroadcastChannel` or store subscriptions to update the UI if open.
    - **Trigger:** Call this manager from `sw.js` (periodic sync) and `useOfflineSync.ts` (on connect).

### 2. Automated Article Caching ("Read-It-Later" Reliability)
- **Problem:** Articles are only cached if the user explicitly opens them or clicks a specific button? (Need to verify). The goal is "Read Later" = "Downloaded".
- **Action:**
    - Hook into the "Save to Read Later" action.
    - Trigger a background download of the article content (images + text).
    - Store in Dexie `articles` table.
    - **Visual Feedback:** Add a "Downloaded" icon (green check) to the list view.

### 3. Visual Reliability Indicators
- **Action:** Add a global `SyncStatusIndicator` component (e.g., in the Floating Nav or Header):
    - 🟢 (Synced)
    - 🟡 (Syncing...)
    - 🔴 (Offline / Changes Pending)

---

## Phase 2: Hybrid Parsing Pipeline (Solving "Pitchfork")
*Client-side parsing fails on SPA sites like Pitchfork. We need a server-side fallback.*

### 1. Server-Side Parsing Proxy
- **Action:** Create a new Vercel function `api/parse.ts`.
- **Logic:**
    - Receive URL.
    - **Attempt 1:** Standard `fetch` + `cheerio` (fast, cheap).
    - **Attempt 2 (Fallback):** If `cheerio` fails (empty body/JS required), use a headless browser solution (Note: Puppeteer on Vercel requires strict size limits/layers, or use an external API like Browserless or specific scraping APIs). *For now, implement robust Cheerio + Mozilla Readability.*
    - Return sanitized HTML/Markdown + Metadata.

### 2. Client-Side Integration
- **Action:** Update `useArticle.ts` / `articleProcessor.ts`:
    - **Step 1:** Try local parsing (existing logic).
    - **Step 2:** If local parse is "thin" (word count < 100) or fails, call `api/parse`.
    - **Step 3:** Save result to Dexie.

---

## Phase 3: "Instant" Performance (App Shell & Optimistic UI)
*Reduce perceived latency to <100ms.*

### 1. App Shell Architecture
- **Action:** Ensure `index.html` and core JS bundles are aggressively cached by `sw.js`.
- **Test:** Use Chrome DevTools "Slow 3G" to verify the "Shell" (Header, Nav, Empty List) loads instantly.

### 2. Optimistic UI Updates
- **Action:** Review all `mutation` hooks (save note, delete project).
- **Standard:**
    1. Update React Query / Zustand store *immediately*.
    2. Fire network request.
    3. Rollback on error.

---

## Phase 4: Long-Term Native Evolution (The "Holy Grail")
*If PWA limits (storage quotas, background process killing) become blockers.*

### 1. Capacitor Wrapping
- Move to `ionic/capacitor` to get native filesystem access.
- Allows true background threads (WorkManager).

### 2. SQLite Migration
- Replace `Dexie` with `capacitor-sqlite` for consistent performance on large datasets.
