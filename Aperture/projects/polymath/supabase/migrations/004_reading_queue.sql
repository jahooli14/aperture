-- Migration: Add Reading Queue and Highlights Tables
-- Description: Implements read-later functionality to replace Readwise Reader
-- Created: 2025-10-26

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Reading Queue Table
-- Stores saved articles for read-later functionality
CREATE TABLE IF NOT EXISTS reading_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- Article metadata
  url TEXT NOT NULL,
  title TEXT,
  author TEXT,
  content TEXT, -- Cleaned HTML or markdown
  excerpt TEXT, -- Short preview (first 200 chars)
  published_date TIMESTAMP,
  read_time_minutes INTEGER, -- Estimated read time
  thumbnail_url TEXT,
  favicon_url TEXT,
  source TEXT, -- Domain name (e.g., "medium.com")

  -- Status tracking
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'reading', 'archived')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  archived_at TIMESTAMP,

  -- Metadata
  tags TEXT[], -- User-added tags
  word_count INTEGER, -- Actual word count from content

  -- Constraints
  UNIQUE(user_id, url) -- Prevent duplicate saves
);

-- Article Highlights Table
-- Stores text highlights from articles with optional notes
CREATE TABLE IF NOT EXISTS article_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES reading_queue(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES memories(id) ON DELETE SET NULL, -- Links to memory if converted

  -- Highlight data
  highlight_text TEXT NOT NULL,
  start_position INTEGER, -- Character offset in content
  end_position INTEGER,   -- Character offset in content

  -- User notes
  notes TEXT,
  color TEXT DEFAULT 'yellow', -- Highlight color (yellow, blue, green, red)

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reading_queue_user_id ON reading_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_queue_status ON reading_queue(status);
CREATE INDEX IF NOT EXISTS idx_reading_queue_created_at ON reading_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_queue_url ON reading_queue(url);
CREATE INDEX IF NOT EXISTS idx_article_highlights_article_id ON article_highlights(article_id);
CREATE INDEX IF NOT EXISTS idx_article_highlights_memory_id ON article_highlights(memory_id);

-- Enable Row Level Security (RLS)
ALTER TABLE reading_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reading_queue
-- Note: For single-user app, we'll use service key in API endpoints to bypass RLS
-- But adding policies for future multi-user support

-- Policy: Users can view their own articles
CREATE POLICY "Users can view own articles"
  ON reading_queue
  FOR SELECT
  USING (true); -- Open for now since single-user

-- Policy: Users can insert their own articles
CREATE POLICY "Users can insert own articles"
  ON reading_queue
  FOR INSERT
  WITH CHECK (true); -- Open for now since single-user

-- Policy: Users can update their own articles
CREATE POLICY "Users can update own articles"
  ON reading_queue
  FOR UPDATE
  USING (true); -- Open for now since single-user

-- Policy: Users can delete their own articles
CREATE POLICY "Users can delete own articles"
  ON reading_queue
  FOR DELETE
  USING (true); -- Open for now since single-user

-- RLS Policies for article_highlights

-- Policy: Users can view highlights on their articles
CREATE POLICY "Users can view highlights on own articles"
  ON article_highlights
  FOR SELECT
  USING (true); -- Open for now since single-user

-- Policy: Users can insert highlights on their articles
CREATE POLICY "Users can insert highlights on own articles"
  ON article_highlights
  FOR INSERT
  WITH CHECK (true); -- Open for now since single-user

-- Policy: Users can update their own highlights
CREATE POLICY "Users can update own highlights"
  ON article_highlights
  FOR UPDATE
  USING (true); -- Open for now since single-user

-- Policy: Users can delete their own highlights
CREATE POLICY "Users can delete own highlights"
  ON article_highlights
  FOR DELETE
  USING (true); -- Open for now since single-user

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on article_highlights
CREATE TRIGGER update_article_highlights_updated_at
  BEFORE UPDATE ON article_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE reading_queue IS 'Stores saved articles for read-later functionality';
COMMENT ON TABLE article_highlights IS 'Stores text highlights from articles with optional notes';
