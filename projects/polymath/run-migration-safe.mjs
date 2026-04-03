import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.SUPABASE_DB_URL);

const migration = readFileSync('supabase/migrations/20260403_idea_engine.sql', 'utf-8');

// Split into individual statements
const statements = migration
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Running ${statements.length} SQL statements...`);

try {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.includes('CREATE TABLE') || stmt.includes('CREATE INDEX')) {
      console.log(`[${i+1}/${statements.length}] ${stmt.substring(0, 50)}...`);
    }
    try {
      await sql.unsafe(stmt);
    } catch (error) {
      // Ignore "already exists" errors
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log(`  ⚠️  Already exists, skipping`);
    }
  }
  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error('Full error:', error);
  process.exit(1);
} finally {
  await sql.end();
}
