-- Create debug_logs table for runtime debugging
CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  function_name TEXT NOT NULL,
  level TEXT NOT NULL, -- 'info', 'error', 'warn'
  message TEXT NOT NULL,
  data JSONB,
  photo_id TEXT,
  user_id TEXT
);

-- Index for fast querying
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_function ON debug_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_debug_logs_photo_id ON debug_logs(photo_id);

-- Enable RLS (but allow all for now since it's debug data)
ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for serverless functions)
CREATE POLICY "Allow all inserts" ON debug_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Anyone can read (for debugging)
CREATE POLICY "Allow all reads" ON debug_logs
  FOR SELECT
  TO public
  USING (true);

-- Auto-delete logs older than 7 days (keep storage clean)
-- Note: Set up a cron job or edge function to run this periodically
CREATE OR REPLACE FUNCTION delete_old_debug_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM debug_logs WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
