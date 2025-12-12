---
description: Consolidate features and overhaul Settings UI
---

# Feature Consolidation & Settings Overhaul Plan

## Objective
Streamline the user experience by grouping "generative/creative" features into the Homepage ("Coalesce OS" feel) and "analytical/profile" features into an "Analytics" section, while reserving the Settings page purely for configuration. Additionally, overhaul the Settings page UI to match the premium dark/cyan theme.

## 1. Feature Reorganization

### A. Homepage: "Creative Suite" (The 'Explore' Section)
*Rename 'Explore' to 'Creative Suite' or keep 'Explore' but group these Tools:*
1.  **Serendipity Engine**: (Already present) - Keep.
2.  **Drift Mode**: (Already present) - Keep.
3.  **Bedtime Ideas**: (Already present) - Keep.
4.  **Discover Projects**: Move from Settings (or wherever it is) to here as a card. "Generate new project ideas".

### B. Homepage: "Your Mind" (New/Existing Section)
*Group analytical tools here (Rename 'Your Insights' or add adjacent section):*
1.  **Timeline**: (Currently in Explore) - Move to "Your Mind".
2.  **Galaxy View**: (Currently in Settings?) - Add entry point here.
3.  **Analysis / Capabilities**: Display "Your Capabilities" summary here (e.g. "Level 5 Explorer", "Top Skills: Python, React").
    *   Clicking opens a detailed 'Mind Profile' modal or page.

### C. Settings Page (Configuration Only)
*Remove feature entry points. Keep:*
1.  **Account**: Profile, Data Export.
2.  **Appearance**: Theme (Cyan/Reference), Font size.
3.  **Integrations**: RSS Feeds, Auto-Importer config.
4.  **System**: API Keys, Local Storage management.

## 2. Settings Page UI Overhaul
*Target Aesthetic: Premium Dark, Cyan Accents, Glassmorphism.*

**Changes:**
1.  **Background**: Use `SubtleBackground` or the premium gradient background used on Home.
2.  **Cards**: Replace standard white/gray cards with "Glass" cards (`backdrop-blur-xl`, `bg-black/40`, `border-white/10`).
3.  **Typography**: Use `premium-text-platinum` and Cyan headers.
4.  **Toggles/Inputs**: Style to match the new "Cyber/Glass" aesthetic (Cyan active state).

## 3. Implementation Steps

1.  **Homepage Refactor**:
    *   Create "Your Mind" section (move Timeline here).
    *   Add "Capabilities" card to "Your Mind".
    *   Update "Explore" section to "Creative Suite" (Drift, Serendipity, Bedtime).
    *   Add "Discover Projects" card to "Creative Suite".
2.  **Settings Page Refactor**:
    *   Strip out "Launch Galaxy View" or "View Capabilities" big buttons (move logic if needed).
    *   Apply new CSS classes and layout.
3.  **Routing/Navigation**:
    *   Ensure all moved features have valid routes/modals accessible from Home.

## 4. Verification
*   Check flow: Home -> Serendipity -> Home -> Settings -> Back.
*   Verify no dead links.
*   Verify visual consistency (Font, Colors, Spacing).