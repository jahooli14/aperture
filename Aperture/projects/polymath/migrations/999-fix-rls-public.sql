-- Allow public read access to memory prompts (they're templates, not sensitive)
DROP POLICY IF EXISTS "Anyone can view memory prompts" ON memory_prompts;

CREATE POLICY "Public can read memory prompts"
  ON memory_prompts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Verify the policy
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'memory_prompts';
