# Changelog - Polymath

## 2025-10-22 - Milestone Tracker Extracted

### Changed
- **Developmental Milestone Tracker** has been extracted into its own standalone project: `projects/baby-milestone-tracker`
  - Can now be integrated with any memory/voice note system
  - Polymath can still use it via integration (see baby-milestone-tracker README)
  - All milestone-related files moved to new project
  - See `projects/baby-milestone-tracker/README.md` for documentation and integration examples

---

## 2025-01-21 - Mobile UX + Category Redesign

### Fixed
- **Mobile Dialog Layout**: Fixed submit buttons getting cut off on mobile devices
  - Restructured CreateMemoryDialog and CreateProjectDialog with sticky footers
  - Content area scrollable with `flex-1 overflow-y-auto`
  - Footer stays visible at bottom with `border-t bg-white`
  - Reduced dialog max-height to 85vh on mobile for better fit

### Changed
- **Synthesis Batch Size**: Reduced from 10 to 5 suggestions per batch for quality focus
- **Wildcard Frequency**: Adjusted from every 4th to every 3rd suggestion

### Improved
- **Project Categories** - Redesigned with consistent classification scale:
  - **Old**: `personal | technical | meta` (mixed scales)
  - **New**: `creative | technical | learning` (consistent domain-based)
    - 🎨 **Creative**: Art, design, hobbies, personal projects
    - ⚙️ **Technical**: Code, build, make, engineering
    - 📚 **Learning**: Study, courses, research, skill development

- **Project Statuses** - Better lifecycle representation:
  - **Old**: `active | dormant | completed | archived`
  - **New**: `active | on-hold | maintaining | completed | archived`
    - 🚀 **Active**: Currently working on
    - ⏸️ **On Hold**: Paused temporarily (replaced "dormant")
    - 🔧 **Maintaining**: Built and needs occasional love (new status)
    - ✅ **Completed**: Finished
    - 📦 **Archived**: Stored away

### Database
- Created migration script: `scripts/update-project-types.sql`
- Updated `migration.sql` with new type constraints
- Database changes preserve existing 'technical' type, migrate 'personal' → 'creative', 'meta' → 'learning'

### Files Modified
- `src/types.ts`, `types.ts` - Core type definitions
- `migration.sql` - Database schema
- `lib/synthesis.ts` - Batch size configuration
- `api/suggestions/[id]/build.ts` - Default project type logic
- All dialog components (Create/Edit Project, Build Project, Create Memory)
- All store files (useProjectStore, useSuggestionStore)

### Deployment
- Production: https://polymath-hn3yc6lsf-daniels-projects-ca7c7923.vercel.app
