-- Migration: Make storage buckets private and enforce strict RLS policies
-- Run this in Supabase SQL Editor

-- ============================================
-- STORAGE BUCKET SECURITY
-- ============================================

-- NOTE: You must manually change bucket privacy settings in Supabase Dashboard:
-- 1. Go to Storage → originals bucket → Settings
-- 2. Change "Public bucket" to OFF (make it private)
-- 3. Repeat for 'aligned' bucket if it exists

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Policy: Users can only INSERT into their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'originals' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  auth.role() = 'authenticated'
);

-- Policy: Users can only SELECT their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'originals' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  auth.role() = 'authenticated'
);

-- Policy: Users can only UPDATE their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'originals' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  auth.role() = 'authenticated'
);

-- Policy: Users can only DELETE their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'originals' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  auth.role() = 'authenticated'
);

-- ============================================
-- DATABASE TABLE SECURITY ENHANCEMENTS
-- ============================================

-- Add additional check: Ensure upload_date is not in the future
ALTER TABLE photos
ADD CONSTRAINT upload_date_not_future
CHECK (upload_date <= CURRENT_DATE);

-- Add additional check: Ensure upload_date is not too old (5 years max)
ALTER TABLE photos
ADD CONSTRAINT upload_date_reasonable
CHECK (upload_date >= CURRENT_DATE - INTERVAL '5 years');

-- ============================================
-- INSTRUCTIONS
-- ============================================

-- After running this migration:
-- 1. Go to Supabase Dashboard → Storage
-- 2. For 'originals' bucket: Click settings → Disable "Public bucket"
-- 3. Update your application code to use signed URLs (see migration notes)
-- 4. Test photo upload and viewing functionality

COMMENT ON TABLE photos IS 'Baby photos - private storage with RLS enforcement. URLs must be signed for access.';
