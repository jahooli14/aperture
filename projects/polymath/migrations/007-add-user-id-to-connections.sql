-- Add user_id column to connections table
ALTER TABLE connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);

-- Enable RLS if not already
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own connections
CREATE POLICY "Users can view their own connections"
    ON connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
    ON connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
    ON connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
    ON connections FOR DELETE
    USING (auth.uid() = user_id);
