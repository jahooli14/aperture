/**
 * Demo Data API Endpoint
 * Loads template data for new users to explore Polymath
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }

    // 1. Insert demo memories
    const memories = [
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-1`,
        title: 'Late night coding breakthrough',
        body: 'I finally figured out how to optimize the search algorithm. The key was using a trie data structure instead of hash maps. It reduced lookup time from O(n) to O(k) where k is the key length. This could be applied to other projects that need fast prefix matching.',
        orig_transcript: 'I finally figured out how to optimize the search algorithm...',
        tags: ['coding', 'algorithms', 'optimization'],
        audiopen_created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['software-engineering', 'algorithms', 'performance'],
        entities: { people: [], places: ['home'], topics: ['trie data structure', 'optimization', 'search algorithms'] },
        emotional_tone: 'excited',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-2`,
        title: 'Weekend woodworking idea',
        body: 'Thinking about building a standing desk with adjustable height using a hand crank mechanism. Could use reclaimed wood from the old fence. Would need: drill, saw, sander, wood stain. Estimated 2 weekend afternoons to complete.',
        orig_transcript: 'Thinking about building a standing desk...',
        tags: ['woodworking', 'furniture', 'diy'],
        audiopen_created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['woodworking', 'home-projects', 'craftsmanship'],
        entities: { people: [], places: ['workshop', 'backyard'], topics: ['standing desk', 'hand crank', 'reclaimed wood'] },
        emotional_tone: 'creative',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-3`,
        title: 'Parenting observation',
        body: 'Noticed that Emma learns better through hands-on activities rather than verbal explanations. When I showed her how to tie shoes by letting her try with my guidance, she got it much faster than when I just explained the steps. This "learning by doing" approach might work for other skills too.',
        orig_transcript: 'Noticed that Emma learns better through hands-on activities...',
        tags: ['parenting', 'education', 'child-development'],
        audiopen_created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['parenting', 'education', 'child-development'],
        entities: { people: ['Emma'], places: ['home'], topics: ['hands-on learning', 'motor skills', 'teaching methods'] },
        emotional_tone: 'thoughtful',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-4`,
        title: 'Startup financial planning',
        body: 'Need to review Q3 budget allocation. Cloud infrastructure costs are higher than expected - currently at $2.3k/month. Could optimize by moving static assets to CDN and reducing serverless function cold starts. Also exploring tiered pricing model to improve unit economics.',
        orig_transcript: 'Need to review Q3 budget allocation...',
        tags: ['finance', 'startup', 'budgeting'],
        audiopen_created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'event',
        themes: ['finance', 'startups', 'business-strategy'],
        entities: { people: [], places: ['office'], topics: ['budget', 'cloud costs', 'pricing model', 'unit economics'] },
        emotional_tone: 'analytical',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-5`,
        title: 'Photography composition technique',
        body: 'Tried the rule of thirds combined with leading lines today at Golden Gate Park. The pathway photos turned out amazing - the eye naturally follows the path to the subject. This technique could work great for portrait sessions too.',
        orig_transcript: 'Tried the rule of thirds combined with leading lines...',
        tags: ['photography', 'art', 'composition'],
        audiopen_created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['photography', 'visual-arts', 'technique'],
        entities: { people: [], places: ['Golden Gate Park'], topics: ['rule of thirds', 'leading lines', 'composition'] },
        emotional_tone: 'inspired',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-6`,
        title: 'Machine learning model performance',
        body: 'The image classification model hit 94% accuracy after adding data augmentation. Key improvements: random rotation, color jitter, and horizontal flips during training. Validation loss plateaued around epoch 15. Could try transfer learning with ResNet next.',
        orig_transcript: 'The image classification model hit 94% accuracy...',
        tags: ['machine-learning', 'ai', 'computer-vision'],
        audiopen_created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['machine-learning', 'computer-vision', 'software-engineering'],
        entities: { people: [], places: ['home'], topics: ['data augmentation', 'ResNet', 'transfer learning', 'accuracy'] },
        emotional_tone: 'accomplished',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-7`,
        title: 'Meditation practice insight',
        body: 'During today\'s morning meditation, realized that my mind wanders less when I focus on breath counting rather than just observing. Counting up to 10 and then resetting gives my mind something concrete to anchor to. Been practicing for 3 weeks now - noticing better focus during work.',
        orig_transcript: 'During today\'s morning meditation...',
        tags: ['meditation', 'mindfulness', 'wellness'],
        audiopen_created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['mindfulness', 'personal-growth', 'wellness'],
        entities: { people: [], places: ['home'], topics: ['breath counting', 'focus', 'meditation technique'] },
        emotional_tone: 'peaceful',
        processed: true,
        processed_at: new Date().toISOString()
      },
      {
        user_id: userId,
        audiopen_id: `demo-${userId}-8`,
        title: 'Recipe experimentation',
        body: 'Modified the sourdough recipe by reducing hydration from 75% to 70% and it resulted in better oven spring. The crumb structure is more open and the crust is crispier. Also discovered that using a Dutch oven for the first 20 minutes creates amazing steam.',
        orig_transcript: 'Modified the sourdough recipe...',
        tags: ['cooking', 'baking', 'experimentation'],
        audiopen_created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        memory_type: 'insight',
        themes: ['cooking', 'experimentation', 'craftsmanship'],
        entities: { people: [], places: ['kitchen'], topics: ['sourdough', 'hydration', 'oven spring', 'Dutch oven'] },
        emotional_tone: 'satisfied',
        processed: true,
        processed_at: new Date().toISOString()
      }
    ]

    const { data: insertedMemories, error: memError } = await supabase
      .from('memories')
      .insert(memories)
      .select()

    if (memError) throw memError

    // 2. Insert capabilities
    const capabilities = [
      { name: 'react-typescript', description: 'React with TypeScript for type-safe frontend development', source_project: 'polymath', strength: 9.2, code_references: [{ file: 'src/App.tsx' }] },
      { name: 'supabase-backend', description: 'Supabase for database, auth, and real-time features', source_project: 'polymath', strength: 8.7, code_references: [{ file: 'src/lib/supabase.ts' }] },
      { name: 'ai-integration', description: 'Google Gemini AI integration for intelligent suggestions', source_project: 'polymath', strength: 7.9, code_references: [{ file: 'api/synthesis.ts' }] },
      { name: 'woodworking', description: 'Furniture building and woodcraft skills', source_project: 'standing-desk', strength: 6.5, code_references: [] },
      { name: 'photography', description: 'Portrait and landscape photography composition', source_project: 'photo-portfolio', strength: 7.2, code_references: [] },
      { name: 'machine-learning', description: 'Computer vision and ML model training', source_project: 'image-classifier', strength: 8.1, code_references: [{ file: 'train.py' }] }
    ]

    const { data: insertedCaps, error: capError } = await supabase
      .from('capabilities')
      .upsert(capabilities, { onConflict: 'name' })
      .select()

    if (capError) throw capError

    const memoryMap = new Map(insertedMemories.map(m => [m.audiopen_id, m.id]))
    const capMap = new Map(insertedCaps?.map(c => [c.name, c.id]) || [])

    // 3. Insert project suggestions
    const suggestions = [
      {
        user_id: userId,
        title: 'Interactive Learning Platform for Kids',
        description: 'Build an educational web app that uses hands-on interactive exercises rather than passive content. Inspired by Emma\'s learning style - activities where kids manipulate objects, solve puzzles, and experiment.',
        synthesis_reasoning: 'Combines your React/TypeScript capabilities with parenting insights about hands-on learning.',
        novelty_score: 0.82,
        feasibility_score: 0.88,
        interest_score: 0.90,
        total_points: 86,
        capability_ids: [capMap.get('react-typescript'), capMap.get('supabase-backend')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-3`), memoryMap.get(`demo-${userId}-1`)].filter(Boolean),
        is_wildcard: false,
        status: 'pending'
      },
      {
        user_id: userId,
        title: 'Smart Workshop Project Planner',
        description: 'Web app for planning woodworking projects with material calculators, cut list generators, and cost estimators. Track tool inventory and project timeline.',
        synthesis_reasoning: 'Your woodworking interests + software engineering skills.',
        novelty_score: 0.75,
        feasibility_score: 0.85,
        interest_score: 0.88,
        total_points: 82,
        capability_ids: [capMap.get('react-typescript'), capMap.get('woodworking')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-2`)].filter(Boolean),
        is_wildcard: false,
        status: 'spark'
      },
      {
        user_id: userId,
        title: 'SaaS Cost Optimizer Dashboard',
        description: 'Analytics dashboard that tracks cloud infrastructure spending across providers. Auto-detects optimization opportunities.',
        synthesis_reasoning: 'Directly addresses your Q3 budget concerns.',
        novelty_score: 0.70,
        feasibility_score: 0.80,
        interest_score: 0.85,
        total_points: 78,
        capability_ids: [capMap.get('react-typescript')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-4`)].filter(Boolean),
        is_wildcard: false,
        status: 'spark'
      },
      {
        user_id: userId,
        title: 'Photography Composition Analyzer',
        description: 'Upload photos and get AI-powered composition feedback. Learn from your best shots.',
        synthesis_reasoning: 'Bridges your machine learning expertise with photography passion.',
        novelty_score: 0.85,
        feasibility_score: 0.75,
        interest_score: 0.82,
        total_points: 80,
        capability_ids: [capMap.get('machine-learning'), capMap.get('photography')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-5`), memoryMap.get(`demo-${userId}-6`)].filter(Boolean),
        is_wildcard: false,
        status: 'pending'
      },
      {
        user_id: userId,
        title: 'Mindful Coding Timer',
        description: 'Pomodoro timer for developers with meditation breaks. Tracks focus quality and correlation with meditation practice.',
        synthesis_reasoning: 'Personal need identified: meditation improves coding focus.',
        novelty_score: 0.65,
        feasibility_score: 0.95,
        interest_score: 0.75,
        total_points: 76,
        capability_ids: [capMap.get('react-typescript')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-7`)].filter(Boolean),
        is_wildcard: false,
        status: 'pending'
      },
      {
        user_id: userId,
        title: 'Sourdough Experiment Logger',
        description: 'Track bread baking experiments with photos, recipe variations, and outcomes.',
        synthesis_reasoning: 'Your systematic approach to recipe experimentation mirrors your coding process.',
        novelty_score: 0.60,
        feasibility_score: 0.92,
        interest_score: 0.70,
        total_points: 72,
        capability_ids: [capMap.get('react-typescript')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-8`)].filter(Boolean),
        is_wildcard: false,
        status: 'pending'
      },
      {
        user_id: userId,
        title: 'Neural Sourdough Predictor (Wildcard)',
        description: 'Train a deep learning model to predict bread quality from fermentation photos. Completely over-engineered but fascinating.',
        synthesis_reasoning: 'WILD CARD - Absurdly over-engineered for making bread, but unique ML application.',
        novelty_score: 0.98,
        feasibility_score: 0.40,
        interest_score: 0.55,
        total_points: 58,
        capability_ids: [capMap.get('machine-learning')].filter(Boolean),
        memory_ids: [memoryMap.get(`demo-${userId}-8`)].filter(Boolean),
        is_wildcard: true,
        status: 'pending'
      }
    ]

    const { error: sugError } = await supabase
      .from('project_suggestions')
      .insert(suggestions)

    if (sugError) throw sugError

    // 4. Insert projects
    const projects = [
      {
        user_id: userId,
        title: 'Standing Desk Build',
        description: 'Adjustable height standing desk made from reclaimed fence wood with hand crank mechanism',
        type: 'personal',
        status: 'completed',
        last_active: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { capabilities: ['woodworking'], tags: ['furniture', 'diy'], progress: 100, next_step: 'Project complete! Add finish/stain for protection.' }
      },
      {
        user_id: userId,
        title: 'Portfolio Website Redesign',
        description: 'Updated personal photography portfolio with new composition showcase section',
        type: 'technical',
        status: 'active',
        last_active: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { capabilities: ['react-typescript', 'photography'], tags: ['web-development', 'portfolio'], progress: 65, next_step: 'Add leading lines gallery section, deploy to production' }
      },
      {
        user_id: userId,
        title: 'Image Classifier Model',
        description: 'Computer vision model for categorizing landscape vs portrait photography',
        type: 'technical',
        status: 'active',
        last_active: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { capabilities: ['machine-learning', 'photography'], tags: ['ml', 'computer-vision'], progress: 80, next_step: 'Try transfer learning with ResNet architecture' }
      },
      {
        user_id: userId,
        title: 'Morning Meditation Routine',
        description: '10 minute daily meditation practice with breath counting technique',
        type: 'personal',
        status: 'active',
        last_active: new Date().toISOString(),
        metadata: { tags: ['meditation', 'mindfulness'], progress: 40, next_step: 'Increase to 15 minutes, try guided sessions' }
      }
    ]

    const { error: projError } = await supabase
      .from('projects')
      .insert(projects)

    if (projError) throw projError

    return res.status(200).json({
      success: true,
      counts: {
        memories: memories.length,
        suggestions: suggestions.length,
        projects: projects.length
      }
    })
  } catch (error) {
    console.error('Error loading demo data:', error)
    return res.status(500).json({ error: 'Failed to load demo data' })
  }
}
