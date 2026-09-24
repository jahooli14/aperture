/**
 * Pure helpers for "what you made" (projectOutputs.ts). Split out so they
 * test without a Supabase client.
 */

export type OutputKind = 'image' | 'audio'

export interface ProjectOutput {
  id: string
  project_id: string
  session_id: string | null
  kind: OutputKind
  note: string | null
  created_at: string
  url: string
}

/** Supabase's free tier refuses single files over 50MB. */
export const MAX_OUTPUT_BYTES = 50 * 1024 * 1024
/** Photos are shrunk to this on the long edge before upload. */
export const MAX_IMAGE_EDGE = 2000

export function kindOfFile(file: { type: string }): OutputKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

/** Plain reason a file can't be added, or null when it can. */
export function rejectReason(file: { type: string; size: number }): string | null {
  if (!kindOfFile(file)) return 'Photos and audio only.'
  if (file.size > MAX_OUTPUT_BYTES) return 'That file is over 50MB. Try a shorter clip.'
  return null
}

/** Target size for a photo, keeping its shape. Never scales up. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const k = maxEdge / longest
  return { width: Math.round(width * k), height: Math.round(height * k) }
}
