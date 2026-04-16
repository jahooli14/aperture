# Plan: "Best-in-Class" Read-Later Experience

**Goal:** Transform `polymath` into a "Local-First, Richness-Preserving" consumption engine, matching the standards of GoodLinks and Obsidian as outlined in "Optimizing Read Later Preservation.pdf".

**Key Principle:** Shift from "collecting links" to "preserving reading experiences."

---

## 1. Richness Preservation (Parsing & Rendering)
*Currently: We rely on a server-side parser (Jina/Readability) that flattens the DOM into Markdown/HTML string. This is good for "clean," but loses richness (math, code blocks, semantic figures).*

### Action Items:
1.  **Stop Flattening (Server):** Update `api/reading.ts`. Instead of aggressively stripping everything to basic HTML strings, we need to preserve semantic HTML5 tags:
    *   `<figure>` & `<figcaption>` (Contextual images)
    *   `<pre><code>` (Syntax highlighted code)
    *   `<blockquote>` vs `<aside>` (Semantic quotes)
    *   MathJax/LaTeX support (if feasible, otherwise ensure raw text survives).
2.  **Enhanced Client Renderer (ReaderPage):**
    *   Update `ReaderPage.tsx` CSS/styling to render these elements beautifully (e.g., proper code block styling, distinct styles for blockquotes vs asides).
    *   Ensure `DOMPurify` config allows these tags.

## 2. True Offline Richness (The Image Problem)
*Currently: We have `OfflineContentManager` which downloads images. We need to verify it handles path remapping correctly and consistently.*

### Action Items:
1.  **Robust Path Remapping:** Verify `useOfflineArticle.ts` and `OfflineContentManager.ts`. The critical step is rewriting `src="https://remote.com/img.jpg"` to `src="blob:..."` *dynamically* at render time.
    *   *Check:* Does it handle `srcset`? Does it handle CSS background images (less critical but good)?
    *   *Refinement:* Ensure the "download" process is atomic. If 5 images fail, does the article status reflect "Partial"?
2.  **Lazy Load Handling:** The PDF notes that "lazy loading" scripts break standard scrapers.
    *   *Fix:* Our server-side parser (Jina/Puppeteer) usually handles this, but we should verify. If using simple `fetch`, we need a better solution. (Currently using Jina/Diffbot which is good).

## 3. Workflow: Triage vs. Archive (Anti-Hoarding)
*Currently: We have "Unread" and "Archived". This is basic.*

### Action Items:
1.  **The "Inbox" View:** Rename "Queue" to "Inbox" in the UI (`ReadingPage.tsx`) to psychologically frame it as "triage".
2.  **Ephemeral Storage (Automation):** Implement a "Rotting" mechanic (inspired by GoodLinks).
    *   *New Feature:* "Auto-Archive after 30 days of inactivity".
    *   *UI:* Visual indicator for "aging" articles (e.g., text fades or gets a 'cobweb' icon).
3.  **Reading Progress:** Ensure reading progress (scroll position) is saved locally and synced. This reduces friction to pick up where left off.

## 4. Housekeeping & Polish
1.  **Optimistic UI:** Ensure "Archive" and "Delete" are instant.
2.  **Clean View:** Remove *all* "Share", "Subscribe", and "Related Post" clutter from the parsed content (The PDF calls this "noise"). Our parser likely does this, but we should be aggressive.

---

## Execution Order

1.  **Refine Client Renderer:** Improve `ArticleCard` and `ReaderPage` to handle rich elements better and ensure images load instantly from cache.
2.  **Triage Workflow:** Rename tabs to "Inbox" / "Library" / "Archive". Add the "Auto-Archive" toggle in Settings.
3.  **Parser Tune-up:** Tweaks to `api/reading.ts` to preserve `<figure>` and `<code>`.
