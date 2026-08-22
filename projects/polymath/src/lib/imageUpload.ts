/**
 * uploadImageFile — shared signed-URL upload used by every photo-attach
 * surface (thought capture, rich text editor, offline sync). One place to
 * fix reliability (timeouts, error copy) instead of three.
 */

import { fetchWithTimeout } from './network'

// Images can run a few MB on a slow connection — longer than the default
// write timeout, but still bounded so a dead connection fails fast instead
// of hanging the UI indefinitely.
const UPLOAD_TIMEOUT_MS = 20000

export async function uploadImageFile(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png'
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

  const authResponse = await fetchWithTimeout(
    '/api/utilities?resource=upload-image',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileType: file.type || 'image/png' }),
    },
    UPLOAD_TIMEOUT_MS
  )

  if (!authResponse.ok) {
    const errorData = await authResponse.json().catch(() => ({}))
    throw new Error(errorData.details || errorData.error || `Server error (${authResponse.status})`)
  }

  const { signedUrl, publicUrl } = await authResponse.json()
  if (!signedUrl || !publicUrl) throw new Error('Invalid response from upload server')

  const uploadResponse = await fetchWithTimeout(
    signedUrl,
    {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'image/png', 'x-upsert': 'true' },
      body: file,
    },
    UPLOAD_TIMEOUT_MS
  )

  if (!uploadResponse.ok) throw new Error(`Upload failed (${uploadResponse.status})`)
  return publicUrl
}
