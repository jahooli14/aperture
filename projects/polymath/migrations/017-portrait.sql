-- The Portrait — slice 1
-- See projects/polymath/docs/PORTRAIT_SPEC.md
--
-- Three tables: the prose snapshot, the sealed predictions, and the
-- post-week reckonings that grade them. Calibration = rolling score
-- over the user's last 10 reckonings.

CREATE TABLE IF NOT EXISTS portrait_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portrait_snapshots_user_latest
  ON portrait_snapshots(user_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS portrait_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction      TEXT NOT NULL,
  week_starting   DATE NOT NULL,
  sealed_until    DATE NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portrait_predictions_user_latest
  ON portrait_predictions(user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_portrait_predictions_unreckoned
  ON portrait_predictions(sealed_until)
  WHERE sealed_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS portrait_reckonings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id   UUID NOT NULL UNIQUE REFERENCES portrait_predictions(id) ON DELETE CASCADE,
  called          TEXT NOT NULL CHECK (called IN ('hit', 'partial', 'miss')),
  evidence        TEXT NOT NULL,
  score           NUMERIC NOT NULL CHECK (score IN (0, 0.5, 1)),
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portrait_reckonings_prediction
  ON portrait_reckonings(prediction_id);

-- RLS. The reckonings table inherits scoping through prediction_id; we
-- check the prediction's user_id rather than denormalising user_id onto
-- reckonings, so a single source of truth.
ALTER TABLE portrait_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE portrait_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portrait_reckonings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portrait_snapshots_user ON portrait_snapshots;
CREATE POLICY portrait_snapshots_user ON portrait_snapshots
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS portrait_predictions_user ON portrait_predictions;
CREATE POLICY portrait_predictions_user ON portrait_predictions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS portrait_reckonings_user ON portrait_reckonings;
CREATE POLICY portrait_reckonings_user ON portrait_reckonings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM portrait_predictions p
      WHERE p.id = prediction_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portrait_predictions p
      WHERE p.id = prediction_id AND p.user_id = auth.uid()
    )
  );
