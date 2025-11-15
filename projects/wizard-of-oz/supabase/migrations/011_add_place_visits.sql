-- Add place_visits table to track when he visited each place
-- This is independent of photos - you can add a visit without a photo

-- Place visits table - records each visit to a place with a date
CREATE TABLE place_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(place_id, user_id, visit_date) -- One visit per place per user per date
);

-- Update photo_places to optionally link to a specific visit
ALTER TABLE photo_places ADD COLUMN visit_id UUID REFERENCES place_visits(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_place_visits_user ON place_visits(user_id);
CREATE INDEX idx_place_visits_place ON place_visits(place_id);
CREATE INDEX idx_place_visits_date ON place_visits(visit_date);
CREATE INDEX idx_photo_places_visit ON photo_places(visit_id);

-- Row Level Security (RLS) for place_visits
ALTER TABLE place_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own place visits"
  ON place_visits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own place visits"
  ON place_visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own place visits"
  ON place_visits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own place visits"
  ON place_visits FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update place_visits updated_at timestamp
CREATE OR REPLACE FUNCTION update_place_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER place_visits_updated_at
  BEFORE UPDATE ON place_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_place_visits_updated_at();

-- Updated view to include visits
DROP VIEW places_with_stats;

CREATE VIEW places_with_stats AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.description,
  p.latitude,
  p.longitude,
  p.address,
  p.created_at,
  p.updated_at,
  -- First visit date: use place_visits if available, otherwise use photo dates
  COALESCE(MIN(pv.visit_date), MIN(photos.upload_date))::DATE as first_visit_date,
  -- Count photos linked to this place
  COUNT(DISTINCT CASE WHEN pp.photo_id IS NOT NULL THEN pp.photo_id END) as photo_count,
  -- Count visits to this place
  COUNT(DISTINCT pv.id) as visit_count,
  -- Array of all visit dates
  ARRAY_AGG(DISTINCT pv.visit_date ORDER BY pv.visit_date) FILTER (WHERE pv.visit_date IS NOT NULL) as visit_dates
FROM places p
LEFT JOIN place_visits pv ON p.id = pv.place_id AND pv.user_id = p.user_id
LEFT JOIN photo_places pp ON p.id = pp.place_id
LEFT JOIN photos ON pp.photo_id = photos.id AND photos.user_id = p.user_id
WHERE p.user_id = auth.uid()
GROUP BY p.id, p.user_id, p.name, p.description, p.latitude, p.longitude, p.address, p.created_at, p.updated_at;

ALTER VIEW places_with_stats SET (security_invoker = true);
