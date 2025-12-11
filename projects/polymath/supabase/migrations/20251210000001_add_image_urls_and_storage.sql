-- Add image_urls to memories
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'image_urls') THEN
    ALTER TABLE "public"."memories" ADD COLUMN "image_urls" text[] DEFAULT NULL;
  END IF;
END $$;

-- Create storage bucket for thought images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('thought-images', 'thought-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for storage (drop first to avoid conflicts/duplicates)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- Re-create policies (targeted at specific bucket)
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'thought-images' );

CREATE POLICY "Authenticated Upload"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'thought-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated Delete"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'thought-images' AND auth.role() = 'authenticated' );
