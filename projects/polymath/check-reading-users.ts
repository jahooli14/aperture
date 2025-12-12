
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkReadingQueue() {
    console.log('Checking reading_queue table...')

    const { data, error } = await supabase
        .from('reading_queue')
        .select('user_id, count(*)', { count: 'exact', head: false })

    // Since we can't do GROUP BY easily with simple select in JS client without .rpc or distinct
    // Let's just fetch all user_ids and count in JS

    const { data: allItems, error: fetchError } = await supabase
        .from('reading_queue')
        .select('user_id')

    if (fetchError) {
        console.error('Error fetching reading queue:', fetchError)
        return
    }

    const counts = {}
    allItems.forEach(item => {
        const uid = item.user_id || 'null'
        counts[uid] = (counts[uid] || 0) + 1
    })

    console.log('Reading Queue Item Counts by User ID:')
    console.log(JSON.stringify(counts, null, 2))

    // Also check the hardcoded ID specifically
    const targetId = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'
    console.log(`\nChecking specific target ID: ${targetId}`)
    console.log(`Count for target: ${counts[targetId] || 0}`)
}

checkReadingQueue()
