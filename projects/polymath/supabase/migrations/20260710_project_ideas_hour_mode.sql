-- Project Ideas — Hour mode.
--
-- Adds a third value to project_ideas.mode for the "do a self-contained
-- hour" surface: a small thing done start to finish inside one hour, not a
-- down-payment on a big project. Generated on-demand only (never baked into
-- the queue by cron), and stored 'superseded' so it displays once and never
-- short-circuits a later "suggest a project" press.
--
-- Schema delta:
--   mode — now 'crossover' | 'read' | 'hour'. The inline CHECK from
--          20260510_project_ideas_read_mode.sql only allowed the first two,
--          so we drop and re-add it. Default stays 'crossover'; existing
--          rows are untouched.

alter table project_ideas
  drop constraint if exists project_ideas_mode_check;

alter table project_ideas
  add constraint project_ideas_mode_check check (mode in ('crossover', 'read', 'hour'));
