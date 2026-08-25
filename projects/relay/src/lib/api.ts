/** Typed wrapper over the /api routes. Auth is attached by setupAuthFetch. */
import type { Line, Profile, StoryDetail, StorySummary, TurnMode } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Something went wrong')
  return payload as T
}

export const api = {
  me: () => request<{ profile: Profile }>('/api/me'),

  rename: (displayName: string) =>
    request<{ profile: Profile }>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: displayName }),
    }),

  listStories: () => request<{ stories: StorySummary[] }>('/api/stories'),

  getStory: (id: string) => request<StoryDetail>(`/api/stories?id=${id}`),

  createStory: (input: { title: string; blurb?: string; turn_mode: TurnMode }) =>
    request<{ story: StorySummary }>('/api/stories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateStory: (id: string, updates: Record<string, unknown>) =>
    request<{ story: StorySummary }>(`/api/stories?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  skipTurn: (id: string) =>
    request<{ whose_turn: string | null }>(`/api/stories?id=${id}&resource=skip`, { method: 'POST' }),

  listLines: (storyId: string) => request<{ lines: Line[]; total: number }>(`/api/lines?story=${storyId}`),

  addLine: (storyId: string, body: string, chapterTitle?: string) =>
    request<{ line: Line }>(`/api/lines?story=${storyId}`, {
      method: 'POST',
      body: JSON.stringify({ body, chapter_title: chapterTitle || null }),
    }),

  createInvite: (storyId: string, maxUses = 1) =>
    request<{ invite: { code: string; expires_at: string; max_uses: number } }>(
      `/api/members?story=${storyId}&resource=invite`,
      { method: 'POST', body: JSON.stringify({ max_uses: maxUses }) }
    ),

  previewInvite: (code: string) =>
    request<{ story: { id: string; title: string; blurb: string | null }; writers: string[] }>(
      `/api/members?resource=preview&code=${encodeURIComponent(code)}`
    ),

  joinStory: (code: string) =>
    request<{ story_id: string }>('/api/members?resource=join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  setNotify: (storyId: string, notify: boolean) =>
    request<{ notify: boolean }>(`/api/members?story=${storyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notify }),
    }),

  leaveStory: (storyId: string) =>
    request<{ removed: string }>(`/api/members?story=${storyId}`, { method: 'DELETE' }),
}
