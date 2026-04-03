import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.SUPABASE_DB_URL);

const migration = readFileSync('supabase/migrations/20260403_idea_engine.sql', 'utf-8');

try {
  await sql.unsafe(migration);
  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  await sql.end();
}
