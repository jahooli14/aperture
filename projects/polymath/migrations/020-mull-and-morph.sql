-- 020-mull-and-morph.sql
--
-- Schema for build steps 2-7 of the execution rebuild (see SPEC.md):
-- booking, fragments/slots, sparks, morph/composite proposals, joints.
-- All additive and RLS'd, following 019-execution-sessions.sql's pattern.

-- ─── Booking (step 3) ───────────────────────────────────────────────────
-- "The book needs about two hours. When?" No calendar integration in v1 —
-- this just remembers the date the user chose so that day can open
-- pre-loaded with the project, per SPEC.md.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS booked_session_at TIMESTAMPTZ;

-- ─── Fragments (step 5) ─────────────────────────────────────────────────
-- A voicing attached to a project with a role. Roles are what make
-- accumulation useful — three references and no deadline behaves
-- differently from the reverse.
CREATE TABLE IF NOT EXISTS fragments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  role TEXT NOT NULL
    CHECK (role IN ('reference', 'constraint', 'material', 'deadline', 'obstacle', 'collaborator')),
  fills_slot TEXT,  -- the slot name it filled, if any (matches projects.slots[].name)
  text TEXT NOT NULL,  -- denormalized copy of the memory body at attach time,
                        -- so a fragment survives even if the memory is later edited
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fragments_project ON fragments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fragments_user ON fragments(user_id, created_at DESC);

ALTER TABLE fragments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own fragments" ON fragments;
CREATE POLICY "Users can view their own fragments" ON fragments FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert their own fragments" ON fragments;
CREATE POLICY "Users can insert their own fragments" ON fragments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own fragments" ON fragments;
CREATE POLICY "Users can update their own fragments" ON fragments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own fragments" ON fragments;
CREATE POLICY "Users can delete their own fragments" ON fragments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── Sparks (step 4) ────────────────────────────────────────────────────
-- Baked overnight, one per day. Success is measured by talk-back
-- (answered_at set), not agreement.
CREATE TABLE IF NOT EXISTS sparks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('noticing', 'transferred_constraint', 'unfinished_thought', 'contradiction', 'scale_jump', 'material_fact', 'outside_reach')),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  shown_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  response_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sparks_user_created ON sparks(user_id, created_at DESC);

ALTER TABLE sparks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own sparks" ON sparks;
CREATE POLICY "Users can view their own sparks" ON sparks FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert their own sparks" ON sparks;
CREATE POLICY "Users can insert their own sparks" ON sparks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own sparks" ON sparks;
CREATE POLICY "Users can update their own sparks" ON sparks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Joints (step 7) ────────────────────────────────────────────────────
-- Something the user has said more than once that applies across
-- projects. Quoted, never invented — mined from recurring fragments.
CREATE TABLE IF NOT EXISTS joints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  fragment_ids UUID[] NOT NULL DEFAULT '{}',
  occurrence_count INTEGER NOT NULL DEFAULT 2,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE joints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own joints" ON joints;
CREATE POLICY "Users can view their own joints" ON joints FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert their own joints" ON joints;
CREATE POLICY "Users can insert their own joints" ON joints FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own joints" ON joints;
CREATE POLICY "Users can update their own joints" ON joints FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Proposals (step 6 + 7) ─────────────────────────────────────────────
-- One table for both morph and composite proposals — same lifecycle
-- (pending -> accepted/rejected), same "cite or stay silent" discipline,
-- same one-tap "that's not it" per SPEC.md.
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('morph', 'composite')),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,       -- morph target / composite parent A
  project_id_2 UUID REFERENCES projects(id) ON DELETE CASCADE,     -- composite parent B (null for morph)
  joint_id UUID REFERENCES joints(id) ON DELETE SET NULL,          -- composite only
  proposed_text TEXT NOT NULL,
  cited_fragment_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proposals_user_status ON proposals(user_id, status, created_at DESC);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own proposals" ON proposals;
CREATE POLICY "Users can view their own proposals" ON proposals FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert their own proposals" ON proposals;
CREATE POLICY "Users can insert their own proposals" ON proposals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own proposals" ON proposals;
CREATE POLICY "Users can update their own proposals" ON proposals FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
