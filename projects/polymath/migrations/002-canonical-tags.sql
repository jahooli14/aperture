-- Canonical Tags Migration
-- Adds semantic tag normalization with embeddings for consistent categorization

-- ============================================================================
-- TABLE: canonical_tags
-- Master list of normalized tags with embeddings for similarity matching
-- ============================================================================

CREATE TABLE IF NOT EXISTS canonical_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE,
  category TEXT, -- High-level bucket: Technology, Health, Business, Creative, Learning, etc.
  usage_count INTEGER DEFAULT 0, -- How many memories use this tag
  embedding VECTOR(768), -- Gemini text-embedding-004 for similarity matching
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_seed BOOLEAN DEFAULT false -- True for predefined tags, false for emergent tags
);

CREATE INDEX idx_canonical_tags_tag ON canonical_tags(tag);
CREATE INDEX idx_canonical_tags_category ON canonical_tags(category);
CREATE INDEX idx_canonical_tags_usage_count ON canonical_tags(usage_count DESC);
CREATE INDEX idx_canonical_tags_embedding ON canonical_tags USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE canonical_tags IS 'Master list of normalized tags with semantic similarity';
COMMENT ON COLUMN canonical_tags.usage_count IS 'Incremented when a memory uses this tag (for popularity tracking)';
COMMENT ON COLUMN canonical_tags.is_seed IS 'True for predefined seed tags, false for user-generated tags';

-- ============================================================================
-- TAG ALIASES TABLE
-- Track alternative spellings/variations that map to canonical tags
-- ============================================================================

CREATE TABLE IF NOT EXISTS tag_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL UNIQUE,
  canonical_tag_id UUID NOT NULL REFERENCES canonical_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_tag_aliases_alias ON tag_aliases(alias);
CREATE INDEX idx_tag_aliases_canonical_tag_id ON tag_aliases(canonical_tag_id);

COMMENT ON TABLE tag_aliases IS 'Alternative names that map to canonical tags (e.g., "ML" -> "machine learning")';

-- ============================================================================
-- SEED DATA: Common tags across domains
-- Starting with ~80 high-quality seed tags
-- ============================================================================

INSERT INTO canonical_tags (tag, category, is_seed, usage_count) VALUES
  -- Technology (20 tags)
  ('programming', 'Technology', true, 0),
  ('web development', 'Technology', true, 0),
  ('mobile development', 'Technology', true, 0),
  ('machine learning', 'Technology', true, 0),
  ('artificial intelligence', 'Technology', true, 0),
  ('data science', 'Technology', true, 0),
  ('cloud computing', 'Technology', true, 0),
  ('devops', 'Technology', true, 0),
  ('security', 'Technology', true, 0),
  ('databases', 'Technology', true, 0),
  ('api design', 'Technology', true, 0),
  ('frontend', 'Technology', true, 0),
  ('backend', 'Technology', true, 0),
  ('testing', 'Technology', true, 0),
  ('design systems', 'Technology', true, 0),
  ('performance optimization', 'Technology', true, 0),
  ('automation', 'Technology', true, 0),
  ('blockchain', 'Technology', true, 0),
  ('networking', 'Technology', true, 0),
  ('system architecture', 'Technology', true, 0),

  -- Health & Wellness (15 tags)
  ('fitness', 'Health', true, 0),
  ('nutrition', 'Health', true, 0),
  ('mental health', 'Health', true, 0),
  ('mindfulness', 'Health', true, 0),
  ('sleep', 'Health', true, 0),
  ('meditation', 'Health', true, 0),
  ('yoga', 'Health', true, 0),
  ('running', 'Health', true, 0),
  ('strength training', 'Health', true, 0),
  ('stretching', 'Health', true, 0),
  ('wellness', 'Health', true, 0),
  ('stress management', 'Health', true, 0),
  ('hydration', 'Health', true, 0),
  ('recovery', 'Health', true, 0),
  ('injury prevention', 'Health', true, 0),

  -- Business & Career (15 tags)
  ('entrepreneurship', 'Business', true, 0),
  ('productivity', 'Business', true, 0),
  ('leadership', 'Business', true, 0),
  ('marketing', 'Business', true, 0),
  ('sales', 'Business', true, 0),
  ('strategy', 'Business', true, 0),
  ('negotiation', 'Business', true, 0),
  ('networking', 'Business', true, 0),
  ('time management', 'Business', true, 0),
  ('project management', 'Business', true, 0),
  ('remote work', 'Business', true, 0),
  ('communication', 'Business', true, 0),
  ('public speaking', 'Business', true, 0),
  ('career development', 'Business', true, 0),
  ('freelancing', 'Business', true, 0),

  -- Creative (12 tags)
  ('writing', 'Creative', true, 0),
  ('music', 'Creative', true, 0),
  ('photography', 'Creative', true, 0),
  ('design', 'Creative', true, 0),
  ('art', 'Creative', true, 0),
  ('filmmaking', 'Creative', true, 0),
  ('drawing', 'Creative', true, 0),
  ('painting', 'Creative', true, 0),
  ('creativity', 'Creative', true, 0),
  ('storytelling', 'Creative', true, 0),
  ('crafts', 'Creative', true, 0),
  ('content creation', 'Creative', true, 0),

  -- Learning (10 tags)
  ('education', 'Learning', true, 0),
  ('reading', 'Learning', true, 0),
  ('language learning', 'Learning', true, 0),
  ('online courses', 'Learning', true, 0),
  ('books', 'Learning', true, 0),
  ('research', 'Learning', true, 0),
  ('note-taking', 'Learning', true, 0),
  ('study techniques', 'Learning', true, 0),
  ('memory techniques', 'Learning', true, 0),
  ('skills development', 'Learning', true, 0),

  -- Personal (8 tags)
  ('relationships', 'Personal', true, 0),
  ('family', 'Personal', true, 0),
  ('travel', 'Personal', true, 0),
  ('hobbies', 'Personal', true, 0),
  ('finance', 'Personal', true, 0),
  ('home improvement', 'Personal', true, 0),
  ('cooking', 'Personal', true, 0),
  ('parenting', 'Personal', true, 0)
ON CONFLICT (tag) DO NOTHING;

-- ============================================================================
-- FUNCTIONS: Tag normalization and similarity search
-- ============================================================================

-- Function to find most similar canonical tag
CREATE OR REPLACE FUNCTION find_similar_tag(
  query_embedding VECTOR(768),
  similarity_threshold FLOAT DEFAULT 0.80
)
RETURNS TABLE (
  id UUID,
  tag TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    canonical_tags.id,
    canonical_tags.tag,
    1 - (canonical_tags.embedding <=> query_embedding) AS similarity
  FROM canonical_tags
  WHERE 1 - (canonical_tags.embedding <=> query_embedding) > similarity_threshold
  ORDER BY canonical_tags.embedding <=> query_embedding
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION find_similar_tag IS 'Returns most similar canonical tag above threshold (default 0.80 = very similar)';

-- Function to increment tag usage
CREATE OR REPLACE FUNCTION increment_tag_usage(tag_text TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE canonical_tags
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE tag = tag_text;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_canonical_tags_updated_at BEFORE UPDATE ON canonical_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE canonical_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_aliases ENABLE ROW LEVEL SECURITY;

-- Anyone can view tags (global vocabulary)
CREATE POLICY "Anyone can view canonical tags"
  ON canonical_tags FOR SELECT
  TO authenticated
  USING (true);

-- System can manage tags
CREATE POLICY "System can manage canonical tags"
  ON canonical_tags FOR ALL
  TO service_role
  USING (true);

-- Anyone can view aliases
CREATE POLICY "Anyone can view tag aliases"
  ON tag_aliases FOR SELECT
  TO authenticated
  USING (true);

-- System can manage aliases
CREATE POLICY "System can manage tag aliases"
  ON tag_aliases FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Run this migration on Supabase
-- 2. Generate embeddings for seed tags (run once via API endpoint)
-- 3. Update memories API to normalize tags on creation
-- 4. Periodically consolidate similar tags (background job)
