# Aperture Implementation Plan: From Storage to Momentum

This plan outlines the core mission shift from a "dusty vault" (Polymath) to an "active project engine" (Aperture).

## 🔳 Phase 1: Zebra Branding (Visual Identity)
*Goal: High-contrast, premium, and bold aesthetic.*

- [ ] **CSS System**: Update `src/index.css` with new variables:
    - `--zebra-black`: #000000
    - `--zebra-white`: #FFFFFF
    - `--zebra-accent`: #FFD700 (or similar bold accent)
- [ ] **Typography**: Move to bold, high-contrast typography (Inter/Outfit).
- [ ] **Brand Overhaul**: Update `BrandName.tsx` and `Logo`.

## ⚡ Phase 2: The Power Hour (Project Propulsion)
*Goal: 60-minute high-impact sprints.*

- [ ] **Dashboard**: Create `PowerHourPage.tsx`.
    - AI-suggested tasks for the next 60 minutes.
    - "Quick Start" button: Hero action to launch immediately.
- [ ] **Action Engine**: logic to extract "Next Steps" from projects using Gemini 3 Flash.
- [ ] **80/20 Progress**: Redefine progress bars (100% = Concept Proved/Drafted).

## 🚀 Phase 3: Zero-Friction Triage
*Goal: Instant, intelligent capture.*

- [ ] **Unified Capture**: Update `VoiceFAB` to handle both quick thoughts and project updates.
- [ ] **Gemini Triage**: Update `api/memories.ts` to automatically categorize input:
    - `TASK_UPDATE`
    - `NEW_THOUGHT`
    - `READING_LEAD`
- [ ] **Shadow Work**: Background summarization of articles-to-action.

## 🧠 Phase 4: The Venn & Idea Prototyping
*Goal: Cross-pollination and synthesis.*

- [ ] **Venn Discovery**: Use vector embeddings to find intersections between projects and thoughts.
- [ ] **Idea Children**: Logic to generate brief summaries/mockups at intersections.

## 🎭 Phase 5: The 4th-Wall Narrator
*Goal: Personality and nudges.*

- [ ] **System Voice**: Implement "Quirky Narrator" commentary on productivity habits.
- [ ] **Zebra Report**: Automated "failing fast" summaries for archived projects.

---

## Technical Constraints
- **Engine**: Gemini 3 Flash.
- **UX**: PM-driven, mobile-first, minimal decision fatigue.
- **Goal**: Reach 80% with 20% effort.
