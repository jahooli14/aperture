/**
 * Chat Handoff
 *
 * Focus chat (portfolio triage, Home) and the per-project Guide are two
 * separate conversations with no shared state — landing on a project after
 * Focus chat just talked through why to pick it up used to mean the Guide
 * re-greeted from scratch, ignorant of what was just said. This is a
 * one-shot, one-message relay: Focus chat drops a short line describing
 * what it told the user right before navigating away or starting a
 * session; the Guide reads and consumes it (deletes on read, so a later
 * unrelated visit to the same project doesn't replay stale context) and
 * folds it into its opening greeting.
 *
 * sessionStorage, not the project store or a server round-trip — this is
 * purely a same-tab, same-session UI relay, not data worth persisting.
 */

const KEY_PREFIX = 'polymath:chat-handoff:'

export function setChatHandoff(projectId: string, summary: string): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + projectId, summary)
  } catch {
    // sessionStorage can throw in private-browsing/quota edge cases —
    // losing the handoff line just means a slightly less contextual
    // greeting, not a broken chat, so fail silently.
  }
}

/** Reads and immediately clears the handoff for a project — consumed
 *  exactly once, right when the Guide opens. */
export function consumeChatHandoff(projectId: string): string | null {
  try {
    const key = KEY_PREFIX + projectId
    const value = sessionStorage.getItem(key)
    if (value) sessionStorage.removeItem(key)
    return value
  } catch {
    return null
  }
}
