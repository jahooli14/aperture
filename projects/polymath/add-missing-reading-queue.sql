-- Add ONLY the missing reading_queue table and related tables
-- This is safe to run even if some tables already exist

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reading Queue Table
CREATE TABLE IF NOT EXISTS reading_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- Article metadata
  url TEXT NOT NULL,
  title TEXT,
  author TEXT,
  content TEXT,
  excerpt TEXT,
  published_date TIMESTAMP,
  read_time_minutes INTEGER,
  thumbnail_url TEXT,
  favicon_url TEXT,
  source TEXT,

  -- Status tracking
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'archived')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  archived_at TIMESTAMP,

  -- Metadata
  tags TEXT[],
  word_count INTEGER,

  -- Constraints
  UNIQUE(user_id, url)
);

-- Article Highlights Table
CREATE TABLE IF NOT EXISTS article_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES reading_queue(id) ON DELETE CASCADE,
  highlight_text TEXT NOT NULL,
  start_position INTEGER,
  end_position INTEGER,
  notes TEXT,
  color TEXT DEFAULT 'yellow',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RSS Feeds Table
CREATE TABLE IF NOT EXISTS rss_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  site_url TEXT,
  favicon_url TEXT,
  last_fetched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  error_message TEXT,
  article_count INTEGER DEFAULT 0
);

-- Connection Suggestions Table
CREATE TABLE IF NOT EXISTS connection_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('thought', 'project', 'article')),
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('thought', 'project', 'article')),
  target_id UUID NOT NULL,
  reasoning TEXT,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'dismissed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id)
);

-- Indexes (using IF NOT EXISTS to avoid errors)
CREATE INDEX IF NOT EXISTS idx_reading_queue_user_id ON reading_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_queue_status ON reading_queue(status);
CREATE INDEX IF NOT EXISTS idx_reading_queue_created_at ON reading_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_queue_url ON reading_queue(url);
CREATE INDEX IF NOT EXISTS idx_article_highlights_article_id ON article_highlights(article_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user_id ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_status ON rss_feeds(status);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_user_id ON connection_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_status ON connection_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_source ON connection_suggestions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_connection_suggestions_target ON connection_suggestions(target_type, target_id);

-- Enable Row Level Security
ALTER TABLE reading_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors)
DROP POLICY IF EXISTS "Users can view own articles" ON reading_queue;
DROP POLICY IF EXISTS "Users can insert own articles" ON reading_queue;
DROP POLICY IF EXISTS "Users can update own articles" ON reading_queue;
DROP POLICY IF EXISTS "Users can delete own articles" ON reading_queue;

DROP POLICY IF EXISTS "Users can view highlights on own articles" ON article_highlights;
DROP POLICY IF EXISTS "Users can insert highlights on own articles" ON article_highlights;
DROP POLICY IF EXISTS "Users can update own highlights" ON article_highlights;
DROP POLICY IF EXISTS "Users can delete own highlights" ON article_highlights;

DROP POLICY IF EXISTS "Users can view own feeds" ON rss_feeds;
DROP POLICY IF EXISTS "Users can manage own feeds" ON rss_feeds;

DROP POLICY IF EXISTS "Users can view own suggestions" ON connection_suggestions;
DROP POLICY IF EXISTS "Users can manage own suggestions" ON connection_suggestions;

-- Create RLS policies (open for single-user app)
CREATE POLICY "Users can view own articles" ON reading_queue FOR SELECT USING (true);
CREATE POLICY "Users can insert own articles" ON reading_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own articles" ON reading_queue FOR UPDATE USING (true);
CREATE POLICY "Users can delete own articles" ON reading_queue FOR DELETE USING (true);

CREATE POLICY "Users can view highlights on own articles" ON article_highlights FOR SELECT USING (true);
CREATE POLICY "Users can insert highlights on own articles" ON article_highlights FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own highlights" ON article_highlights FOR UPDATE USING (true);
CREATE POLICY "Users can delete own highlights" ON article_highlights FOR DELETE USING (true);

CREATE POLICY "Users can view own feeds" ON rss_feeds FOR SELECT USING (true);
CREATE POLICY "Users can manage own feeds" ON rss_feeds FOR ALL USING (true);

CREATE POLICY "Users can view own suggestions" ON connection_suggestions FOR SELECT USING (true);
CREATE POLICY "Users can manage own suggestions" ON connection_suggestions FOR ALL USING (true);

-- Function for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_article_highlights_updated_at ON article_highlights;
CREATE TRIGGER update_article_highlights_updated_at
  BEFORE UPDATE ON article_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_connection_suggestions_updated_at ON connection_suggestions;
CREATE TRIGGER update_connection_suggestions_updated_at
  BEFORE UPDATE ON connection_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE reading_queue IS 'Stores saved articles for read-later functionality';
COMMENT ON TABLE article_highlights IS 'Stores text highlights from articles with optional notes';
COMMENT ON TABLE rss_feeds IS 'RSS feed subscriptions';
COMMENT ON TABLE connection_suggestions IS 'AI-generated suggestions for connecting thoughts, projects, and articles';
