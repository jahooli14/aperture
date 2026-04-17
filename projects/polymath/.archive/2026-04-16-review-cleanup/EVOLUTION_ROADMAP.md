# 🚀 Polymath Evolution Roadmap: The Digital Pharmacopoeia

This roadmap outlines the transition of Polymath from a "Smart Notebook" to a "Cybernetic Extension" that actively shapes the user's cognition.

## 🛡 Phase 1: The Reaper (Psychic Debt Management)
*Goal: Reduce cognitive load by actively managing dormant projects.*

- [ ] **Backend Logic:** Implement `checkProjectHealth` to identify projects inactive for > 45 days.
- [ ] **AI Generation:** Create `generateEulogy` prompt. It should honor the original intent but gently suggest letting go.
- [ ] **Data Layer:** Add `graveyard` status to Project types.
- [ ] **UI - The Graveyard:** A dedicated section in Projects view for "Buried" ideas (distinct from Archive).
- [ ] **UI - The Ceremony:** A modal that presents a rotting project and asks: "Resurrect (5min task) or Bury?"

## 🧬 Phase 2: Living Capabilities (The RPG of Self)
*Goal: Create a feedback loop for personal growth and skill maintenance.*

- [ ] **Database:** Add `last_decay_update`, `current_level` (1-10), and `integrity` (0-100%) to Capabilities.
- [ ] **Maintenance Script:** Update daily cron to lower integrity of unused capabilities.
- [ ] **Extraction Script:** Boost level/integrity when a capability is detected in new thoughts/projects.
- [ ] **UI - Visual Feedback:**
    - High Integrity: Glowing/Gold border.
    - Low Integrity: Rusted/Faded opacity.
    - Critical: Cracked texture (CSS).

## 🌀 Phase 3: Context-Aware Drift (Daytime Injection)
*Goal: Utilize the "Steel Ball" mechanic to break midday cognitive rigidity.*

- [ ] **Refactor:** Generalize `DriftMode.tsx` to support `mode="focus_break"`.
- [ ] **Prompt Engineering:** Add "Logic Breaker" and "Oblique Strategy" prompts for the daytime context (distinct from Hypnagogic prompts).
- [ ] **UI:** Add "Break / Reset" button to the Home Page Focus Stream.

## 🧠 Phase 4: Socratic Capture (Active Interrogation)
*Goal: Deepen thoughts at the point of capture.*

- [ ] **New Component:** `DeepReflectDialog`.
- [ ] **AI Logic:** "The Interrogator" - listens to input and generates a challenge question instead of saving immediately.
- [ ] **Flow:** Input -> AI Question -> User Elaboration -> Synthesis -> Save.

## 🗺 Phase 5: The Topological Home (The Map)
*Goal: Replace linear lists with organic landscape navigation.*

- [ ] **Tech Spike:** Investigate 2D Voronoi / Force-Directed graph libraries optimized for mobile (D3-geo-voronoi?).
- [ ] **Prototype:** Create a "Map View" toggle on Home.
- [ ] **Feature:** "Heatmap" rendering based on recent activity.
- [ ] **Feature:** "Structural Hole" visualization (empty spaces between clusters).
