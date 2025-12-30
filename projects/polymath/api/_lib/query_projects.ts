import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, type, status, metadata, last_active')
    .in('status', ['active', 'upcoming', 'maintaining'])
  
  if (error) { console.error(error); return; }
  
  console.log(JSON.stringify(projects, null, 2))
}

run()
