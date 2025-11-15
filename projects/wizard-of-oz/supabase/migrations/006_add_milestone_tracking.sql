-- Milestone tracking table
-- Stores user's completed milestones and links them to photos
CREATE TABLE milestone_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL, -- References milestone.id from data/milestones.ts
  achieved_date DATE NOT NULL, -- When the milestone was achieved
  photo_id UUID REFERENCES photos(id) ON DELETE SET NULL, -- Optional link to a photo
  notes TEXT, -- Optional notes from parent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, milestone_id) -- Each milestone can only be achieved once per user
);

-- Indexes
CREATE INDEX idx_milestone_achievements_user ON milestone_achievements(user_id);
CREATE INDEX idx_milestone_achievements_photo ON milestone_achievements(photo_id);
CREATE INDEX idx_milestone_achievements_date ON milestone_achievements(achieved_date DESC);

-- Row Level Security (RLS)
ALTER TABLE milestone_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for milestone_achievements
CREATE POLICY "Users can view their own milestone achievements"
  ON milestone_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own milestone achievements"
  ON milestone_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own milestone achievements"
  ON milestone_achievements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own milestone achievements"
  ON milestone_achievements FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_milestone_achievements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER milestone_achievements_updated_at
  BEFORE UPDATE ON milestone_achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_achievements_updated_at();
