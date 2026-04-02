-- Repair migration: idempotently ensure all list schema additions are present.
-- Covers the 'article' enum value and the 'settings' JSONB column, both of
-- which may not have been applied to the production database.

-- Ensure 'article' list type exists (added 2026-03-20, may have been missed)
ALTER TYPE list_type ADD VALUE IF NOT EXISTS 'article';

-- Ensure 'settings' column exists (added 2026-03-21, may have been missed)
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
