/**
 * Seed Test Data Script
 * Populates database with sample data for testing without running full synthesis
 * Run: npx tsx scripts/seed-test-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const userId = process.env.USER_ID || 'default-user'

async function seedTestData() {
  console.log('🌱 Seeding test data...\n')

  // 1. Seed capabilities
  console.log('📦 Seeding capabilities...')
  const capabilities = [
    {
      name: 'voice-processing',
      description: 'Voice note capture and processing via Audiopen',
      source_project: 'memory-os',
      strength: 8.2,
      code_references: [{ file: 'api/capture.ts', function: 'handler' }]
    },
    {
      name: 'embeddings',
      description: 'Vector embeddings for semantic search using OpenAI',
      source_project: 'memory-os',
      strength: 7.5,
      code_references: [{ file: 'src/lib/process.ts' }]
    },
    {
      name: 'face-alignment',
      description: 'Face detection and alignment for baby photos',
      source_project: 'wizard-of-oz',
      strength: 5.2,
      code_references: [{ file: 'api/align.ts' }]
    },
    {
      name: 'image-processing',
      description: 'Image manipulation and optimization',
      source_project: 'wizard-of-oz',
      strength: 4.9,
      code_references: [{ file: 'src/lib/images.ts' }]
    },
    {
      name: 'documentation-generation',
      description: 'AI-powered documentation creation',
      source_project: 'autonomous-docs',
      strength: 3.1,
      code_references: [{ file: 'update.ts' }]
    }
  ]

  const { error: capError } = await supabase
    .from('capabilities')
    .upsert(capabilities, { onConflict: 'name' })

  if (capError) {
    console.error('❌ Error seeding capabilities:', capError)
  } else {
    console.log(`✅ Seeded ${capabilities.length} capabilities\n`)
  }

  // 2. Seed personal projects
  console.log('🎨 Seeding personal projects...')
  const projects = [
    {
      user_id: userId,
      title: 'Watercolor portrait series',
      description: 'Practice watercolor techniques with focus on faces',
      type: 'personal',
      status: 'active',
      metadata: {
        tags: ['art', 'watercolor', 'portraits'],
        energy_level: 'medium',
        materials_needed: ['watercolors', 'canvas', 'brushes']
      }
    },
    {
      user_id: userId,
      title: 'Guitar practice routine',
      description: 'Daily 30min practice - fingerpicking and chord transitions',
      type: 'personal',
      status: 'active',
      metadata: {
        tags: ['music', 'guitar'],
        energy_level: 'low'
      }
    },
    {
      user_id: userId,
      title: 'Short story collection',
      description: 'Writing collection of sci-fi short stories',
      type: 'personal',
      status: 'dormant',
      metadata: {
        tags: ['writing', 'fiction'],
        energy_level: 'high'
      }
    }
  ]

  const { error: projError } = await supabase
    .from('projects')
    .upsert(projects, { onConflict: 'title' })

  if (projError) {
    console.error('❌ Error seeding projects:', projError)
  } else {
    console.log(`✅ Seeded ${projects.length} projects\n`)
  }

  // 3. Get capability IDs for suggestions
  const { data: caps } = await supabase
    .from('capabilities')
    .select('id, name')

  const capMap = new Map(caps?.map(c => [c.name, c.id]) || [])

  // 4. Seed project suggestions
  console.log('💡 Seeding project suggestions...')
  const suggestions = [
    {
      user_id: userId,
      title: 'Voice-Annotated Photo Timeline',
      description: 'Combine MemoryOS voice notes with photo metadata to create a spoken memory timeline. Record thoughts while looking at old photos.',
      synthesis_reasoning: 'Combines voice processing capability with image processing. Both systems exist in Aperture - natural integration point.',
      novelty_score: 0.85,
      feasibility_score: 0.90,
      interest_score: 0.65,
      total_points: 78,
      capability_ids: [
        capMap.get('voice-processing'),
        capMap.get('image-processing')
      ].filter(Boolean),
      memory_ids: [],
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: userId,
      title: 'Self-Documenting Creative Portfolio',
      description: 'Automatically generate and update documentation for your creative projects using AI. Tracks progress through git commits and voice notes.',
      synthesis_reasoning: 'Uses autonomous docs system for personal creative work. Interesting crossover between technical and personal domains.',
      novelty_score: 0.70,
      feasibility_score: 0.85,
      interest_score: 0.60,
      total_points: 65,
      capability_ids: [
        capMap.get('documentation-generation'),
        capMap.get('voice-processing')
      ].filter(Boolean),
      memory_ids: [],
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: userId,
      title: 'Face Expression Memory Mapper',
      description: 'Analyze facial expressions in photos and link to memories about those moments. Uses face alignment + embeddings to connect emotions to memories.',
      synthesis_reasoning: 'Novel combination of face detection with semantic memory search. Could reveal patterns in emotional states.',
      novelty_score: 0.92,
      feasibility_score: 0.70,
      interest_score: 0.55,
      total_points: 58,
      capability_ids: [
        capMap.get('face-alignment'),
        capMap.get('embeddings')
      ].filter(Boolean),
      memory_ids: [],
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: userId,
      title: 'Blockchain Art Gallery',
      description: 'Create NFTs of your artwork with voice annotations as metadata. Experimental project combining creative work with web3.',
      synthesis_reasoning: 'WILD CARD - This is outside your usual technical stack. Could be interesting to explore emerging tech.',
      novelty_score: 0.95,
      feasibility_score: 0.30,
      interest_score: 0.25,
      total_points: 42,
      capability_ids: [
        capMap.get('image-processing')
      ].filter(Boolean),
      memory_ids: [],
      is_wildcard: true,
      status: 'pending'
    }
  ]

  const { error: sugError } = await supabase
    .from('project_suggestions')
    .insert(suggestions)

  if (sugError) {
    console.error('❌ Error seeding suggestions:', sugError)
  } else {
    console.log(`✅ Seeded ${suggestions.length} suggestions\n`)
  }

  // 5. Seed node strengths
  console.log('💪 Seeding node strengths...')
  const nodeStrengths = capabilities.map(cap => ({
    node_type: 'capability',
    node_id: capMap.get(cap.name),
    strength: cap.strength,
    activity_count: Math.floor(Math.random() * 10),
    last_activity: new Date().toISOString()
  }))

  const { error: strengthError } = await supabase
    .from('node_strengths')
    .upsert(nodeStrengths, { onConflict: 'node_type,node_id' })

  if (strengthError) {
    console.error('❌ Error seeding node strengths:', strengthError)
  } else {
    console.log(`✅ Seeded ${nodeStrengths.length} node strengths\n`)
  }

  console.log('✨ Test data seeding complete!\n')

  // Print summary
  console.log('📊 Summary:')
  console.log(`  Capabilities: ${capabilities.length}`)
  console.log(`  Projects: ${projects.length}`)
  console.log(`  Suggestions: ${suggestions.length}`)
  console.log(`  Node Strengths: ${nodeStrengths.length}`)
  console.log('\n💡 You can now view suggestions in your app!')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    })
}

export { seedTestData }
