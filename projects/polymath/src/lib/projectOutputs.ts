/**
 * What you made: client side of `utilities?resource=outputs`
 * (api/_lib/project-outputs.ts). Photos and audio go straight to the
 * private `made` bucket through a one-time signed upload URL; links are
 * sent as they are and the server reads their title and artwork.
 */

import { api } from './apiClient'
import { fetchWithTimeout } from './network'
import { exifDate, fileDate, kindOfFile, rejectReason, scaledSize, type ProjectOutput } from './projectOutputsOps'

export type { OutputKind, ProjectOutput, LinkMeta } from './projectOutputsOps'

export interface PieceFields { title?: string; note?: string; made_on?: string }

/** Re-encode a phone photo as a 2000px JPEG. GIFs and anything that won't decode go up as they are. */
async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledSize(bitmap.width, bitmap.height)
    if (width === bitmap.width && file.size < 1.5 * 1024 * 1024 && file.type === 'image/jpeg') {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** The day a file was made: EXIF for a photo, else the file's own date, else null. */
export async function dateOfFile(file: File): Promise<string | null> {
  if (file.type === 'image/jpeg') {
    try {
      const d = exifDate(await file.slice(0, 256 * 1024).arrayBuffer())
      if (d) return d
    } catch { /* fall through */ }
  }
  return fileDate(file.lastModified)
}

export async function listOutputs(projectId?: string): Promise<{ items: ProjectOutput[]; available: boolean }> {
  const data = await api.get(`utilities?resource=outputs${projectId ? `&project_id=${projectId}` : ''}`)
  return { items: data?.items ?? [], available: data?.available !== false }
}

export async function addFile(projectId: string, file: File, fields: PieceFields = {}): Promise<ProjectOutput> {
  const reason = rejectReason(file)
  if (reason) throw new Error(reason)
  const kind = kindOfFile(file)!
  const upload = kind === 'image' ? await shrinkImage(file) : file
  const { path, signedUrl } = await api.post('utilities?resource=outputs', { action: 'upload-url', fileType: upload.type }) as { path: string; signedUrl: string }
  const put = await fetchWithTimeout(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': upload.type, 'x-upsert': 'false' },
    body: upload,
  }, kind === 'audio' ? 180_000 : 60_000)
  if (!put.ok) throw new Error("Couldn't upload that. Try again.")
  const data = await api.post('utilities?resource=outputs', { project_id: projectId, kind, path, ...fields })
  return data.item as ProjectOutput
}

export async function addLink(projectId: string, link: string, fields: PieceFields = {}): Promise<ProjectOutput> {
  const data = await api.post('utilities?resource=outputs', { project_id: projectId, kind: 'link', link: link.trim(), ...fields }, { timeout: 20_000 })
  return data.item as ProjectOutput
}

export async function editOutput(id: string, fields: PieceFields): Promise<ProjectOutput> {
  const data = await api.patch(`utilities?resource=outputs&id=${id}`, fields)
  return data.item as ProjectOutput
}

export async function removeOutput(id: string): Promise<void> {
  await api.delete(`utilities?resource=outputs&id=${id}`)
}
