import Dexie, { type EntityTable } from 'dexie'
import type {
  SceneNode,
  Reverberation,
  GlassesMention,
  SpeechPattern,
  ManuscriptState
} from '../types/manuscript'

// Offline-first database using Dexie (IndexedDB wrapper)
class AnalogueDatabase extends Dexie {
  manuscripts!: EntityTable<ManuscriptState, 'id'>
  sceneNodes!: EntityTable<SceneNode & { manuscriptId: string }, 'id'>
  reverberations!: EntityTable<Reverberation & { manuscriptId: string }, 'id'>
  glassesMentions!: EntityTable<GlassesMention & { manuscriptId: string }, 'id'>
  speechPatterns!: EntityTable<SpeechPattern & { manuscriptId: string }, 'id'>
  pendingSync!: EntityTable<PendingSyncOperation, 'id'>

  constructor() {
    super('analogue')

    this.version(1).stores({
      manuscripts: 'id, updatedAt',
      sceneNodes: 'id, manuscriptId, order, section, updatedAt',
      reverberations: 'id, manuscriptId, sceneId, speaker',
      glassesMentions: 'id, manuscriptId, sceneId, flagged',
      speechPatterns: 'id, manuscriptId, characterSource',
      pendingSync: 'id, type, timestamp'
    })
  }
}

export interface PendingSyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  table: 'manuscripts' | 'sceneNodes' | 'reverberations' | 'glassesMentions' | 'speechPatterns'
  data: Record<string, unknown>
  timestamp: number
}

export const db = new AnalogueDatabase()

// Helper to generate unique IDs
export function generateId(): string {
  return crypto.randomUUID()
}

// Queue an operation for sync when back online
export async function queueForSync(operation: Omit<PendingSyncOperation, 'id' | 'timestamp'>) {
  await db.pendingSync.add({
    ...operation,
    id: generateId(),
    timestamp: Date.now()
  })
}

// Get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  return await db.pendingSync.count()
}

// Clear synced operations
export async function clearSyncedOperations(ids: string[]) {
  await db.pendingSync.bulkDelete(ids)
}
