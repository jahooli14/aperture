-- How strongly the judge backed a take, 0-100. Shown quietly on the card.
alter table sparks add column if not exists score smallint;
