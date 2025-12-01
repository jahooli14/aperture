/**
 * Node Strengthening Script
 * Tracks git activity and strengthens capability/project nodes accordingly
 * Runs daily to update node strengths based on actual usage
 */

import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CONFIG = {
  CAPABILITY_INCREMENT: 0.1, // Strength boost per use
  PROJECT_INCREMENT: 0.2, // Strength boost for active projects
  DECAY_RATE: 0.95, // Weekly decay multiplier (5% per week)
  LOOKBACK_HOURS: 24, // How far back to check git commits
  APERTURE_PATH: process.env.APERTURE_PATH || '/Users/dancroome-horgan/Documents/GitHub/Aperture',
}

interface GitCommit {
  hash: string
  author: string
  date: Date
  message: string
  files: string[]
}

interface ProjectMapping {
  name: string
  path: string
  capabilities: string[]
}

// Map file paths to projects and capabilities
const PROJECT_MAPPINGS: ProjectMapping[] = [
  {
    name: 'memory-os',
    path: 'projects/memory-os',
    capabilities: ['voice-processing', 'embeddings', 'knowledge-graph', 'pgvector-search', 'bridge-finding', 'async-processing']
  },
  {
    name: 'wizard-of-oz',
    path: 'projects/wizard-of-oz',
    capabilities: ['face-alignment', 'image-processing', 'supabase-storage']
  },
  {
    name: 'polymath',
    path: 'projects/polymath',
    capabilities: ['creative-synthesis', 'point-allocation', 'diversity-injection']
  },
  {
    name: 'autonomous-docs',
    path: 'scripts/autonomous-docs',
    capabilities: ['documentation-generation', 'knowledge-updates', 'web-scraping']
  },
  {
    name: 'self-healing-tests',
    path: 'scripts/self-healing-tests',
    capabilities: ['test-repair', 'test-analysis']
  }
]

/**
 * Get recent git commits
 */
async function getRecentCommits(sinceHours: number = CONFIG.LOOKBACK_HOURS): Promise<GitCommit[]> {
  console.log(`📜 Fetching git commits from last ${sinceHours} hours...`)

  const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
  const sinceISO = sinceDate.toISOString()

  try {
    // Get commit hashes
    const { stdout: hashesOutput } = await execAsync(
      `git log --since="${sinceISO}" --format=%H`,
      { cwd: CONFIG.APERTURE_PATH }
    )

    const hashes = hashesOutput.trim().split('\n').filter(Boolean)

    if (hashes.length === 0) {
      console.log('  No commits found in time range')
      return []
    }

    console.log(`  Found ${hashes.length} commits`)

    // Get commit details
    const commits: GitCommit[] = []

    for (const hash of hashes) {
      // Get commit info
      const { stdout: infoOutput } = await execAsync(
        `git show --format=%an%n%aI%n%s --no-patch ${hash}`,
        { cwd: CONFIG.APERTURE_PATH }
      )

      const [author, date, message] = infoOutput.trim().split('\n')

      // Get changed files
      const { stdout: filesOutput } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { cwd: CONFIG.APERTURE_PATH }
      )

      const files = filesOutput.trim().split('\n').filter(Boolean)

      commits.push({
        hash,
        author,
        date: new Date(date),
        message,
        files
      })
    }

    return commits

  } catch (error) {
    console.error('❌ Error fetching git commits:', error)
    return []
  }
}

/**
 * Map files to project
 */
function inferProject(files: string[]): ProjectMapping | null {
  for (const mapping of PROJECT_MAPPINGS) {
    const matchingFiles = files.filter(f => f.startsWith(mapping.path))
    if (matchingFiles.length > 0) {
      return mapping
    }
  }
  return null
}

/**
 * Get or create project in database
 */
async function getOrCreateProject(projectName: string): Promise<string | null> {
  // Check if project exists
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('title', projectName)
    .eq('type', 'technical')
    .single()

  if (existing) {
    return existing.id
  }

  // Create project if it doesn't exist
  const projectDescriptions: Record<string, string> = {
    'memory-os': 'Voice-to-memory personal knowledge graph with bridge-finding',
    'wizard-of-oz': 'Baby photo app with face alignment',
    'polymath': 'Creative synthesis engine for project ideas',
    'autonomous-docs': 'Self-optimizing documentation system',
    'self-healing-tests': 'Automated test repair system'
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      title: projectName,
      description: projectDescriptions[projectName] || `Technical project: ${projectName}`,
      type: 'side-project',
      status: 'active',
      user_id: process.env.USER_ID || 'default-user'
    })
    .select('id')
    .single()

  if (error) {
    console.error(`❌ Error creating project ${projectName}:`, error)
    return null
  }

  console.log(`  ✓ Created project: ${projectName}`)
  return newProject.id
}

/**
 * Get capability ID by name
 */
async function getCapabilityId(capabilityName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('capabilities')
    .select('id')
    .eq('name', capabilityName)
    .single()

  if (error || !data) {
    console.warn(`  ⚠️  Capability not found: ${capabilityName}`)
    return null
  }

  return data.id
}

/**
 * Increment node strength
 */
async function incrementNodeStrength(
  nodeType: 'capability' | 'project',
  nodeId: string,
  increment: number
) {
  // Get current strength
  const { data: existing } = await supabase
    .from('node_strengths')
    .select('strength, activity_count')
    .eq('node_type', nodeType)
    .eq('node_id', nodeId)
    .single()

  const currentStrength = existing?.strength || 1.0
  const currentCount = existing?.activity_count || 0

  const newStrength = currentStrength + increment
  const newCount = currentCount + 1

  // Upsert node strength
  const { error } = await supabase
    .from('node_strengths')
    .upsert({
      node_type: nodeType,
      node_id: nodeId,
      strength: newStrength,
      activity_count: newCount,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'node_type,node_id'
    })

  if (error) {
    console.error(`❌ Error updating node strength:`, error)
    return
  }

  // Also update capabilities table if it's a capability
  if (nodeType === 'capability') {
    await supabase
      .from('capabilities')
      .update({
        strength: newStrength,
        last_used: new Date().toISOString()
      })
      .eq('id', nodeId)
  }

  // Also update projects table if it's a project
  if (nodeType === 'project') {
    await supabase
      .from('projects')
      .update({
        last_active: new Date().toISOString()
      })
      .eq('id', nodeId)
  }

  return { oldStrength: currentStrength, newStrength }
}

/**
 * Apply decay to inactive nodes
 */
async function applyDecay() {
  console.log('\n📉 Applying decay to inactive nodes...')

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Get nodes not active in last week
  const { data: inactiveNodes } = await supabase
    .from('node_strengths')
    .select('*')
    .lt('last_activity', oneWeekAgo.toISOString())

  if (!inactiveNodes || inactiveNodes.length === 0) {
    console.log('  No inactive nodes to decay')
    return
  }

  console.log(`  Decaying ${inactiveNodes.length} inactive nodes...`)

  for (const node of inactiveNodes) {
    const newStrength = Math.max(0.1, node.strength * CONFIG.DECAY_RATE)

    await supabase
      .from('node_strengths')
      .update({
        strength: newStrength,
        updated_at: new Date().toISOString()
      })
      .eq('id', node.id)

    // Update capabilities table too
    if (node.node_type === 'capability') {
      await supabase
        .from('capabilities')
        .update({ strength: newStrength })
        .eq('id', node.node_id)
    }
  }

  console.log(`  ✓ Decayed ${inactiveNodes.length} nodes`)
}

/**
 * Main strengthening function
 */
export async function strengthenNodes(sinceHours: number = CONFIG.LOOKBACK_HOURS) {
  console.log('💪 Starting node strengthening...\n')

  // Get recent commits
  const commits = await getRecentCommits(sinceHours)

  if (commits.length === 0) {
    console.log('✅ No recent activity, skipping strengthening\n')
    return
  }

  const updates: Array<{
    nodeType: 'capability' | 'project'
    nodeId: string
    oldStrength: number
    newStrength: number
  }> = []

  // Process each commit
  for (const commit of commits) {
    console.log(`\n🔨 Processing commit: ${commit.hash.slice(0, 7)} - "${commit.message}"`)

    // Infer project from files
    const project = inferProject(commit.files)

    if (!project) {
      console.log('  ⏭️  No matching project found')
      continue
    }

    console.log(`  📁 Project: ${project.name}`)

    // Get or create project in database
    const projectId = await getOrCreateProject(project.name)

    if (!projectId) {
      continue
    }

    // Strengthen project node
    const projectUpdate = await incrementNodeStrength(
      'project',
      projectId,
      CONFIG.PROJECT_INCREMENT
    )

    if (projectUpdate) {
      console.log(`  ✓ Strengthened project node: ${projectUpdate.oldStrength.toFixed(1)} → ${projectUpdate.newStrength.toFixed(1)}`)
      updates.push({
        nodeType: 'project',
        nodeId: projectId,
        ...projectUpdate
      })
    }

    // Strengthen capability nodes
    for (const capabilityName of project.capabilities) {
      const capabilityId = await getCapabilityId(capabilityName)

      if (!capabilityId) {
        continue
      }

      const capUpdate = await incrementNodeStrength(
        'capability',
        capabilityId,
        CONFIG.CAPABILITY_INCREMENT
      )

      if (capUpdate) {
        console.log(`  ✓ Strengthened capability "${capabilityName}": ${capUpdate.oldStrength.toFixed(1)} → ${capUpdate.newStrength.toFixed(1)}`)
        updates.push({
          nodeType: 'capability',
          nodeId: capabilityId,
          ...capUpdate
        })
      }
    }
  }

  // Apply decay to inactive nodes (optional - run weekly)
  const now = new Date()
  if (now.getDay() === 1 && now.getHours() === 0) { // Monday midnight
    await applyDecay()
  }

  console.log(`\n✅ Strengthening complete! Updated ${updates.length} nodes\n`)

  return updates
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const sinceHours = parseInt(process.argv[2]) || CONFIG.LOOKBACK_HOURS

  strengthenNodes(sinceHours)
    .then((updates) => {
      console.log(`✨ Node strengthening complete! ${updates?.length || 0} updates`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Node strengthening failed:', error)
      process.exit(1)
    })
}
