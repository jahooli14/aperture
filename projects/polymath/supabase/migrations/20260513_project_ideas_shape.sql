-- project_ideas.shape — the Read mode's self-tag for which sub-shape
-- of the pattern fired. CLAUDE.md describes The Moment as four scored
-- modes; the Read prompt now invites four shapes (coalescing / recent
-- forgotten / long-dormant reshape / extend). Persisting the tag lets
-- the surface render different visuals per shape rather than
-- collapsing all four into the single pink "what i see across your
-- work" eyebrow.
--
-- Nullable: crossover rows, permissive fallback rows, and template
-- synthesised rows all carry NULL. Only Read rows are expected to
-- have a non-null value, and even then the model may decline to tag.

alter table project_ideas
  add column if not exists shape text
    check (shape is null or shape in ('coalescing', 'recent_forgotten', 'reshape', 'extend'));

create index if not exists project_ideas_user_mode_shape_idx
  on project_ideas (user_id, mode, shape, generated_at desc);
