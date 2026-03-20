-- Add checklist_items JSONB column to memories table
ALTER TABLE memories ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT NULL;
