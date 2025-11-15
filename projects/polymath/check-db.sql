-- Check what's actually in the database for Clandestined project
SELECT
  id,
  title,
  jsonb_array_length(metadata->'tasks') as task_count,
  metadata->'tasks' as tasks
FROM projects
WHERE title LIKE '%Clandestined%';
