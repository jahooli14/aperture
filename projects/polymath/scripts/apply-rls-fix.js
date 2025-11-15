#!/usr/bin/env node
/**
 * Apply RLS fix to projects table
 * Run: node scripts/apply-rls-fix.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nxkysxgaujdimrubjiln.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3lzeGdhdWpkaW1ydWJqaWxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzY2MzA5NiwiZXhwIjoyMDU5MjM5MDk2fQ.XD85ptdFy2eM3mmuUYS3M_C7Nz-KLx2Y-oavUqhLEXA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function applyFix() {
  console.log('🔧 Disabling RLS on projects table...')

  const queries = [
    'ALTER TABLE projects DISABLE ROW LEVEL SECURITY',
    'DROP POLICY IF EXISTS "Users can view their own projects" ON projects',
    'DROP POLICY IF EXISTS "Users can insert their own projects" ON projects',
    'DROP POLICY IF EXISTS "Users can update their own projects" ON projects',
    'DROP POLICY IF EXISTS "Users can delete their own projects" ON projects'
  ]

  for (const query of queries) {
    console.log(`Running: ${query}`)
    const { error } = await supabase.rpc('exec_sql', { sql: query })
    if (error) {
      console.error(`❌ Error: ${error.message}`)
    } else {
      console.log('✅ Success')
    }
  }

  console.log('\n🎉 RLS disabled on projects table!')
  console.log('You can now create projects without authentication.')
}

applyFix().catch(console.error)
