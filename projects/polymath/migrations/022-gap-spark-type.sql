-- 022-gap-spark-type.sql
--
-- Adds the missing 'gap' spark type to the sparks table's CHECK constraint.
--
-- spark-types.ts added 'gap' to the SPARK_TYPES rotation (the one type
-- that asks rather than offers -- see its own comment there) and
-- spark-generator.ts wires it to generateGap, but no migration ever
-- taught the database about it. Every time the rotation picked 'gap' and
-- generateGap didn't decline, the insert in utilities.ts's bake handler
-- violated sparks_type_check and the whole day's bake failed with a 500,
-- not just that one type.

ALTER TABLE sparks DROP CONSTRAINT IF EXISTS sparks_type_check;

ALTER TABLE sparks ADD CONSTRAINT sparks_type_check CHECK (
  type IN (
    'noticing',
    'gap',
    'transferred_constraint',
    'unfinished_thought',
    'contradiction',
    'scale_jump',
    'material_fact',
    'outside_reach',
    'forgotten'
  )
);

NOTIFY pgrst, 'reload schema';
