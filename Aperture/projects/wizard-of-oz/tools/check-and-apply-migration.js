#!/usr/bin/env node

/**
 * Check if migration 007 is applied and apply it if needed
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaruvcwdqkqmyscwvxci.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkMigrationStatus() {
  console.log('🔍 Checking if migration 007 is applied...\n');

  // Check if the policy exists
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        polname as policy_name,
        pg_get_expr(polqual, polrelid) as policy_definition
      FROM pg_policy
      WHERE polrelid = 'photos'::regclass
      AND polname = 'Users can view their own and shared photos';
    `
  }).catch(async () => {
    // If exec_sql doesn't exist, try direct query
    return await supabase
      .from('pg_policy')
      .select('polname')
      .eq('polname', 'Users can view their own and shared photos')
      .limit(1);
  });

  if (error) {
    console.log('ℹ️  Cannot directly query policy (expected if not superuser)');
    console.log('   Will attempt to apply migration...\n');
    return false;
  }

  if (data && data.length > 0) {
    console.log('✅ Migration 007 policy found!\n');
    console.log('Policy:', data[0]);

    // Check if it has the corrected logic
    const policyDef = data[0].policy_definition || '';
    if (policyDef.includes('user_id IN')) {
      console.log('✅ Policy has correct logic (user_id IN clause)');
      return true;
    } else {
      console.log('⚠️  Policy exists but may have old logic');
      return false;
    }
  }

  console.log('❌ Migration 007 policy not found\n');
  return false;
}

async function applyMigration() {
  console.log('📝 Applying migration 007...\n');

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '007_fix_shared_photos_visibility.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Migration SQL:');
  console.log('─'.repeat(60));
  console.log(migrationSQL);
  console.log('─'.repeat(60));
  console.log();

  // Split SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

  console.log(`Executing ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`${i + 1}. Executing: ${statement.substring(0, 60)}...`);

    const { error } = await supabase.rpc('exec_sql', { sql: statement }).catch(async () => {
      // If exec_sql doesn't work, try using the Supabase client directly
      return { error: new Error('exec_sql RPC not available') };
    });

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      if (error.message.includes('already exists') || error.message.includes('does not exist')) {
        console.log('   ℹ️  This is expected if re-running. Continuing...');
      } else {
        console.error('\n⚠️  You may need to apply this manually in Supabase SQL Editor');
        return false;
      }
    } else {
      console.log('   ✅ Success');
    }
  }

  return true;
}

async function main() {
  console.log('🚀 Migration 007 Check & Apply Tool\n');
  console.log('=' .repeat(60));
  console.log();

  const isApplied = await checkMigrationStatus();

  if (isApplied) {
    console.log('\n✅ Migration 007 is already applied!');
    console.log('   All shared photos should be visible to both users.\n');
    return;
  }

  console.log('📋 Manual Application Steps:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/zaruvcwdqkqmyscwvxci/sql/new');
  console.log('2. Copy the contents of: supabase/migrations/007_fix_shared_photos_visibility.sql');
  console.log('3. Paste and run in the SQL Editor');
  console.log('4. Verify the policy is created\n');

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '007_fix_shared_photos_visibility.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Migration SQL to apply:');
  console.log('─'.repeat(60));
  console.log(migrationSQL);
  console.log('─'.repeat(60));
  console.log();
}

main().catch(console.error);
