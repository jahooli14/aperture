#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nxkysxgaujdimrubjiln.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3lzeGdhdWpkaW1ydWJqaWxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzY2MzA5NiwiZXhwIjoyMDU5MjM5MDk2fQ.XD85ptdFy2eM3mmuUYS3M_C7Nz-KLx2Y-oavUqhLEXA'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: 'public' }
})

async function checkConstraints() {
  // Query to get constraint definitions
  const { data, error } = await supabase
    .from('pg_constraint')
    .select('*')

  console.log('Constraints:', data || error)
}

// Just use raw fetch to get table structure
fetch('https://nxkysxgaujdimrubjiln.supabase.co/rest/v1/', {
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  }
}).then(r => r.json()).then(console.log)
