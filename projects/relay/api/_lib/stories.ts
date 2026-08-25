/** Shared reads: a story, who's in it, and what they're called. */
import type { RelayClient } from './supabase.js'
import type { TurnMode } from './turns.js'

export interface StoryRow {
  id: string
  title: string
  blurb: string | null
  created_by: string
  turn_mode: TurnMode
  next_author_id: string | null
  status: 'active' | 'finished' | 'archived'
  max_members: number
  created_at: string
  updated_at: string
  last_line_at: string | null
}

export interface MemberRow {
  user_id: string
  role: 'owner' | 'writer'
  turn_order: number
  notify: boolean
  joined_at: string
}

export async function loadStory(
  supabase: RelayClient,
  storyId: string
): Promise<{ story: StoryRow; members: MemberRow[] } | null> {
  const { data: story, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .maybeSingle()

  if (error) throw error
  if (!story) return null

  const { data: members, error: memberError } = await supabase
    .from('story_members')
    .select('user_id, role, turn_order, notify, joined_at')
    .eq('story_id', storyId)
    .order('turn_order')

  if (memberError) throw memberError
  return { story: story as StoryRow, members: (members ?? []) as MemberRow[] }
}

/** user_id -> display name, for everyone passed in. */
export async function loadProfiles(
  supabase: RelayClient,
  userIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return {}

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', unique)

  if (error) throw error

  const names: Record<string, string> = {}
  for (const row of data ?? []) names[row.user_id] = row.display_name
  return names
}

/**
 * Everyone needs a name before they can appear in someone else's story, so
 * one is derived from their email the first time we see them. They can change
 * it later; nothing downstream depends on the derived value.
 */
export async function ensureProfile(
  supabase: RelayClient,
  userId: string
): Promise<{ user_id: string; display_name: string }> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing as { user_id: string; display_name: string }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  const email = authUser?.user?.email ?? ''
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  const displayName = local
    ? local.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40)
    : 'Writer'

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, display_name: displayName }, { onConflict: 'user_id' })
    .select('user_id, display_name')
    .single()

  if (error) throw error
  return data as { user_id: string; display_name: string }
}

/** Unambiguous alphabet — no 0/O or 1/I to misread when reading a code aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function makeInviteCode(length = 8): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}
