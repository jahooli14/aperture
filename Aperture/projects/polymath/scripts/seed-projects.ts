/**
 * Seed Projects Script
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const userId = process.env.USER_ID || 'default-user'

async function seedProjects() {
  console.log('🎨 Seeding projects...\n')

  const projects = [
    {
      user_id: userId,
      title: 'Watercolor portrait series',
      description: 'Practicing watercolor techniques with focus on facial features and expressions',
      type: 'personal',
      status: 'active',
      last_active: new Date().toISOString(),
      metadata: {
        tags: ['art', 'watercolor', 'portraits'],
        energy_level: 'medium'
      }
    },
    {
      user_id: userId,
      title: 'Guitar fingerpicking mastery',
      description: 'Daily 30min practice - working through classical pieces',
      type: 'personal',
      status: 'active',
      last_active: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        tags: ['music', 'guitar'],
        energy_level: 'low'
      }
    },
    {
      user_id: userId,
      title: 'MemoryOS enhancement',
      description: 'Adding semantic search and better entity extraction',
      type: 'technical',
      status: 'active',
      last_active: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        tags: ['ai', 'embeddings', 'voice'],
        energy_level: 'high'
      }
    },
    {
      user_id: userId,
      title: 'Short story collection',
      description: 'Writing sci-fi stories about AI consciousness',
      type: 'personal',
      status: 'dormant',
      last_active: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        tags: ['writing', 'fiction', 'sci-fi'],
        energy_level: 'high'
      }
    },
    {
      user_id: userId,
      title: 'Wizard of Oz face alignment',
      description: 'Baby photo app - completed face detection system',
      type: 'technical',
      status: 'completed',
      last_active: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        tags: ['computer-vision', 'images'],
        energy_level: 'high'
      }
    }
  ]

  const { data, error } = await supabase
    .from('projects')
    .insert(projects)
    .select()

  if (error) {
    console.error('❌ Error seeding projects:', error)
    throw error
  }

  console.log(`✅ Successfully seeded ${data.length} projects\n`)
  console.log('📊 Project breakdown:')
  console.log(`  Active: ${projects.filter(p => p.status === 'active').length}`)
  console.log(`  Dormant: ${projects.filter(p => p.status === 'dormant').length}`)
  console.log(`  Completed: ${projects.filter(p => p.status === 'completed').length}`)

  console.log('\n✨ Projects seeded successfully!')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedProjects()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    })
}
