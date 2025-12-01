/**
 * Seed Memories Script
 * Adds sample memories to populate the memories page
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const userId = process.env.USER_ID || 'default-user'

async function seedMemories() {
  console.log('🧠 Seeding memories...\n')

  const now = Date.now()
  const memories = [
    {
      audiopen_id: `manual_${now}_1`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Learning about vector embeddings',
      body: 'Spent the afternoon reading about how vector embeddings work for semantic search. The concept of encoding meaning into high-dimensional vectors is fascinating. Could be useful for the memory system.',
      orig_transcript: null,
      tags: ['ai', 'learning', 'embeddings'],
      memory_type: 'insight',
      emotional_tone: 'curious',
      entities: {
        topics: ['vector embeddings', 'semantic search', 'AI'],
        people: []
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_2`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Ideas for watercolor project',
      body: 'Had an idea while walking - what if I combine portrait painting with abstract backgrounds? Could create interesting tension between realistic faces and expressive color fields.',
      orig_transcript: null,
      tags: ['art', 'watercolor', 'ideas'],
      memory_type: 'insight',
      emotional_tone: 'inspired',
      entities: {
        topics: ['watercolor', 'portraits', 'art'],
        people: []
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_3`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Coffee chat with Sarah about creative process',
      body: 'Met Sarah at the cafe. She talked about her approach to creative blocks - taking walks, sketching randomly, not forcing it. Resonated with me. Also discussed balancing technical and creative work.',
      orig_transcript: null,
      tags: ['creativity', 'conversation'],
      memory_type: 'event',
      emotional_tone: 'reflective',
      entities: {
        topics: ['creative process', 'creative blocks', 'work-life balance'],
        people: ['Sarah']
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_4`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Voice interfaces are getting interesting',
      body: 'Been thinking about voice as an interface for personal tools. Much more natural than typing for capturing fleeting thoughts. The friction is so low. Should explore this more.',
      orig_transcript: null,
      tags: ['voice-ui', 'interface-design', 'thoughts'],
      memory_type: 'insight',
      emotional_tone: 'excited',
      entities: {
        topics: ['voice interfaces', 'UX design', 'personal tools'],
        people: []
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_5`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Reading "The Creative Act" by Rick Rubin',
      body: 'Started reading Rick Rubin\'s book on creativity. His idea that we\'re all just vessels for creative work, not the source, is profound. Takes the pressure off. Art chooses the artist.',
      orig_transcript: null,
      tags: ['reading', 'creativity', 'philosophy'],
      memory_type: 'foundational',
      emotional_tone: 'contemplative',
      entities: {
        topics: ['creativity', 'philosophy', 'art'],
        people: ['Rick Rubin']
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_6`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Working on face alignment algorithm',
      body: 'Debugging the face detection system today. The alignment works but needs better handling of edge cases - side profiles, multiple faces, poor lighting. Good progress though.',
      orig_transcript: null,
      tags: ['coding', 'computer-vision', 'debugging'],
      memory_type: 'event',
      emotional_tone: 'focused',
      entities: {
        topics: ['face detection', 'computer vision', 'debugging'],
        people: []
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_7`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Concept: Projects as capabilities',
      body: 'Insight - what if completing projects doesn\'t just create outputs, but strengthens your capability graph? Each project teaches you something, builds a skill. The system could track this.',
      orig_transcript: null,
      tags: ['meta', 'system-design', 'insight'],
      memory_type: 'insight',
      emotional_tone: 'excited',
      entities: {
        topics: ['meta-cognition', 'system design', 'learning'],
        people: []
      },
      processed: true,
      error: null
    },
    {
      audiopen_id: `manual_${now}_8`,
      audiopen_created_at: new Date().toISOString(),
      title: 'Guitar practice breakthrough',
      body: 'Finally got the fingerpicking pattern smooth on that song I\'ve been practicing. It clicked after focusing on the thumb independently. Muscle memory is building.',
      orig_transcript: null,
      tags: ['music', 'guitar', 'practice'],
      memory_type: 'event',
      emotional_tone: 'satisfied',
      entities: {
        topics: ['guitar', 'practice', 'music'],
        people: []
      },
      processed: true,
      error: null
    }
  ]

  const { data, error } = await supabase
    .from('memories')
    .insert(memories)
    .select()

  if (error) {
    console.error('❌ Error seeding memories:', error)
    throw error
  } else {
    console.log(`✅ Successfully seeded ${data.length} memories\n`)
    console.log('📊 Memory breakdown:')
    const typeCount = memories.reduce((acc, m) => {
      acc[m.memory_type] = (acc[m.memory_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })
  }

  console.log('\n✨ Memories seeded successfully!')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMemories()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    })
}

export { seedMemories }
