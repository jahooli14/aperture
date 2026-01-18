import type { ManuscriptState, SceneNode } from '../types/manuscript'

export type ExportFormat = 'ulysses-md' | 'markdown' | 'txt' | 'docx'

export interface ExportOptions {
  format: ExportFormat
  includeFootnotes: boolean
  includeChapterThemes: boolean
  includeMetadata: boolean
}

/**
 * Export manuscript to various formats
 */
export async function exportManuscript(
  manuscript: ManuscriptState,
  options: ExportOptions
): Promise<{ content: string | Blob; filename: string; mimeType: string }> {
  switch (options.format) {
    case 'ulysses-md':
      return exportToUlyssesMarkdown(manuscript, options)
    case 'markdown':
      return exportToMarkdown(manuscript, options)
    case 'txt':
      return exportToPlainText(manuscript, options)
    case 'docx':
      return exportToDocx(manuscript, options)
    default:
      throw new Error(`Unsupported export format: ${options.format}`)
  }
}

/**
 * Export to Ulysses-compatible Markdown
 * Uses standard markdown that Ulysses can import cleanly
 */
function exportToUlyssesMarkdown(
  manuscript: ManuscriptState,
  options: ExportOptions
): { content: string; filename: string; mimeType: string } {
  const sections = groupScenesByChapter(manuscript.scenes)
  let content = ''

  // Add manuscript title as main heading
  content += `# ${manuscript.title}\n\n`

  // Add metadata if requested
  if (options.includeMetadata) {
    content += `**Author Notes:**\n`
    content += `- Total Word Count: ${manuscript.totalWordCount}\n`
    content += `- Scenes: ${manuscript.scenes.length}\n`
    if (manuscript.protagonistRealName) {
      content += `- Protagonist: ${manuscript.protagonistRealName}\n`
    }
    content += `\n`
  }

  // Export scenes organized by chapters
  for (const group of sections) {
    if (group.chapterId) {
      // Chapter heading
      content += `# ${group.chapterTitle}\n\n`

      // Chapter theme if available and requested
      if (options.includeChapterThemes && group.scenes[0].chapterTheme) {
        content += `*Theme: ${group.scenes[0].chapterTheme}*\n\n`
      }

      // Scenes within chapter
      for (let i = 0; i < group.scenes.length; i++) {
        const scene = group.scenes[i]

        // Scene separator (Ulysses style)
        if (i > 0) {
          content += `----\n\n`
        }

        // Scene number if available
        if (scene.sceneNumber) {
          content += `## ${scene.sceneNumber}\n\n`
        }

        // Scene prose
        content += `${scene.prose}\n\n`

        // Footnotes at end of scene
        if (options.includeFootnotes && scene.footnotes) {
          content += formatFootnotes(scene.footnotes)
        }
      }
    } else {
      // Ungrouped scenes
      for (let i = 0; i < group.scenes.length; i++) {
        const scene = group.scenes[i]

        if (i > 0) {
          content += `----\n\n`
        }

        if (scene.title) {
          content += `## ${scene.title}\n\n`
        }

        content += `${scene.prose}\n\n`

        if (options.includeFootnotes && scene.footnotes) {
          content += formatFootnotes(scene.footnotes)
        }
      }
    }

    // Blank line between chapters
    content += `\n`
  }

  const filename = `${sanitizeFilename(manuscript.title)}_ulysses.md`
  return { content, filename, mimeType: 'text/markdown' }
}

/**
 * Export to standard Markdown
 */
function exportToMarkdown(
  manuscript: ManuscriptState,
  options: ExportOptions
): { content: string; filename: string; mimeType: string } {
  const sections = groupScenesByChapter(manuscript.scenes)
  let content = ''

  // Title
  content += `# ${manuscript.title}\n\n`

  // Metadata block
  if (options.includeMetadata) {
    content += `---\n`
    content += `title: ${manuscript.title}\n`
    content += `word_count: ${manuscript.totalWordCount}\n`
    content += `scenes: ${manuscript.scenes.length}\n`
    if (manuscript.protagonistRealName) {
      content += `protagonist: ${manuscript.protagonistRealName}\n`
    }
    content += `---\n\n`
  }

  for (const group of sections) {
    if (group.chapterId) {
      content += `# ${group.chapterTitle}\n\n`

      if (options.includeChapterThemes && group.scenes[0].chapterTheme) {
        content += `> ${group.scenes[0].chapterTheme}\n\n`
      }

      for (const scene of group.scenes) {
        if (scene.sceneNumber) {
          content += `## Scene ${scene.sceneNumber}\n\n`
        }

        content += `${scene.prose}\n\n`

        if (options.includeFootnotes && scene.footnotes) {
          content += formatFootnotes(scene.footnotes)
        }

        content += `\n* * *\n\n`
      }
    } else {
      for (const scene of group.scenes) {
        if (scene.title) {
          content += `## ${scene.title}\n\n`
        }

        content += `${scene.prose}\n\n`

        if (options.includeFootnotes && scene.footnotes) {
          content += formatFootnotes(scene.footnotes)
        }

        content += `\n* * *\n\n`
      }
    }
  }

  const filename = `${sanitizeFilename(manuscript.title)}.md`
  return { content, filename, mimeType: 'text/markdown' }
}

/**
 * Export to plain text
 */
function exportToPlainText(
  manuscript: ManuscriptState,
  options: ExportOptions
): { content: string; filename: string; mimeType: string } {
  const sections = groupScenesByChapter(manuscript.scenes)
  let content = ''

  // Title
  content += `${manuscript.title}\n`
  content += `${'='.repeat(manuscript.title.length)}\n\n`

  // Metadata
  if (options.includeMetadata) {
    content += `Word Count: ${manuscript.totalWordCount}\n`
    content += `Scenes: ${manuscript.scenes.length}\n`
    if (manuscript.protagonistRealName) {
      content += `Protagonist: ${manuscript.protagonistRealName}\n`
    }
    content += `\n\n`
  }

  for (const group of sections) {
    if (group.chapterId) {
      content += `${group.chapterTitle}\n`
      content += `${'-'.repeat(group.chapterTitle.length)}\n\n`

      if (options.includeChapterThemes && group.scenes[0].chapterTheme) {
        content += `[${group.scenes[0].chapterTheme}]\n\n`
      }

      for (let i = 0; i < group.scenes.length; i++) {
        const scene = group.scenes[i]

        if (i > 0) {
          content += `\n\n---\n\n`
        }

        if (scene.sceneNumber) {
          content += `${scene.sceneNumber}\n\n`
        }

        content += `${scene.prose}\n\n`

        if (options.includeFootnotes && scene.footnotes) {
          const footnotes = scene.footnotes.split(/\n\n+/).filter(f => f.trim())
          if (footnotes.length > 0) {
            content += `\nNotes:\n`
            footnotes.forEach((note, idx) => {
              content += `[${idx + 1}] ${note}\n`
            })
            content += `\n`
          }
        }
      }
    } else {
      for (let i = 0; i < group.scenes.length; i++) {
        const scene = group.scenes[i]

        if (i > 0) {
          content += `\n\n---\n\n`
        }

        if (scene.title) {
          content += `${scene.title}\n\n`
        }

        content += `${scene.prose}\n\n`

        if (options.includeFootnotes && scene.footnotes) {
          const footnotes = scene.footnotes.split(/\n\n+/).filter(f => f.trim())
          if (footnotes.length > 0) {
            content += `\nNotes:\n`
            footnotes.forEach((note, idx) => {
              content += `[${idx + 1}] ${note}\n`
            })
            content += `\n`
          }
        }
      }
    }

    content += `\n\n`
  }

  const filename = `${sanitizeFilename(manuscript.title)}.txt`
  return { content, filename, mimeType: 'text/plain' }
}

/**
 * Export to DOCX format
 * Note: Requires the 'docx' package to be installed
 */
async function exportToDocx(
  manuscript: ManuscriptState,
  options: ExportOptions
): Promise<{ content: Blob; filename: string; mimeType: string }> {
  // For now, return a simple text blob
  // TODO: Install and use the 'docx' package for proper DOCX generation
  const textExport = exportToPlainText(manuscript, options)
  const blob = new Blob([textExport.content], { type: 'text/plain' })

  const filename = `${sanitizeFilename(manuscript.title)}.docx`
  return {
    content: blob,
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
}

/**
 * Group scenes by chapter for organized export
 */
interface SceneGroup {
  chapterId: string | null
  chapterTitle: string
  scenes: SceneNode[]
}

function groupScenesByChapter(scenes: SceneNode[]): SceneGroup[] {
  const groups: SceneGroup[] = []
  const sorted = [...scenes].sort((a, b) => a.order - b.order)

  let currentGroup: SceneGroup | null = null

  for (const scene of sorted) {
    if (scene.chapterId) {
      // Start new chapter group if needed
      if (!currentGroup || currentGroup.chapterId !== scene.chapterId) {
        currentGroup = {
          chapterId: scene.chapterId,
          chapterTitle: scene.chapterTitle || `Chapter ${scene.chapterId}`,
          scenes: []
        }
        groups.push(currentGroup)
      }
      currentGroup.scenes.push(scene)
    } else {
      // Ungrouped scene
      if (!currentGroup || currentGroup.chapterId !== null) {
        currentGroup = {
          chapterId: null,
          chapterTitle: 'Scenes',
          scenes: []
        }
        groups.push(currentGroup)
      }
      currentGroup.scenes.push(scene)
    }
  }

  return groups
}

/**
 * Format footnotes for export
 */
function formatFootnotes(footnotesText: string): string {
  const footnotes = footnotesText.split(/\n\n+/).filter(f => f.trim())
  if (footnotes.length === 0) return ''

  let output = `\n---\n\n`
  footnotes.forEach((note, idx) => {
    output += `[${idx + 1}] ${note}\n\n`
  })
  return output
}

/**
 * Sanitize filename for safe file system use
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9-_\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 100)
}

/**
 * Download a file to the user's device
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
