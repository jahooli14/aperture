-- Single freeform notes document per project (Capacities-style "Content" space).
-- Markdown text with inline image refs (images live in the thought-images bucket).
-- Replaces the old project_notes bullets table, which the UI never rendered.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'notes_doc'
  ) THEN
    ALTER TABLE "public"."projects" ADD COLUMN "notes_doc" text DEFAULT NULL;
  END IF;
END $$;
