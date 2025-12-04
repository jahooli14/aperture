
import 'dotenv/config' // Load environment variables from .env
import { getSupabaseClient } from '../api/_lib/supabase.js'
import { generateEmbedding } from '../api/_lib/gemini-embeddings.js'

// Check for required environment variables
const requiredVars = ['GEMINI_API_KEY', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missingVars = requiredVars.filter(v => !process.env[v])

if (missingVars.length > 0) {
  console.error('❌ Missing environment variables:', missingVars.join(', '))
  console.error('\nPlease run: vercel env pull .env')
  console.error('Then try running this script again.\n')
  process.exit(1)
}

const supabase = getSupabaseClient()

const DEFAULT_CAPABILITIES = [
  'React', 'TypeScript', 'Node.js', 'Python', 'SQL', 
  'Design', 'Writing', 'Project Management', 'Data Analysis',
  'Public Speaking', 'Photography', 'Video Editing', 'Marketing'
]

async function seedCapabilities() {
  console.log('🌱 Seeding default capabilities...')

  const userId = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Hardcoded user ID

  for (const name of DEFAULT_CAPABILITIES) {
    const embedding = await generateEmbedding(name)
    
    const { error } = await supabase
      .from('capabilities')
      .upsert({
        name,
        description: `Default capability: ${name}`,
        source_project: 'system',
        strength: 1.0,
        embedding
      }, { onConflict: 'name' })

    if (error) {
      console.error(`Failed to seed ${name}:`, error.message)
    } else {
      console.log(`✓ Seeded ${name}`)
    }
  }

  console.log('✅ Capabilities seeded!')
}

seedCapabilities()
