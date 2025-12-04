
import { getSupabaseClient } from '../api/_lib/supabase.js'
import { generateEmbedding } from '../api/_lib/gemini-embeddings.js'

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
