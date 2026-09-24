-- One thing from outside, once a week (api/_lib/outside-find.ts).
--
-- Sparks only ever recombine what's already been captured. This is the
-- one way in for something new: a technique, a maker or a specific piece
-- of work, found by web search for the live project's next step, and only
-- kept if its page really exists and is about it.
--
-- Its own table on purpose. Nothing here is the user's words, so it must
-- never be read as corpus: no embedding, no fragment, no mull input.
-- Saving one puts its link in the reading queue, where the usual rule
-- applies -- it counts for nothing until it's voted "good".

CREATE TABLE IF NOT EXISTS outside_finds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('technique', 'maker', 'work')),
  why TEXT NOT NULL,
  url TEXT NOT NULL,
  verdict TEXT CHECK (verdict IN ('saved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outside_finds_user
  ON outside_finds(user_id, created_at DESC);

ALTER TABLE outside_finds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own finds" ON outside_finds;
CREATE POLICY "Users manage their own finds"
  ON outside_finds FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
