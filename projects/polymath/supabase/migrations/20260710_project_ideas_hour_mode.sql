-- Project Ideas — Hour mode.
--
-- Adds a third value to project_ideas.mode for the "do a self-contained
-- hour" surface: a small thing done start to finish inside one hour, not a
-- down-payment on a big project. Generated on-demand only (never baked into
-- the queue by cron), and stored 'superseded' so it displays once and never
-- short-circuits a later "suggest a project" press.
--
-- Schema delta:
--   mode — now 'crossover' | 'read' | 'hour'. The original CHECK was created
--          inline on the column in 20260510_project_ideas_read_mode.sql, so
--          its auto-generated name isn't guaranteed. Drop whatever CHECK
--          constrains `mode` (found by definition, not a hard-coded name)
--          and re-add the widened one. Idempotent + safe to re-run. Default
--          stays 'crossover'; existing rows are untouched.

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'project_ideas'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%mode%'
  loop
    execute format('alter table project_ideas drop constraint %I', c.conname);
  end loop;
end $$;

alter table project_ideas
  add constraint project_ideas_mode_check check (mode in ('crossover', 'read', 'hour'));
