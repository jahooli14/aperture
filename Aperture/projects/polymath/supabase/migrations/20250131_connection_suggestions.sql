-- Create connection_suggestions table for AI-powered proactive linking
CREATE TABLE IF NOT EXISTS connection_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_item_type TEXT NOT NULL CHECK (from_item_type IN ('project', 'thought', 'article')),
  from_item_id UUID NOT NULL,
  to_item_type TEXT NOT NULL CHECK (to_item_type IN ('project', 'thought', 'article')),
  to_item_id UUID NOT NULL,
  reasoning TEXT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(from_item_id, to_item_id, user_id)
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_from ON connection_suggestions(from_item_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_to ON connection_suggestions(to_item_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_user ON connection_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_created ON connection_suggestions(created_at DESC);

-- Add RLS policies
ALTER TABLE connection_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
  ON connection_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
  ON connection_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON connection_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggestions"
  ON connection_suggestions FOR DELETE
  USING (auth.uid() = user_id);

-- Update item_connections table to track connection source
ALTER TABLE item_connections
ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'user_created' CHECK (connection_type IN ('user_created', 'ai_suggested')),
ADD COLUMN IF NOT EXISTS suggestion_id UUID REFERENCES connection_suggestions(id) ON DELETE SET NULL;

-- Create index for connection_type
CREATE INDEX IF NOT EXISTS idx_item_connections_type ON item_connections(connection_type);

-- Create a view for timeline events that includes connections
CREATE OR REPLACE VIEW timeline_events AS
SELECT
  'project_created' AS event_type,
  p.id AS event_id,
  p.created_at AS event_time,
  p.user_id,
  jsonb_build_object(
    'type', 'project',
    'id', p.id,
    'title', p.title,
    'description', p.description
  ) AS event_data
FROM projects p

UNION ALL

SELECT
  'thought_created' AS event_type,
  m.id AS event_id,
  m.created_at AS event_time,
  m.user_id,
  jsonb_build_object(
    'type', 'thought',
    'id', m.id,
    'title', m.title,
    'body', m.body
  ) AS event_data
FROM memories m

UNION ALL

SELECT
  'article_added' AS event_type,
  rq.id AS event_id,
  rq.created_at AS event_time,
  rq.user_id,
  jsonb_build_object(
    'type', 'article',
    'id', rq.id,
    'title', rq.title,
    'url', rq.url
  ) AS event_data
FROM reading_queue rq

UNION ALL

SELECT
  'connection_created' AS event_type,
  ic.id AS event_id,
  ic.created_at AS event_time,
  ic.user_id,
  jsonb_build_object(
    'type', 'connection',
    'id', ic.id,
    'from_item_type', ic.item_type,
    'from_item_id', ic.item_id,
    'to_item_type', ic.related_item_type,
    'to_item_id', ic.related_item_id,
    'connection_type', ic.connection_type,
    'reasoning', cs.reasoning
  ) AS event_data
FROM item_connections ic
LEFT JOIN connection_suggestions cs ON ic.suggestion_id = cs.id

ORDER BY event_time DESC;

COMMENT ON TABLE connection_suggestions IS 'AI-generated suggestions for connecting related content';
COMMENT ON VIEW timeline_events IS 'Unified view of all timeline events including connections';
