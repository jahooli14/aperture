#!/usr/bin/env node
/**
 * Check projects table permissions and try to insert
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nxkysxgaujdimrubjiln.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3lzeGdhdWpkaW1ydWJqaWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2NjMwOTYsImV4cCI6MjA1OTIzOTA5Nn0.ylNQefkzj0eGVQ0C5hWbDWYMSKEZWUjm-Ct9ESwPe4I'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function testInsert() {
  console.log('🧪 Testing project creation with client-side Supabase...\n')

  const testProject = {
    user_id: 'f2404e61-2010-46c8-8edd-b8a3e702f0fb',
    title: 'Test Project',
    description: 'Testing RLS fix',
    type: 'hobby',
    status: 'active',
    metadata: {}
  }

  console.log('Attempting to insert:', JSON.stringify(testProject, null, 2))

  const { data, error } = await supabase
    .from('projects')
    .insert([testProject])
    .select()

  if (error) {
    console.error('\n❌ INSERT FAILED:', error.message)
    console.error('Error details:', JSON.stringify(error, null, 2))
  } else {
    console.log('\n✅ INSERT SUCCEEDED!')
    console.log('Created project:', data)

    // Clean up test project
    if (data && data[0]) {
      await supabase.from('projects').delete().eq('id', data[0].id)
      console.log('🗑️  Cleaned up test project')
    }
  }
}

testInsert().catch(console.error)
