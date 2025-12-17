
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { join } from 'path'

// Load environment variables
dotenv.config({ path: join(process.cwd(), 'projects/polymath/.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkCapabilities() {
    console.log('Checking capabilities...')

    // Get all users? Or just list all caps
    const { data: caps, error } = await supabase
        .from('capabilities')
        .select('*')
        .limit(10)

    if (error) {
        console.error('Error fetching capabilities:', error)
        return
    }

    console.log(`Found ${caps?.length || 0} capabilities (showing top 10):`)
    caps?.forEach(c => {
        console.log(`- [${c.id}] ${c.name} (Strength: ${c.strength})`)
    })

    // Check if any have strength 0
    const { count: zeroStrengthCount } = await supabase
        .from('capabilities')
        .select('*', { count: 'exact', head: true })
        .eq('strength', 0)

    console.log(`Capabilities with strength 0: ${zeroStrengthCount}`)
}

checkCapabilities()
