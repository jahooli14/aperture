-- Places tracking for special locations visited with baby
-- Stores places and links them to photos for "first visit" tracking

-- Places table - stores special locations
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "The Red Lion Pub", "Grandma's House"
  description TEXT, -- Optional notes about the place
  latitude DECIMAL(10, 8) NOT NULL, -- GPS latitude
  longitude DECIMAL(11, 8) NOT NULL, -- GPS longitude
  address TEXT, -- Optional formatted address from geocoding
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photo-Places junction table - links photos to places
CREATE TABLE photo_places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  notes TEXT, -- Optional visit-specific notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, place_id) -- Each photo can only be linked to a place once
);

-- Indexes for performance
CREATE INDEX idx_places_user ON places(user_id);
CREATE INDEX idx_places_location ON places(latitude, longitude);
CREATE INDEX idx_photo_places_photo ON photo_places(photo_id);
CREATE INDEX idx_photo_places_place ON photo_places(place_id);

-- Row Level Security (RLS) for places
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own places"
  ON places FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own places"
  ON places FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own places"
  ON places FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own places"
  ON places FOR DELETE
  USING (auth.uid() = user_id);

-- Row Level Security (RLS) for photo_places
ALTER TABLE photo_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view photo_places for their photos"
  ON photo_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND photos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photo_places for their photos"
  ON photo_places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND photos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete photo_places for their photos"
  ON photo_places FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND photos.user_id = auth.uid()
    )
  );

-- Trigger to update places updated_at timestamp
CREATE OR REPLACE FUNCTION update_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW
  EXECUTE FUNCTION update_places_updated_at();

-- View to get places with first visit date and photo count
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
  MIN(photos.upload_date) as first_visit_date,
  COUNT(DISTINCT pp.photo_id) as photo_count,
  ARRAY_AGG(DISTINCT photos.upload_date ORDER BY photos.upload_date) as visit_dates
FROM places p
LEFT JOIN photo_places pp ON p.id = pp.place_id
LEFT JOIN photos ON pp.photo_id = photos.id
GROUP BY p.id, p.user_id, p.name, p.description, p.latitude, p.longitude, p.address, p.created_at, p.updated_at;

-- RLS for the view
ALTER VIEW places_with_stats SET (security_invoker = true);
