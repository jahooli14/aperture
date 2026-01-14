import { supabase, isSupabaseConfigured } from './supabase'
import { db } from './db'
import type { ManuscriptState, SceneNode, Reverberation, Sense } from '../types/manuscript'

export interface SyncResult {
  success: boolean
  error?: string
  uploaded: number
  downloaded: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any

// Push local data to cloud
export async function syncToCloud(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured', uploaded: 0, downloaded: 0 }
  }

  try {
    // Get all local manuscripts
    const localManuscripts = await db.manuscripts.toArray()
    let uploaded = 0

    for (const manuscript of localManuscripts) {
      // Upsert manuscript
      const { error: mError } = await supabase
        .from('manuscripts')
        .upsert({
          id: manuscript.id,
          user_id: userId,
          title: manuscript.title,
          protagonist_real_name: manuscript.protagonistRealName,
          mask_mode_enabled: manuscript.maskModeEnabled,
          current_section: manuscript.currentSection,
          total_word_count: manuscript.totalWordCount,
          alex_identity: manuscript.alexIdentity,
          sensory_audit: manuscript.sensoryAudit,
          reveal_audit_unlocked: manuscript.revealAuditUnlocked,
          created_at: manuscript.createdAt,
          updated_at: manuscript.updatedAt
        } as AnyRow, { onConflict: 'id' })

      if (mError) {
        console.error('Failed to sync manuscript:', mError)
        continue
      }

      // Get local scenes for this manuscript
      const localScenes = await db.sceneNodes
        .where('manuscriptId')
        .equals(manuscript.id)
        .toArray()

      // Upsert scenes
      for (const scene of localScenes) {
        const { error: sError } = await supabase
          .from('scene_nodes')
          .upsert({
            id: scene.id,
            manuscript_id: manuscript.id,
            order_index: scene.order,
            title: scene.title,
            section: scene.section,
            prose: scene.prose,
            footnotes: scene.footnotes,
            word_count: scene.wordCount,
            identity_type: scene.identityType,
            sensory_focus: scene.sensoryFocus,
            awareness_level: scene.awarenessLevel,
            footnote_tone: scene.footnoteTone,
            status: scene.status,
            validation_status: scene.validationStatus,
            checklist: JSON.stringify(scene.checklist),
            senses_activated: scene.sensesActivated,
            pulse_check_completed_at: scene.pulseCheckCompletedAt,
            created_at: scene.createdAt,
            updated_at: scene.updatedAt
          } as AnyRow, { onConflict: 'id' })

        if (sError) {
          console.error('Failed to sync scene:', sError)
        }
      }

      // Get local reverberations
      const localReverbs = await db.reverberations
        .where('manuscriptId')
        .equals(manuscript.id)
        .toArray()

      for (const reverb of localReverbs) {
        const { error: rError } = await supabase
          .from('reverberations')
          .upsert({
            id: reverb.id,
            manuscript_id: manuscript.id,
            scene_id: reverb.sceneId,
            text: reverb.text,
            speaker: reverb.speaker,
            villager_name: reverb.villagerName || null,
            linked_reveal_scene_id: reverb.linkedRevealSceneId || null,
            created_at: reverb.createdAt
          } as AnyRow, { onConflict: 'id' })

        if (rError) {
          console.error('Failed to sync reverberation:', rError)
        }
      }

      uploaded++
    }

    return { success: true, uploaded, downloaded: 0 }
  } catch (error) {
    console.error('Sync to cloud failed:', error)
    return { success: false, error: 'Sync failed', uploaded: 0, downloaded: 0 }
  }
}

// Pull cloud data to local
export async function syncFromCloud(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured', uploaded: 0, downloaded: 0 }
  }

  try {
    // Get all cloud manuscripts for this user
    const { data: cloudManuscripts, error: mError } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (mError) {
      throw mError
    }

    let downloaded = 0

    for (const cloudMs of (cloudManuscripts || []) as AnyRow[]) {
      // Convert to local format
      const localMs: ManuscriptState = {
        id: cloudMs.id,
        title: cloudMs.title,
        protagonistRealName: cloudMs.protagonist_real_name || '',
        maskModeEnabled: cloudMs.mask_mode_enabled,
        currentSection: cloudMs.current_section,
        totalWordCount: cloudMs.total_word_count,
        scenes: [],
        alexIdentity: cloudMs.alex_identity || {
          alPatterns: [],
          lexiPatterns: [],
          syncStatus: 'synced',
          lastSyncCheck: null
        },
        sensoryAudit: cloudMs.sensory_audit || {
          sight: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
          smell: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
          sound: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
          taste: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
          touch: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 }
        },
        reverberationLibrary: [],
        revealAuditUnlocked: cloudMs.reveal_audit_unlocked,
        createdAt: cloudMs.created_at,
        updatedAt: cloudMs.updated_at
      }

      // Check if we have a local version
      const existingLocal = await db.manuscripts.get(localMs.id)

      // If cloud is newer, update local
      if (!existingLocal || new Date(localMs.updatedAt) > new Date(existingLocal.updatedAt)) {
        // Get cloud scenes
        const { data: cloudScenes, error: sError } = await supabase
          .from('scene_nodes')
          .select('*')
          .eq('manuscript_id', localMs.id)
          .order('order_index')

        if (sError) {
          console.error('Failed to fetch scenes:', sError)
          continue
        }

        // Convert scenes
        const scenes: SceneNode[] = ((cloudScenes || []) as AnyRow[]).map((row): SceneNode => ({
          id: row.id,
          order: row.order_index,
          title: row.title,
          section: row.section,
          prose: row.prose || '',
          footnotes: row.footnotes || '',
          wordCount: row.word_count,
          identityType: row.identity_type,
          sensoryFocus: row.sensory_focus,
          awarenessLevel: row.awareness_level,
          footnoteTone: row.footnote_tone,
          status: row.status,
          validationStatus: row.validation_status,
          checklist: JSON.parse(row.checklist || '[]'),
          sensesActivated: (row.senses_activated || []) as Sense[],
          glassesmentions: [],
          reverberations: [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          pulseCheckCompletedAt: row.pulse_check_completed_at
        }))

        localMs.scenes = scenes
        localMs.totalWordCount = scenes.reduce((sum, s) => sum + s.wordCount, 0)

        // Get cloud reverberations
        const { data: cloudReverbs } = await supabase
          .from('reverberations')
          .select('*')
          .eq('manuscript_id', localMs.id)

        localMs.reverberationLibrary = ((cloudReverbs || []) as AnyRow[]).map((r): Reverberation => ({
          id: r.id,
          sceneId: r.scene_id,
          text: r.text,
          speaker: r.speaker,
          villagerName: r.villager_name || undefined,
          linkedRevealSceneId: r.linked_reveal_scene_id || null,
          createdAt: r.created_at
        }))

        // Save to local DB
        await db.manuscripts.put(localMs)

        // Save scenes to local DB
        for (const scene of scenes) {
          await db.sceneNodes.put({ ...scene, manuscriptId: localMs.id })
        }

        // Save reverberations to local DB
        for (const reverb of localMs.reverberationLibrary) {
          await db.reverberations.put({ ...reverb, manuscriptId: localMs.id })
        }

        downloaded++
      }
    }

    return { success: true, uploaded: 0, downloaded }
  } catch (error) {
    console.error('Sync from cloud failed:', error)
    return { success: false, error: 'Sync failed', uploaded: 0, downloaded: 0 }
  }
}

// Full bidirectional sync
export async function fullSync(userId: string): Promise<SyncResult> {
  // First pull from cloud (gets latest)
  const pullResult = await syncFromCloud(userId)
  if (!pullResult.success) {
    return pullResult
  }

  // Then push local changes
  const pushResult = await syncToCloud(userId)

  return {
    success: pushResult.success,
    error: pushResult.error,
    uploaded: pushResult.uploaded,
    downloaded: pullResult.downloaded
  }
}
