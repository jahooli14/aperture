import { createClient } from '@supabase/supabase-js'
import type { Memory } from '../types'
import { extractMetadata, generateEmbedding } from './gemini'
import { findBridges, storeBridges } from './bridges'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Process a raw memory: extract metadata, generate embedding, find bridges
 */
export async function processMemory(memoryId: string): Promise<void> {
  console.log(`[process] Starting processing for memory ${memoryId}`)

  try {
    // 1. Fetch memory
    const { data: memory, error: fetchError } = await supabase
      .from('memories')
      .select('*')
      .eq('id', memoryId)
      .single()

    if (fetchError || !memory) {
      throw new Error(`Failed to fetch memory: ${fetchError?.message}`)
    }

    // 2. Extract metadata with Gemini
    console.log(`[process] Extracting metadata...`)
    const metadata = await extractMetadata(
      memory.title,
      memory.body,
      memory.orig_transcript
    )

    // 3. Generate embedding
    console.log(`[process] Generating embedding...`)
    const embeddingText = `${memory.title}\n\n${memory.body}`
    const embedding = await generateEmbedding(embeddingText)

    // 4. Update memory with extracted data
    const { error: updateError } = await supabase
      .from('memories')
      .update({
        memory_type: metadata.memory_type,
        entities: metadata.entities,
        themes: metadata.themes,
        emotional_tone: metadata.emotional_tone,
        embedding,
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('id', memoryId)

    if (updateError) {
      throw new Error(`Failed to update memory: ${updateError.message}`)
    }

    // 5. Find bridges
    console.log(`[process] Finding bridges...`)
    const updatedMemory = { ...memory, ...metadata, embedding }
    const bridges = await findBridges(updatedMemory as Memory, embedding)

    // 6. Store bridges
    if (bridges.length > 0) {
      await storeBridges(memoryId, bridges)
      console.log(`[process] Found ${bridges.length} connections`)
    } else {
      console.log(`[process] No connections found yet`)
    }

    console.log(`[process] ✅ Processing complete for memory ${memoryId}`)

  } catch (error) {
    console.error(`[process] ❌ Processing failed:`, error)

    // Store error in database
    await supabase
      .from('memories')
      .update({
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', memoryId)

    throw error
  }
}
