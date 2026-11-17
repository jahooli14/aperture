-- What you made (api/_lib/project-outputs.ts, api/_lib/made.ts): photos,
-- audio and links, each with a title, a few words and the day it was made.
-- Files move to a PRIVATE bucket: paintings and photos with other people in
-- them don't belong behind public URLs. Read through short-lived signed URLs.

ALTER TABLE project_outputs ALTER COLUMN path DROP NOT NULL;
ALTER TABLE project_outputs DROP CONSTRAINT IF EXISTS project_outputs_kind_check;
ALTER TABLE project_outputs ADD CONSTRAINT project_outputs_kind_check CHECK (kind IN ('image', 'audio', 'link'));
ALTER TABLE project_outputs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE project_outputs ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE project_outputs ADD COLUMN IF NOT EXISTS link_meta JSONB;
ALTER TABLE project_outputs ADD COLUMN IF NOT EXISTS made_on DATE;
ALTER TABLE project_outputs ADD COLUMN IF NOT EXISTS bucket TEXT;
ALTER TABLE project_outputs DROP CONSTRAINT IF EXISTS project_outputs_has_thing;
ALTER TABLE project_outputs ADD CONSTRAINT project_outputs_has_thing CHECK (path IS NOT NULL OR link IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_project_outputs_user_made ON project_outputs(user_id, made_on DESC);

INSERT INTO storage.buckets (id, name, public) VALUES ('made', 'made', false)
ON CONFLICT (id) DO NOTHING;
