#!/usr/bin/env tsx
/**
 * Extract User Capabilities Script
 *
 * Scans user data (Projects, Thoughts, Reading) to extract capabilities/interests
 * using Gemini.
 *
 * Usage:
 *   npm run extract:capabilities
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
// Note: Assuming _lib is the correct folder based on directory listing
import { generateText } from '../api/_lib/gemini-chat.js' 
import { generateEmbedding } from '../api/_lib/gemini-embeddings.js'

const url = process.env.VITE_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceRoleKey)

async function extractCapabilities() {
  console.log('🔍 Scanning user data for capabilities...')

  // 1. Fetch Data
  const { data: projects } = await supabase
    .from('projects')
    .select('title, description')
    .limit(20)
    .order('created_at', { ascending: false })

  const { data: memories } = await supabase
    .from('memories')
    .select('title, body')
    .limit(20)
    .order('created_at', { ascending: false })

  const items = [
    ...(projects || []).map(p => `Project: ${p.title}\n${p.description || ''}`),
    ...(memories || []).map(m => `Thought: ${m.title || ''}\n${m.body}`)
  ].join('\n\n')

  if (!items) {
    console.log('No data found to analyze.')
    return
  }

  console.log(`Analyzing ${items.length} chars of content...`)

  // 2. Prompt Gemini
  const prompt = `Analyze the following user projects and thoughts. 
  Extract a list of "Capabilities" (skills, tools, concepts, mental models, or specific interests) that this user demonstrates.
  
  Return a JSON array of objects with this structure:
  {
    "name": "kebab-case-name",
    "description": "Brief description of the capability and how the user uses it.",
    "source": "project" or "thought" (infer primary source)
  }
  
  Focus on specific, actionable capabilities (e.g., "react-development", "system-design", "creative-writing") rather than generic ones.
  
  Content:
  ${items}`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.2 })
    const capabilities = JSON.parse(response)
    
    if (!Array.isArray(capabilities)) {
      throw new Error('Invalid API response format')
    }

    console.log(`Found ${capabilities.length} potential capabilities.`) 

    // 3. Process and Store
    for (const cap of capabilities) {
      console.log(`Processing: ${cap.name}`)
      
      // Generate embedding
      const embedding = await generateEmbedding(`${cap.name}: ${cap.description}`)

      // Upsert
      const { error } = await supabase
        .from('capabilities')
        .upsert({
          name: cap.name,
          description: cap.description,
          source_project: 'user-extracted', // Distinguish from codebase scan
          strength: 1.0, // Default strength
          embedding,
          last_used: new Date().toISOString()
        }, {
          onConflict: 'name'
        })

      if (error) {
        console.error(`Failed to save ${cap.name}:`, error.message)
      } else {
        console.log(`✅ Saved ${cap.name}`)
      }
    }

    console.log('✨ Capability extraction complete.')

  } catch (error) {
    console.error('Extraction failed:', error)
  }
}

extractCapabilities()
