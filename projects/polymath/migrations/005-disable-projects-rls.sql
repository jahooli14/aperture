-- Disable RLS on projects table (single-user app)
-- No need for row-level security when there's only one user

ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Drop existing policies (clean up)
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- Verify RLS is disabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'projects';
