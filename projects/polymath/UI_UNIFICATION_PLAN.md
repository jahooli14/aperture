# Plan: Unified "Projects-First" UI Architecture (Finalized)

**Goal:** Unify UI aesthetics (Glass Masonry), optimize interactions (Single Dot + 3-Dot), and refine specific feature sets for Thoughts and Articles.

---

## 1. Core Component Architecture
*Shared elements to ensure consistency.*

1.  **`SmartActionDot`:**
    *   The "Single Dot" for AI Analysis/Context.
    *   Pulsing animation for "active" or "suggestion ready" states.
2.  **`GlassCard` Wrapper:**
    *   The base container for all cards.
    *   Props for `variant`: `'vibrant'` (Projects) vs `'muted'` (Thoughts/Articles).
    *   Handles the `backdrop-filter` and hover effects consistently.

## 2. Articles (Reading) Refinement
*Target State:* Clean masonry card + Frictionless reading experience.

### Card View (`ArticleCard`):
*   **Keep:** Pin icon, Offline icon (blue/amber), Title, Source URL, Description/Excerpt, Photo, Reading Time, Date.
*   **Add:**
    *   **Reading Progress Bar:** Thin bar at the bottom or subtle indicator of % read.
    *   **3-Dot Menu:** For Archive/Delete actions.
    *   **Single Dot:** For AI Analysis/Suggestions.
*   **Style:** Muted glass variant.

### Reader View (`ReaderPage`):
*   **Selection Menu Fix:**
    *   *Problem:* Native browser selection menu conflicts with our custom highlight menu.
    *   *Solution:* Add a persistent **"Highlighter Mode" toggle** in the bottom toolbar (next to voice note).
    *   *Interaction:*
        *   Default: Text selection does native browser behavior (Copy/Search).
        *   Highlighter Mode (Active): Selecting text *immediately* triggers our custom menu or applies a default highlight color, suppressing the native menu if possible (using `user-select` or event capture). Alternatively, move the interaction to a "Select then Tap Highlight Button" flow to avoid the conflict entirely. *Decision: "Select then Tap" floating button that appears cleanly.*

## 3. Thoughts (Memories) Refinement
*Target State:* De-cluttered, performant masonry.

### Card View (`MemoryCard`):
*   **Header:** Title + 3-Dot Menu.
*   **Body:** Truncated text (max 3-4 lines).
*   **Footer:** Date (left) + Single Dot (right).
*   **Hidden (Collapsed):** Tags, Connections, "Fueling..." text, "Nodes extracted..." text.
*   **Interaction:** Tap opens a **Detail Modal** to view full note and connections.
*   **Style:** Muted glass variant.

## 4. Projects Refinement
*Target State:* Status quo (it's the gold standard).

### Card View (`ProjectCard`):
*   **Keep:** Single Dot, Next Step, Priority Marker, Title, Description, Task Progress Bar.
*   **Style:** Vibrant glass variant.

---

## Execution Order

1.  **Shared Components:** Build `SmartActionDot` and `GlassCard`.
2.  **Thoughts:** Refactor `MemoryCard` (stripped down) and `MemoriesPage` (masonry layout).
3.  **Articles List:** Refactor `ArticleCard` (add progress bar, dots) and `ReadingPage` (masonry layout).
4.  **Reader View:** Implement "Highlighter Mode" toggle to fix the selection menu conflict.
