-- Allow bidirectional share partners to re-align each other's photos.
--
-- Problem: the photos UPDATE policy restricted writes to `auth.uid() = user_id`,
-- but the SELECT policy allows viewing shared partners' photos. So a shared
-- user could open the adjust UI on their partner's photo and drag/pinch
-- perfectly — and then the UPDATE silently affected 0 rows (RLS no match),
-- Supabase returned { error: null, data: [] }, and the save appeared to
-- succeed while nothing changed.
--
-- Also: re-align uploads the new JPEG to the *editing* user's storage folder
-- (storage INSERT policy only allows own-folder writes). So if the shared
-- user edits the owner's photo, the new file lives under the shared user's
-- prefix. The OWNER must still be able to read it to view their own photo,
-- which means storage SELECT has to look across shared folders too.

-- ----------------------------------------------------------------------
-- 1. PHOTOS — allow UPDATE on own-or-shared photos.
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own photos" ON photos;
CREATE POLICY "Users can update their own and shared photos"
  ON photos FOR UPDATE
  USING (
    auth.uid() = user_id -- own photo
    OR
    -- I am the Shared User, updating the Owner's photo
    EXISTS (
      SELECT 1 FROM user_shares
      WHERE owner_user_id = photos.user_id
      AND shared_user_id = auth.uid()
    )
    OR
    -- I am the Owner, updating a photo uploaded by a Shared User
    EXISTS (
      SELECT 1 FROM user_shares
      WHERE owner_user_id = auth.uid()
      AND shared_user_id = photos.user_id
    )
  );

COMMENT ON POLICY "Users can update their own and shared photos" ON photos IS
  'Symmetric with SELECT: share partners can update each other''s photos (e.g. re-align, edit note).';

-- ----------------------------------------------------------------------
-- 2. STORAGE (originals bucket) — SELECT needs to span shared folders so
--    share partners can read re-aligned files that live in each other's
--    storage prefix. INSERT stays own-folder-only (simpler to reason about
--    and no one needs to write into someone else's folder directly — the
--    re-align flow uploads to its own folder and updates the photos row
--    to point at that path).
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own and shared files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'originals'
  AND auth.role() = 'authenticated'
  AND (
    -- Own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Folder owned by someone who shared with me (Owner -> me)
    (storage.foldername(name))[1] IN (
      SELECT owner_user_id::text FROM user_shares
      WHERE shared_user_id = auth.uid()
    )
    OR
    -- Folder owned by someone I share with (me -> Shared User)
    (storage.foldername(name))[1] IN (
      SELECT shared_user_id::text FROM user_shares
      WHERE owner_user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "Users can read own and shared files" ON storage.objects IS
  'Share partners can read each other''s uploaded originals (needed so re-aligned files produced by one partner are viewable by the other).';
