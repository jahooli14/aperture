-- ============================================================================
-- DEVELOPMENTAL MILESTONE TRACKING EXTENSION
-- Add to existing Polymath database
-- ============================================================================

-- ============================================================================
-- TABLE: child_milestones
-- Detected developmental milestones from voice memories
-- ============================================================================

CREATE TABLE IF NOT EXISTS child_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  memory_id UUID NOT NULL, -- References memories table

  -- Milestone details
  milestone_id TEXT NOT NULL, -- From milestone taxonomy (e.g., 'first_steps')
  milestone_name TEXT NOT NULL,
  domain TEXT NOT NULL, -- motor_gross, motor_fine, language, cognitive, social_emotional, self_care

  -- Detection metadata
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence TEXT NOT NULL, -- Quote from memory showing this milestone
  is_new BOOLEAN DEFAULT true, -- First time this milestone detected
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Child context
  child_age_months INTEGER, -- Estimated or stated age when milestone occurred
  child_name TEXT, -- Optional: if family has multiple children

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_child_milestones_user_id ON child_milestones(user_id);
CREATE INDEX idx_child_milestones_memory_id ON child_milestones(memory_id);
CREATE INDEX idx_child_milestones_milestone_id ON child_milestones(milestone_id);
CREATE INDEX idx_child_milestones_domain ON child_milestones(domain);
CREATE INDEX idx_child_milestones_detected_at ON child_milestones(detected_at DESC);
CREATE INDEX idx_child_milestones_child_age ON child_milestones(child_age_months);

-- Prevent duplicate milestone detections from same memory
CREATE UNIQUE INDEX idx_child_milestones_unique_per_memory
  ON child_milestones(user_id, memory_id, milestone_id);

COMMENT ON TABLE child_milestones IS 'Developmental milestones detected in parent voice notes';
COMMENT ON COLUMN child_milestones.milestone_id IS 'Taxonomy ID (e.g., first_steps, first_word, social_smile)';
COMMENT ON COLUMN child_milestones.domain IS 'Developmental domain from taxonomy';
COMMENT ON COLUMN child_milestones.confidence IS 'AI detection confidence (0-1)';
COMMENT ON COLUMN child_milestones.evidence IS 'Direct quote from memory showing milestone';
COMMENT ON COLUMN child_milestones.is_new IS 'True if first time detecting this milestone for this child';

-- ============================================================================
-- TABLE: milestone_insights
-- AI-generated insights about child development patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS milestone_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Insight details
  insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'progression', 'achievement', 'suggestion')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Related data
  milestone_ids TEXT[], -- Array of milestone_ids this insight relates to
  domains_active TEXT[], -- Domains showing activity

  -- Metadata
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  dismissed BOOLEAN DEFAULT false, -- User can dismiss insights

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_milestone_insights_user_id ON milestone_insights(user_id);
CREATE INDEX idx_milestone_insights_type ON milestone_insights(insight_type);
CREATE INDEX idx_milestone_insights_generated_at ON milestone_insights(generated_at DESC);
CREATE INDEX idx_milestone_insights_dismissed ON milestone_insights(dismissed) WHERE dismissed = false;

COMMENT ON TABLE milestone_insights IS 'AI-generated insights about developmental patterns';
COMMENT ON COLUMN milestone_insights.insight_type IS 'pattern = recurring behavior, progression = skill development, achievement = major milestone, suggestion = next steps';

-- ============================================================================
-- TABLE: child_profiles
-- Optional: Track multiple children if user has more than one
-- ============================================================================

CREATE TABLE IF NOT EXISTS child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Child info
  name TEXT NOT NULL,
  birth_date DATE,

  -- Settings
  milestone_notifications BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_child_profiles_user_id ON child_profiles(user_id);
CREATE UNIQUE INDEX idx_child_profiles_unique_name ON child_profiles(user_id, name);

COMMENT ON TABLE child_profiles IS 'Child profiles for families with multiple children';

-- ============================================================================
-- EXTEND MEMORIES TABLE
-- Add milestone-related metadata fields
-- ============================================================================

DO $$
BEGIN
  -- Add metadata JSONB column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memories' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE memories ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN memories.metadata IS 'Flexible JSON storage: has_milestones, milestone_count, child_age_estimate, developmental_themes, etc.';

-- ============================================================================
-- VIEWS FOR MILESTONE ANALYTICS
-- ============================================================================

-- View: Milestone timeline with memory context
CREATE OR REPLACE VIEW milestone_timeline AS
SELECT
  cm.id,
  cm.user_id,
  cm.milestone_id,
  cm.milestone_name,
  cm.domain,
  cm.detected_at,
  cm.child_age_months,
  cm.confidence,
  cm.evidence,
  cm.is_new,
  m.title AS memory_title,
  m.created_at AS memory_date,
  m.emotional_tone
FROM child_milestones cm
JOIN memories m ON cm.memory_id = m.id
ORDER BY cm.detected_at DESC;

COMMENT ON VIEW milestone_timeline IS 'Complete milestone timeline with memory context';

-- View: Milestone summary by domain
CREATE OR REPLACE VIEW milestone_domain_summary AS
SELECT
  user_id,
  domain,
  COUNT(*) AS total_milestones,
  COUNT(DISTINCT milestone_id) AS unique_milestones,
  AVG(confidence) AS avg_confidence,
  MIN(detected_at) AS first_detected,
  MAX(detected_at) AS last_detected
FROM child_milestones
GROUP BY user_id, domain;

COMMENT ON VIEW milestone_domain_summary IS 'Summary of milestones by developmental domain';

-- View: Recent milestones (last 30 days)
CREATE OR REPLACE VIEW recent_milestones AS
SELECT
  cm.*,
  m.title AS memory_title
FROM child_milestones cm
JOIN memories m ON cm.memory_id = m.id
WHERE cm.detected_at > NOW() - INTERVAL '30 days'
ORDER BY cm.detected_at DESC;

COMMENT ON VIEW recent_milestones IS 'Milestones detected in last 30 days';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get milestone progression velocity
CREATE OR REPLACE FUNCTION get_milestone_velocity(p_user_id UUID)
RETURNS TABLE (
  domain TEXT,
  milestones_per_month FLOAT,
  velocity_category TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.domain,
    (COUNT(*)::FLOAT /
     EXTRACT(EPOCH FROM (MAX(cm.detected_at) - MIN(cm.detected_at))) * 2592000) AS milestones_per_month,
    CASE
      WHEN (COUNT(*)::FLOAT / EXTRACT(EPOCH FROM (MAX(cm.detected_at) - MIN(cm.detected_at))) * 2592000) > 3 THEN 'faster'
      WHEN (COUNT(*)::FLOAT / EXTRACT(EPOCH FROM (MAX(cm.detected_at) - MIN(cm.detected_at))) * 2592000) < 1 THEN 'slower'
      ELSE 'typical'
    END AS velocity_category
  FROM child_milestones cm
  WHERE cm.user_id = p_user_id
  GROUP BY cm.domain
  HAVING COUNT(*) >= 2;
END;
$$;

COMMENT ON FUNCTION get_milestone_velocity IS 'Calculate milestone achievement velocity by domain';

-- Function: Get next expected milestones based on progression
CREATE OR REPLACE FUNCTION suggest_next_milestones(
  p_user_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  milestone_id TEXT,
  milestone_name TEXT,
  domain TEXT,
  reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  latest_milestone RECORD;
BEGIN
  -- Get the most recent milestone
  SELECT cm.milestone_id, cm.domain, cm.child_age_months
  INTO latest_milestone
  FROM child_milestones cm
  WHERE cm.user_id = p_user_id
  ORDER BY cm.detected_at DESC
  LIMIT 1;

  IF latest_milestone IS NULL THEN
    -- No milestones yet, return early milestones
    RETURN QUERY
    SELECT
      'social_smile'::TEXT,
      'Social smile'::TEXT,
      'social_emotional'::TEXT,
      'Typical first milestone (1-3 months)'::TEXT
    LIMIT p_limit;
  ELSE
    -- Return milestones from same domain that haven't been detected yet
    -- This is a simplified version - real implementation would use milestone taxonomy
    RETURN QUERY
    SELECT
      cm.milestone_id,
      cm.milestone_name,
      cm.domain,
      'Expected next in ' || cm.domain || ' development'::TEXT
    FROM child_milestones cm
    WHERE cm.user_id != p_user_id -- Not detected by this user yet
      AND cm.domain = latest_milestone.domain
    LIMIT p_limit;
  END IF;
END;
$$;

COMMENT ON FUNCTION suggest_next_milestones IS 'Suggest next expected milestones based on current progression';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create GIN index on memories.metadata for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_memories_metadata_gin ON memories USING GIN(metadata);

-- Index for finding memories with milestones
CREATE INDEX IF NOT EXISTS idx_memories_has_milestones
  ON memories((metadata->>'has_milestones')::BOOLEAN)
  WHERE (metadata->>'has_milestones')::BOOLEAN = true;

-- ============================================================================
-- PERMISSIONS (Adjust based on your RLS setup)
-- ============================================================================

-- Example RLS policies (enable if using Row Level Security)
-- ALTER TABLE child_milestones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE milestone_insights ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view own milestones"
--   ON child_milestones FOR SELECT
--   USING (auth.uid() = user_id);

-- CREATE POLICY "Users can insert own milestones"
--   ON child_milestones FOR INSERT
--   WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Milestone tracking tables created successfully!';
  RAISE NOTICE 'Tables: child_milestones, milestone_insights, child_profiles';
  RAISE NOTICE 'Views: milestone_timeline, milestone_domain_summary, recent_milestones';
  RAISE NOTICE 'Functions: get_milestone_velocity, suggest_next_milestones';
END $$;
