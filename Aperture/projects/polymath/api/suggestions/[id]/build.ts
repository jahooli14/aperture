/**
 * Build Suggestion API Endpoint
 * Creates a project from a suggestion
 * Copy to: projects/memory-os/api/suggestions/[id]/build.ts
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

  const { id } = req.query
  const {
    project_title,
    project_description,
    metadata = {}
  } = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Suggestion ID required' })
  }

  try {
    // 1. Get suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('project_suggestions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Suggestion not found' })
      }
      return res.status(500).json({ error: fetchError.message })
    }

    // 2. Create project from suggestion
    const userId = process.env.USER_ID || 'default-user'

    // Determine project type from capabilities or metadata
    const hasCapabilities = suggestion.capability_ids && suggestion.capability_ids.length > 0
    const defaultType = hasCapabilities ? 'technical' : 'creative'
    const projectType = metadata.type || defaultType

    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: project_title || suggestion.title,
        description: project_description || suggestion.description,
        type: projectType,
        status: 'active',
        last_active: new Date().toISOString(),
        metadata: {
          ...metadata,
          from_suggestion: id,
          capabilities: suggestion.capability_ids,
          original_points: suggestion.total_points
        }
      })
      .select()
      .single()

    if (createError) {
      console.error('[build] Project creation error:', createError)
      return res.status(500).json({ error: createError.message })
    }

    // 3. Update suggestion
    const { error: updateError } = await supabase
      .from('project_suggestions')
      .update({
        status: 'built',
        built_project_id: project.id
      })
      .eq('id', id)

    if (updateError) {
      console.error('[build] Suggestion update error:', updateError)
      // Don't fail - project was created successfully
    }

    // 4. Add automatic +2 rating
    await supabase
      .from('suggestion_ratings')
      .insert({
        suggestion_id: id,
        user_id: userId,
        rating: 2,
        feedback: 'Built this project!'
      })

    // 5. Significantly boost capability strengths
    for (const capabilityId of suggestion.capability_ids) {
      await incrementCapabilityStrength(capabilityId, 0.3) // 3x normal boost
    }

    // 6. Create project node strength entry
    await supabase
      .from('node_strengths')
      .insert({
        node_type: 'project',
        node_id: project.id,
        strength: 1.5, // Start higher for built projects
        activity_count: 1,
        last_activity: new Date().toISOString()
      })

    console.log(`[build] Built project ${project.id} from suggestion ${id}`)

    return res.status(201).json({
      success: true,
      project,
      suggestion: {
        id: suggestion.id,
        status: 'built',
        built_project_id: project.id
      }
    })

  } catch (error) {
    console.error('[build] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Increment capability strength
 */
async function incrementCapabilityStrength(capabilityId: string, increment: number) {
  const { data: capability } = await supabase
    .from('capabilities')
    .select('strength')
    .eq('id', capabilityId)
    .single()

  if (!capability) return

  const newStrength = capability.strength + increment

  await supabase
    .from('capabilities')
    .update({
      strength: newStrength,
      last_used: new Date().toISOString()
    })
    .eq('id', capabilityId)

  await supabase
    .from('node_strengths')
    .upsert({
      node_type: 'capability',
      node_id: capabilityId,
      strength: newStrength,
      activity_count: 1,
      last_activity: new Date().toISOString()
    }, {
      onConflict: 'node_type,node_id'
    })
}
