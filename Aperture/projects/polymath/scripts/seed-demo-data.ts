/**
 * Seed Demo Data Script
 * Creates compelling template data for demos that showcases Polymath's capabilities
 * Users can easily clear this and replace with their own data
 *
 * Run: npx tsx scripts/seed-demo-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_USER_ID = process.env.USER_ID || 'demo-user'

async function seedDemoData() {
  console.log('🎭 Seeding demo data for Polymath...\n')

  // 1. Seed demo memories (voice notes)
  console.log('🧠 Seeding demo memories...')
  const memories = [
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-1',
      title: 'Late night coding breakthrough',
      body: 'I finally figured out how to optimize the search algorithm. The key was using a trie data structure instead of hash maps. It reduced lookup time from O(n) to O(k) where k is the key length. This could be applied to other projects that need fast prefix matching.',
      orig_transcript: 'I finally figured out how to optimize the search algorithm...',
      tags: ['coding', 'algorithms', 'optimization'],
      audiopen_created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['software-engineering', 'algorithms', 'performance'],
      entities: {
        people: [],
        places: ['home'],
        topics: ['trie data structure', 'optimization', 'search algorithms']
      },
      emotional_tone: 'excited',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-2',
      title: 'Weekend woodworking idea',
      body: 'Thinking about building a standing desk with adjustable height using a hand crank mechanism. Could use reclaimed wood from the old fence. Would need: drill, saw, sander, wood stain. Estimated 2 weekend afternoons to complete.',
      orig_transcript: 'Thinking about building a standing desk...',
      tags: ['woodworking', 'furniture', 'diy'],
      audiopen_created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['woodworking', 'home-projects', 'craftsmanship'],
      entities: {
        people: [],
        places: ['workshop', 'backyard'],
        topics: ['standing desk', 'hand crank', 'reclaimed wood']
      },
      emotional_tone: 'creative',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-3',
      title: 'Parenting observation',
      body: 'Noticed that Emma learns better through hands-on activities rather than verbal explanations. When I showed her how to tie shoes by letting her try with my guidance, she got it much faster than when I just explained the steps. This "learning by doing" approach might work for other skills too.',
      orig_transcript: 'Noticed that Emma learns better through hands-on activities...',
      tags: ['parenting', 'education', 'child-development'],
      audiopen_created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['parenting', 'education', 'child-development'],
      entities: {
        people: ['Emma'],
        places: ['home'],
        topics: ['hands-on learning', 'motor skills', 'teaching methods']
      },
      emotional_tone: 'thoughtful',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-4',
      title: 'Startup financial planning',
      body: 'Need to review Q3 budget allocation. Cloud infrastructure costs are higher than expected - currently at $2.3k/month. Could optimize by moving static assets to CDN and reducing serverless function cold starts. Also exploring tiered pricing model to improve unit economics.',
      orig_transcript: 'Need to review Q3 budget allocation...',
      tags: ['finance', 'startup', 'budgeting'],
      audiopen_created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'event' as const,
      themes: ['finance', 'startups', 'business-strategy'],
      entities: {
        people: [],
        places: ['office'],
        topics: ['budget', 'cloud costs', 'pricing model', 'unit economics']
      },
      emotional_tone: 'analytical',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-5',
      title: 'Photography composition technique',
      body: 'Tried the rule of thirds combined with leading lines today at Golden Gate Park. The pathway photos turned out amazing - the eye naturally follows the path to the subject. This technique could work great for portrait sessions too.',
      orig_transcript: 'Tried the rule of thirds combined with leading lines...',
      tags: ['photography', 'art', 'composition'],
      audiopen_created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['photography', 'visual-arts', 'technique'],
      entities: {
        people: [],
        places: ['Golden Gate Park'],
        topics: ['rule of thirds', 'leading lines', 'composition']
      },
      emotional_tone: 'inspired',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-6',
      title: 'Machine learning model performance',
      body: 'The image classification model hit 94% accuracy after adding data augmentation. Key improvements: random rotation, color jitter, and horizontal flips during training. Validation loss plateaued around epoch 15. Could try transfer learning with ResNet next.',
      orig_transcript: 'The image classification model hit 94% accuracy...',
      tags: ['machine-learning', 'ai', 'computer-vision'],
      audiopen_created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['machine-learning', 'computer-vision', 'software-engineering'],
      entities: {
        people: [],
        places: ['home'],
        topics: ['data augmentation', 'ResNet', 'transfer learning', 'accuracy']
      },
      emotional_tone: 'accomplished',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-7',
      title: 'Meditation practice insight',
      body: 'During today\'s morning meditation, realized that my mind wanders less when I focus on breath counting rather than just observing. Counting up to 10 and then resetting gives my mind something concrete to anchor to. Been practicing for 3 weeks now - noticing better focus during work.',
      orig_transcript: 'During today\'s morning meditation...',
      tags: ['meditation', 'mindfulness', 'wellness'],
      audiopen_created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['mindfulness', 'personal-growth', 'wellness'],
      entities: {
        people: [],
        places: ['home'],
        topics: ['breath counting', 'focus', 'meditation technique']
      },
      emotional_tone: 'peaceful',
      processed: true,
      processed_at: new Date().toISOString()
    },
    {
      user_id: DEMO_USER_ID,
      audiopen_id: 'demo-memory-8',
      title: 'Recipe experimentation',
      body: 'Modified the sourdough recipe by reducing hydration from 75% to 70% and it resulted in better oven spring. The crumb structure is more open and the crust is crispier. Also discovered that using a Dutch oven for the first 20 minutes creates amazing steam.',
      orig_transcript: 'Modified the sourdough recipe...',
      tags: ['cooking', 'baking', 'experimentation'],
      audiopen_created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      memory_type: 'insight' as const,
      themes: ['cooking', 'experimentation', 'craftsmanship'],
      entities: {
        people: [],
        places: ['kitchen'],
        topics: ['sourdough', 'hydration', 'oven spring', 'Dutch oven']
      },
      emotional_tone: 'satisfied',
      processed: true,
      processed_at: new Date().toISOString()
    }
  ]

  const { data: insertedMemories, error: memError } = await supabase
    .from('memories')
    .insert(memories)
    .select()

  if (memError) {
    console.error('❌ Error seeding memories:', memError)
    return
  }
  console.log(`✅ Seeded ${memories.length} demo memories\n`)

  // 2. Seed capabilities (extracted from existing projects)
  console.log('📦 Seeding capabilities...')
  const capabilities = [
    {
      name: 'react-typescript',
      description: 'React with TypeScript for type-safe frontend development',
      source_project: 'polymath',
      strength: 9.2,
      code_references: [{ file: 'src/App.tsx' }]
    },
    {
      name: 'supabase-backend',
      description: 'Supabase for database, auth, and real-time features',
      source_project: 'polymath',
      strength: 8.7,
      code_references: [{ file: 'src/lib/supabase.ts' }]
    },
    {
      name: 'ai-integration',
      description: 'Google Gemini AI integration for intelligent suggestions',
      source_project: 'polymath',
      strength: 7.9,
      code_references: [{ file: 'api/synthesis.ts' }]
    },
    {
      name: 'woodworking',
      description: 'Furniture building and woodcraft skills',
      source_project: 'standing-desk',
      strength: 6.5,
      code_references: []
    },
    {
      name: 'photography',
      description: 'Portrait and landscape photography composition',
      source_project: 'photo-portfolio',
      strength: 7.2,
      code_references: []
    },
    {
      name: 'machine-learning',
      description: 'Computer vision and ML model training',
      source_project: 'image-classifier',
      strength: 8.1,
      code_references: [{ file: 'train.py' }]
    }
  ]

  const { data: insertedCaps, error: capError } = await supabase
    .from('capabilities')
    .upsert(capabilities, { onConflict: 'name' })
    .select()

  if (capError) {
    console.error('❌ Error seeding capabilities:', capError)
    return
  }
  console.log(`✅ Seeded ${capabilities.length} capabilities\n`)

  // Get memory IDs for linking
  const memoryMap = new Map(
    insertedMemories.map(m => [m.audiopen_id, m.id])
  )

  // Get capability IDs for linking
  const capMap = new Map(
    insertedCaps?.map(c => [c.name, c.id]) || []
  )

  // 3. Seed project suggestions (AI-generated from memories)
  console.log('💡 Seeding project suggestions...')
  const suggestions = [
    {
      user_id: DEMO_USER_ID,
      title: 'Interactive Learning Platform for Kids',
      description: 'Build an educational web app that uses hands-on interactive exercises rather than passive content. Inspired by Emma\'s learning style - activities where kids manipulate objects, solve puzzles, and experiment. Could include visual programming blocks, interactive math games, and science simulations.',
      synthesis_reasoning: 'Combines your React/TypeScript capabilities with parenting insights about hands-on learning. Your technical skills + understanding of child development = practical educational tool.',
      novelty_score: 0.82,
      feasibility_score: 0.88,
      interest_score: 0.90,
      total_points: 86,
      capability_ids: [
        capMap.get('react-typescript'),
        capMap.get('supabase-backend')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-3'),
        memoryMap.get('demo-memory-1')
      ].filter(Boolean),
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Smart Workshop Project Planner',
      description: 'Web app for planning woodworking projects with material calculators, cut list generators, and cost estimators. Upload project sketches, get optimized cutting patterns to minimize waste. Track tool inventory and project timeline.',
      synthesis_reasoning: 'Your woodworking interests + software engineering skills. The standing desk project showed you think systematically about materials and time. This tool could help you and others plan better.',
      novelty_score: 0.75,
      feasibility_score: 0.85,
      interest_score: 0.88,
      total_points: 82,
      capability_ids: [
        capMap.get('react-typescript'),
        capMap.get('woodworking')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-2')
      ].filter(Boolean),
      is_wildcard: false,
      status: 'spark'
    },
    {
      user_id: DEMO_USER_ID,
      title: 'SaaS Cost Optimizer Dashboard',
      description: 'Analytics dashboard that tracks cloud infrastructure spending across providers. Auto-detects optimization opportunities (unused resources, oversized instances, cold start issues). Provides tiered pricing model calculators for unit economics.',
      synthesis_reasoning: 'Directly addresses your Q3 budget concerns. Your experience with cloud costs + technical skills = tool that could save thousands monthly. High personal utility, potential SaaS product.',
      novelty_score: 0.70,
      feasibility_score: 0.80,
      interest_score: 0.85,
      total_points: 78,
      capability_ids: [
        capMap.get('react-typescript'),
        capMap.get('supabase-backend')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-4')
      ].filter(Boolean),
      is_wildcard: false,
      status: 'spark'
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Photography Composition Analyzer',
      description: 'Upload photos and get AI-powered composition feedback. Detects rule of thirds alignment, leading lines, balance, and symmetry. Learn from your best shots - shows what makes them work. Could use your ML + photography knowledge.',
      synthesis_reasoning: 'Bridges your machine learning expertise with photography passion. Your image classification experience + composition insights = practical learning tool for photographers.',
      novelty_score: 0.85,
      feasibility_score: 0.75,
      interest_score: 0.82,
      total_points: 80,
      capability_ids: [
        capMap.get('machine-learning'),
        capMap.get('photography'),
        capMap.get('ai-integration')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-5'),
        memoryMap.get('demo-memory-6')
      ].filter(Boolean),
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Mindful Coding Timer',
      description: 'Pomodoro timer specifically for developers with meditation breaks. After 25min coding, guided 5min breathing exercises. Tracks focus quality and correlation with meditation practice. Your 3-week meditation insight + dev workflow = better sustained attention.',
      synthesis_reasoning: 'Personal need identified: meditation improves coding focus. This tool creates the feedback loop between practice and performance. Low lift, high impact for daily workflow.',
      novelty_score: 0.65,
      feasibility_score: 0.95,
      interest_score: 0.75,
      total_points: 76,
      capability_ids: [
        capMap.get('react-typescript')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-7'),
        memoryMap.get('demo-memory-1')
      ].filter(Boolean),
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Sourdough Experiment Logger',
      description: 'Track bread baking experiments with photos, recipe variations, and outcomes. Input hydration %, fermentation time, baking temp - get insights on what produces best results. Build your personal sourdough knowledge graph.',
      synthesis_reasoning: 'Your systematic approach to recipe experimentation mirrors your coding process. Database skills + baking hobby = tool that helps iterate toward perfection. Shareable recipes too.',
      novelty_score: 0.60,
      feasibility_score: 0.92,
      interest_score: 0.70,
      total_points: 72,
      capability_ids: [
        capMap.get('react-typescript'),
        capMap.get('supabase-backend')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-8')
      ].filter(Boolean),
      is_wildcard: false,
      status: 'pending'
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Neural Sourdough Predictor (Wildcard)',
      description: 'Train a deep learning model to predict bread quality from fermentation photos. Time-lapse camera + computer vision detects bubble formation patterns. Alerts when dough is ready to bake. Completely over-engineered but fascinating ML application.',
      synthesis_reasoning: 'WILD CARD - This is absurdly over-engineered for making bread, but it combines ML + baking in a unique way. Low practical value, high fun factor. Your image classification skills applied to... dough.',
      novelty_score: 0.98,
      feasibility_score: 0.40,
      interest_score: 0.55,
      total_points: 58,
      capability_ids: [
        capMap.get('machine-learning')
      ].filter(Boolean),
      memory_ids: [
        memoryMap.get('demo-memory-8'),
        memoryMap.get('demo-memory-6')
      ].filter(Boolean),
      is_wildcard: true,
      status: 'pending'
    }
  ]

  const { error: sugError } = await supabase
    .from('project_suggestions')
    .insert(suggestions)

  if (sugError) {
    console.error('❌ Error seeding suggestions:', sugError)
    return
  }
  console.log(`✅ Seeded ${suggestions.length} project suggestions\n`)

  // 4. Seed demo projects (some built, some in progress)
  console.log('🚀 Seeding demo projects...')
  const projects = [
    {
      user_id: DEMO_USER_ID,
      title: 'Standing Desk Build',
      description: 'Adjustable height standing desk made from reclaimed fence wood with hand crank mechanism',
      type: 'personal',
      status: 'completed',
      last_active: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        capabilities: ['woodworking'],
        tags: ['furniture', 'diy', 'woodworking'],
        energy_level: 'high',
        progress: 100,
        next_step: 'Project complete! Add finish/stain for protection.'
      }
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Portfolio Website Redesign',
      description: 'Updated personal photography portfolio with new composition showcase section',
      type: 'technical',
      status: 'active',
      last_active: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        capabilities: ['react-typescript', 'photography'],
        tags: ['web-development', 'portfolio', 'photography'],
        energy_level: 'medium',
        progress: 65,
        next_step: 'Add leading lines gallery section, deploy to production'
      }
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Image Classifier Model',
      description: 'Computer vision model for categorizing landscape vs portrait photography',
      type: 'technical',
      status: 'active',
      last_active: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        capabilities: ['machine-learning', 'photography'],
        tags: ['machine-learning', 'computer-vision', 'photography'],
        energy_level: 'high',
        progress: 80,
        next_step: 'Try transfer learning with ResNet architecture'
      }
    },
    {
      user_id: DEMO_USER_ID,
      title: 'Morning Meditation Routine',
      description: '10 minute daily meditation practice with breath counting technique',
      type: 'personal',
      status: 'active',
      last_active: new Date().toISOString(),
      metadata: {
        tags: ['meditation', 'mindfulness', 'wellness'],
        energy_level: 'low',
        progress: 40,
        next_step: 'Increase to 15 minutes, try guided sessions'
      }
    }
  ]

  const { error: projError } = await supabase
    .from('projects')
    .insert(projects)

  if (projError) {
    console.error('❌ Error seeding projects:', projError)
    return
  }
  console.log(`✅ Seeded ${projects.length} demo projects\n`)

  console.log('✨ Demo data seeding complete!\n')
  console.log('📊 Summary:')
  console.log(`  Memories: ${memories.length} (spanning multiple themes)`)
  console.log(`  Capabilities: ${capabilities.length} (technical + personal)`)
  console.log(`  Suggestions: ${suggestions.length} (including 2 sparks, 1 wildcard)`)
  console.log(`  Projects: ${projects.length} (1 completed, 3 active)`)
  console.log('\n🎭 This data demonstrates:')
  console.log('  ✓ Voice note memories with diverse themes')
  console.log('  ✓ Cross-domain synthesis (tech + hobbies)')
  console.log('  ✓ Memory → Suggestion → Project lineage')
  console.log('  ✓ Active projects in various stages')
  console.log('\n💡 User can clear template data via "Reset Demo Data" button')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    })
}

export { seedDemoData }
