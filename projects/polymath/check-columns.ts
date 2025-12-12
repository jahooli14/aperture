
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
    console.log('Checking reading_queue columns...')

    // Try to select the specific columns
    const { data, error } = await supabase
        .from('reading_queue')
        .select('last_active_at, inbox_entry_at')
        .limit(1)

    if (error) {
        console.error('Error selecting specific columns:', error)
    } else {
        console.log('Successfully selected columns. Data sample:', data)
    }
}

checkColumns()
