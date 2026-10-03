-- What a question was built from, for display under it.
alter table sparks add column if not exists sources jsonb;
