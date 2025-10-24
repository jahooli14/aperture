# SQL Migrations - Polymath

> **Purpose**: Track database schema changes and migration sequence
>
> **Last Updated**: 2025-10-24

---

## Migration Files

All migration SQL files are located in `/Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath/`

### Base Schema
**File**: `migration.sql`
**Applied**: Initial deployment
**Description**: Core tables for Polymath - memories, projects, capabilities, suggestions

### Enhancement Migrations
**File**: `migration-enhancements.sql`
**Applied**: Not yet applied
**Description**:
- Context windows (time-based memory clustering)
- Memory collision detection
- Memory tombstones (soft delete)
- Capability freshness tracking
- Refresh recipes
- User daily context
- Project-memory dependencies
- Synthesis constraints

### Daily Queue Migration
**File**: `migration-daily-queue.sql`
**Applied**: Not yet applied
**Description**: Daily actionable queue system for project prioritization

### Memory Onboarding Migration
**File**: `migration-memory-onboarding.sql`
**Applied**: Not yet applied
**Description**: Memory onboarding flow and prompts system

### Fixes
**File**: `fix-rls-public.sql`
**Applied**: As needed
**Description**: Row-level security fixes for public access

---

## Scripts Directory

Additional migration utilities in `scripts/`:

- `update-project-types.sql` - Updates project type enums
- `seed-memory-prompts.sql` - Seeds default memory prompt templates

---

## Migration Sequence

**Recommended order for applying migrations**:

1. ✅ `migration.sql` - Base schema (already applied)
2. ⏳ `migration-enhancements.sql` - Core enhancements
3. ⏳ `migration-daily-queue.sql` - Daily queue feature
4. ⏳ `migration-memory-onboarding.sql` - Onboarding flow
5. 🔧 `fix-rls-public.sql` - Apply if RLS issues occur

---

## How to Apply Migrations

### Via Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of migration file
4. Run query
5. Verify no errors
6. Update this document with applied status

### Via Command Line

```bash
# Set your Supabase connection string
psql $SUPABASE_URL -f migration-enhancements.sql
```

---

## Migration Status Tracking

| Migration | Status | Date Applied | Applied By |
|-----------|--------|--------------|------------|
| migration.sql | ✅ Applied | 2025-10-21 | Initial deployment |
| migration-enhancements.sql | ⏳ Pending | - | - |
| migration-daily-queue.sql | ⏳ Pending | - | - |
| migration-memory-onboarding.sql | ⏳ Pending | - | - |
| fix-rls-public.sql | 🔧 As needed | - | - |

---

## Notes

- **Always backup** before running migrations in production
- **Test locally** first if possible
- **Run migrations sequentially** - don't skip steps
- Update this document when migrations are applied
- Keep migration files for rollback reference

---

**Next Steps**: See `NEXT_SESSION.md` for implementation priorities
