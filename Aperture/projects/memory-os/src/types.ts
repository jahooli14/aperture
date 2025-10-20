// MemoryOS Type Definitions

export type MemoryType = 'foundational' | 'event' | 'insight'

export type BridgeType = 'entity_match' | 'semantic_similarity' | 'temporal_proximity'

export interface AudiopenWebhook {
  id: string
  title: string
  body: string
  orig_transcript: string
  tags: string // Comma-separated
  date_created: string // ISO date string
}

export interface Entities {
  people: string[]
  places: string[]
  topics: string[]
}

export interface Memory {
  id: string
  created_at: string

  // Raw Audiopen data
  audiopen_id: string
  title: string
  body: string
  orig_transcript: string | null
  tags: string[]
  audiopen_created_at: string

  // AI-extracted metadata
  memory_type: MemoryType | null
  entities: Entities | null
  themes: string[] | null
  emotional_tone: string | null

  // Vector search
  embedding: number[] | null

  // Processing status
  processed: boolean
  processed_at: string | null
  error: string | null
}

export interface Bridge {
  id: string
  created_at: string
  memory_a: string
  memory_b: string
  bridge_type: BridgeType
  strength: number
  entities_shared: string[] | null
}

export interface ExtractedMetadata {
  memory_type: MemoryType
  entities: Entities
  themes: string[]
  emotional_tone: string
}

export interface BridgeCandidate {
  memory: Memory
  bridge_type: BridgeType
  strength: number
  entities_shared?: string[]
  reason: string // Human-readable explanation
}
