---
name: ui-pass
description: Review or change Polymath UI by looking at real screenshots, not just code. Use for any UI change, "review the UI", or "does this page make sense".
---

# UI pass (Polymath)

Looking right is not enough. Look at the page, then judge it.

## 1. See it
- `cd projects/polymath && npm run shots -- /tmp/shots [page ...]`
- Pages: home, projects, project-big, project-quick, project-keep, thoughts, reading, lists, settings, search, you, made.
- Phone width (390px), dark, no login, made-up data from `scripts/screenshots/fixtures.cjs`.
- Read each PNG. Empty because the fixture is missing is not a bug: add a fixture. Empty for the wrong reason in real data is.
- Do the shots before AND after a UI change. Put both in the PR.

## 2. Ask, for every page
Does this content make sense here, for this person, at this moment?
- Each heading matches what is under it.
- Nothing empty, mislabelled or in the wrong place. Sections with nothing in them are hidden.
- One action per card. One quiet way out.
- Words are plain English (see CLAUDE.md "Plain English"). No jargon, no analyst voice.

## 3. Check the system, don't invent a new one
- Cards: `.glass-card` / `.glass-card-subtle`. One `.neon-button` per card.
- Type: body text Literata; Playfair only for titles 24px and up. Nothing under 11px. Quieter text uses `--brand-text-muted`, never opacity below 0.6.
- Four text styles: `.eyebrow` (11), 13, 15, `.type-lead` (16).
- Tap targets 44px. Content clears the floating + button and the nav.
- Aperture's look is fixed (neon glass, cyan). Do not restyle it. If a design plugin asks for "bold" or a new font, the tokens win.

## 4. Report
Per page: what is wrong, why it matters for this person, the fix. Fix the ones that are clear; list the ones that are a taste call.
