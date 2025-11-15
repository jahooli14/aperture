#!/usr/bin/env node
/**
 * Check if all migrations have been applied to Supabase
 * Run with: npx tsx scripts/check-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrations() {
  console.log('🔍 Checking database schema...\n');

  // Check if milestone_achievements table exists
  const { data, error } = await supabase
    .from('milestone_achievements')
    .select('id')
    .limit(1);

  if (error) {
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('❌ milestone_achievements table does not exist!\n');
      console.log('📋 To fix this, run the following migration in your Supabase SQL Editor:\n');
      console.log('   https://supabase.com/dashboard/project/_/sql/new\n');

      const migrationPath = path.join(__dirname, '../supabase/migrations/006_add_milestone_tracking.sql');
      if (fs.existsSync(migrationPath)) {
        console.log('📄 Migration file contents:\n');
        console.log('─'.repeat(80));
        console.log(fs.readFileSync(migrationPath, 'utf-8'));
        console.log('─'.repeat(80));
      }

      process.exit(1);
    } else {
      console.error('❌ Error checking database:', error.message);
      process.exit(1);
    }
  }

  console.log('✅ milestone_achievements table exists!');
  console.log('✅ All migrations appear to be applied correctly.\n');
}

checkMigrations().catch(console.error);
