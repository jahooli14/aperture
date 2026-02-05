# Analogue

Mobile manuscript editing IDE. Active development. React 19, Vite, Tailwind v4, Supabase, Dexie.

## Key Context
- Primary purpose: Dan is using this to write his book
- Mobile-first design — all UI must work well on phone screens
- Offline support via Dexie (IndexedDB)
- DOCX import/export via Mammoth
- Lightweight and focused — resist feature creep

## Before You Push
```bash
npm run build    # TypeScript + Vite build
npm run lint     # ESLint check
```

## Don't Do This
- Don't add heavy dependencies — this should stay lightweight
- Don't break mobile layout — always test in responsive mode
- Don't add features that distract from the core writing/editing flow
- Desktop is secondary to mobile for this app

## Design Principles
- Writing experience is king — minimize UI chrome
- Text area should use full available vertical space
- Offline first — edits save locally, sync when online
- DOCX compatibility matters for export workflow
