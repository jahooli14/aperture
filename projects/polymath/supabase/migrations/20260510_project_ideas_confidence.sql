-- Project Ideas — confidence score for the auto-surface threshold.
--
-- Read mode now emits a confidence integer 0–100 alongside the pattern.
-- The home surface only shows the prominent "there's something I want to
-- show you" teaser when confidence >= 70 — below that, the user has to
-- reach for the button explicitly. Silence is the integrity. The crossover
-- modes don't use this column (left NULL); they're shown via the button
-- regardless and the user is in charge of whether they care.
--
-- Existing rows have no confidence and are treated as below threshold by
-- the UI — older Read ideas (if any) won't fire the prominent teaser
-- without being regenerated. That's the right behaviour: the threshold
-- is a forward-looking quality bar, not a retroactive filter.

alter table project_ideas
  add column if not exists confidence smallint
    check (confidence is null or (confidence between 0 and 100));
