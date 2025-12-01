/**
 * Run Supabase Migration
 * Executes SQL migration files against the Supabase database
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);
async function runMigration(migrationFile) {
    console.log(`\n📄 Running migration: ${path.basename(migrationFile)}`);
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    try {
        // Note: Supabase JS client doesn't support raw SQL execution
        // We need to use the Supabase REST API directly
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            // If exec_sql function doesn't exist, we need to run migrations via Supabase Dashboard
            // or use the Supabase CLI
            console.error('❌ Error executing migration:', error.message);
            console.log('\n💡 To run this migration:');
            console.log('1. Go to https://supabase.com/dashboard');
            console.log('2. Select your project');
            console.log('3. Go to SQL Editor');
            console.log(`4. Copy and paste the contents of: ${migrationFile}`);
            console.log('5. Click "Run"');
            return false;
        }
        console.log('✅ Migration completed successfully');
        return true;
    }
    catch (error) {
        console.error('❌ Unexpected error:', error);
        return false;
    }
}
async function main() {
    const migrationFile = process.argv[2];
    if (!migrationFile) {
        console.error('❌ Please provide a migration file path');
        console.log('Usage: tsx scripts/run-migration.ts <migration-file>');
        console.log('Example: tsx scripts/run-migration.ts supabase/migrations/004_reading_queue.sql');
        process.exit(1);
    }
    const fullPath = path.join(__dirname, '..', migrationFile);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Migration file not found: ${fullPath}`);
        process.exit(1);
    }
    console.log('🚀 Supabase Migration Runner');
    console.log(`📍 Project: ${supabaseUrl}`);
    console.log(`📁 File: ${migrationFile}`);
    const success = await runMigration(fullPath);
    if (!success) {
        console.log('\n⚠️  Migration could not be run automatically.');
        console.log('\n📋 Manual migration instructions:');
        console.log('1. Copy the SQL from:', fullPath);
        console.log('2. Go to: https://supabase.com/dashboard/project/nxkysxgaujdimrubjiln/sql/new');
        console.log('3. Paste and run the SQL');
        process.exit(1);
    }
    console.log('\n✨ All done!');
}
main();
