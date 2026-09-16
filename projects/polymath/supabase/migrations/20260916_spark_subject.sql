-- Which subject a question was about, by identity -- not just by project.
--
-- sparks.project_id already lets a project-shaped subject be demoted next
-- run (mull-subjects.ts), but a joint routinely has no project (a
-- project-less joint is how a NEW project gets surfaced), so nothing about
-- it was ever demotable: the same joint could be drafted, shipped, read and
-- dismissed, and the next bake would rank it exactly as high as if it had
-- never been asked. subject_id/subject_kind name the subject directly,
-- whatever kind it is, closing that gap for every kind the project-only
-- column structurally could not reach.
--
-- Nullable, same posture as stake: a bake is never worth failing over a
-- demotion signal, so the writers drop these two on 42703 until this runs.
ALTER TABLE sparks ADD COLUMN IF NOT EXISTS subject_id text;
ALTER TABLE sparks ADD COLUMN IF NOT EXISTS subject_kind text;

COMMENT ON COLUMN sparks.subject_id IS
  'The Subject.id (mull-subjects.ts) this question was drawn from -- a joint, project, pair, unfiled thought or article, whichever kind. Lets fetchRecentSparkSubjectIds demote it next run regardless of whether it has a project.';
COMMENT ON COLUMN sparks.subject_kind IS
  'The Subject.kind that produced subject_id -- diagnostic only, not read back by any query.';
