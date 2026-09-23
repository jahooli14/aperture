/**
 * What you made — client side of `utilities?resource=outputs`
 * (api/_lib/project-outputs.ts). A photo, screenshot or audio clip,
 * uploaded to storage and then recorded against a project.
 */

import { api } from './apiClient'
import { uploadImageFile } from './imageUpload'
import { kindOfFile, rejectReason, scaledSize, type OutputKind, type ProjectOutput } from './projectOutputsOps'

export type { OutputKind, ProjectOutput } from './projectOutputsOps'

/**
 * A phone photo is 4–10MB, which is slow on mobile data for no gain on a
 * phone screen. Re-encode as JPEG at MAX_IMAGE_EDGE. GIFs keep their
 * animation, and anything that fails to decode goes up as it is.
 */
async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = scaledSize(bitmap.width, bitmap.height)
    if (width === bitmap.width && file.size < 1.5 * 1024 * 1024) {
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

export async function listOutputs(projectId: string): Promise<{ items: ProjectOutput[]; available: boolean }> {
  const data = await api.get(`utilities?resource=outputs&project_id=${projectId}`)
  return { items: data?.items ?? [], available: data?.available !== false }
}

export async function addOutput(
  projectId: string,
  file: File,
  sessionId?: string | null,
): Promise<ProjectOutput> {
  const reason = rejectReason(file)
  if (reason) throw new Error(reason)
  const kind = kindOfFile(file) as OutputKind
  const upload = kind === 'image' ? await shrinkImage(file) : file
  // Audio can be tens of MB; give it a couple of minutes rather than 20s.
  const url = await uploadImageFile(upload, kind === 'audio' ? 180_000 : undefined)
  const data = await api.post('utilities?resource=outputs', {
    project_id: projectId,
    session_id: sessionId ?? null,
    url,
    kind,
  })
  return data.item as ProjectOutput
}

export async function removeOutput(id: string): Promise<void> {
  await api.delete(`utilities?resource=outputs&id=${id}`)
}
