-- Add category/type to places to identify what kind of place it is
-- e.g., pub, park, restaurant, relative's house, nursery, etc.

-- Add category column to places table
ALTER TABLE places ADD COLUMN category TEXT DEFAULT 'other';

-- Create a list of common categories
-- Can be extended as needed
CREATE TYPE place_category AS ENUM (
  'pub',
  'restaurant',
  'cafe',
  'park',
  'beach',
  'relative_house',
  'nursery',
  'playgroup',
  'soft_play',
  'attraction',
  'landmark',
  'other'
);

-- Update the column to use the enum type (PostgreSQL will handle the cast)
ALTER TABLE places DROP COLUMN category;
ALTER TABLE places ADD COLUMN category place_category DEFAULT 'other';

-- Create index for filtering by category
CREATE INDEX idx_places_category ON places(user_id, category);

-- Update the places_with_stats view to include category
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
  p.category,
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
GROUP BY p.id, p.user_id, p.name, p.description, p.latitude, p.longitude, p.address, p.category, p.created_at, p.updated_at;

ALTER VIEW places_with_stats SET (security_invoker = true);
