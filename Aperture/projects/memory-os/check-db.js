// Quick script to check if Supabase schema is set up
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://nxkysxgaujdimrubjiln.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3lzeGdhdWpkaW1ydWJqaWxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzY2MzA5NiwiZXhwIjoyMDU5MjM5MDk2fQ.XD85ptdFy2eM3mmuUYS3M_C7Nz-KLx2Y-oavUqhLEXA'
)

async function checkSchema() {
  console.log('Checking Supabase schema...\n')

  // Check memories table
  const { data: memories, error: memError } = await supabase
    .from('memories')
    .select('count')
    .limit(1)

  if (memError) {
    console.log('❌ memories table NOT found')
    console.log('Error:', memError.message)
    return false
  }

  console.log('✅ memories table exists')

  // Check bridges table
  const { data: bridges, error: bridgeError } = await supabase
    .from('bridges')
    .select('count')
    .limit(1)

  if (bridgeError) {
    console.log('❌ bridges table NOT found')
    return false
  }

  console.log('✅ bridges table exists')

  // Check match_memories function
  const { error: funcError } = await supabase.rpc('match_memories', {
    query_embedding: new Array(768).fill(0),
    match_threshold: 0.8,
    match_count: 1
  })

  if (funcError) {
    console.log('❌ match_memories function NOT found')
    console.log('Error:', funcError.message)
    return false
  }

  console.log('✅ match_memories function exists')
  console.log('\n✅ Schema is fully set up!')
  return true
}

checkSchema()
