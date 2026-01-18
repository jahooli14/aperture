import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Download, FileText, File, FileCode } from 'lucide-react'
import { exportManuscript, downloadFile, type ExportFormat } from '../lib/export'
import type { ManuscriptState } from '../types/manuscript'

interface ExportModalProps {
  manuscript: ManuscriptState
  onClose: () => void
}

export default function ExportModal({ manuscript, onClose }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('ulysses-md')
  const [includeFootnotes, setIncludeFootnotes] = useState(true)
  const [includeChapterThemes, setIncludeChapterThemes] = useState(true)
  const [includeMetadata, setIncludeMetadata] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const formats: { value: ExportFormat; label: string; description: string; icon: typeof FileText }[] = [
    {
      value: 'ulysses-md',
      label: 'Ulysses Markdown',
      description: 'Standard markdown optimized for Ulysses import',
      icon: FileCode
    },
    {
      value: 'markdown',
      label: 'Markdown',
      description: 'Standard markdown with metadata frontmatter',
      icon: FileCode
    },
    {
      value: 'txt',
      label: 'Plain Text',
      description: 'Simple text format with basic formatting',
      icon: FileText
    },
    {
      value: 'docx',
      label: 'Word Document',
      description: 'Microsoft Word format (coming soon)',
      icon: File
    }
  ]

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportManuscript(manuscript, {
        format: selectedFormat,
        includeFootnotes,
        includeChapterThemes,
        includeMetadata
      })

      downloadFile(result.content, result.filename, result.mimeType)
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-ink-900 border border-ink-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-800">
          <h2 className="text-lg font-medium text-ink-100">Export Manuscript</h2>
          <button onClick={onClose} className="p-1 hover:bg-ink-800 rounded">
            <X className="w-5 h-5 text-ink-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Manuscript Info */}
          <div className="p-3 bg-ink-950 border border-ink-800 rounded">
            <h3 className="text-sm font-medium text-ink-200">{manuscript.title}</h3>
            <div className="flex items-center gap-4 mt-1 text-xs text-ink-500">
              <span>{manuscript.scenes.length} scenes</span>
              <span>•</span>
              <span>{manuscript.totalWordCount} words</span>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-2">Export Format</label>
            <div className="space-y-2">
              {formats.map((format) => {
                const Icon = format.icon
                const isDisabled = format.value === 'docx' // DOCX not yet implemented

                return (
                  <button
                    key={format.value}
                    onClick={() => !isDisabled && setSelectedFormat(format.value)}
                    disabled={isDisabled}
                    className={`w-full flex items-start gap-3 p-3 rounded border transition-colors text-left ${
                      selectedFormat === format.value
                        ? 'bg-section-departure/20 border-section-departure text-ink-100'
                        : isDisabled
                        ? 'bg-ink-950 border-ink-800 text-ink-600 cursor-not-allowed'
                        : 'bg-ink-950 border-ink-800 text-ink-300 hover:border-ink-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{format.label}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{format.description}</div>
                    </div>
                    {selectedFormat === format.value && (
                      <div className="w-2 h-2 rounded-full bg-section-departure flex-shrink-0 mt-2" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Export Options */}
          <div>
            <label className="block text-sm font-medium text-ink-300 mb-2">Options</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFootnotes}
                  onChange={(e) => setIncludeFootnotes(e.target.checked)}
                  className="w-4 h-4 rounded border-ink-700 bg-ink-950 text-section-departure focus:ring-section-departure"
                />
                Include footnotes at end of each scene
              </label>

              <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeChapterThemes}
                  onChange={(e) => setIncludeChapterThemes(e.target.checked)}
                  className="w-4 h-4 rounded border-ink-700 bg-ink-950 text-section-departure focus:ring-section-departure"
                />
                Include chapter themes/arcs
              </label>

              <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-ink-700 bg-ink-950 text-section-departure focus:ring-section-departure"
                />
                Include metadata (word count, scene count, etc.)
              </label>
            </div>
          </div>

          {/* Format Preview */}
          <div className="p-3 bg-ink-950 border border-ink-800 rounded">
            <div className="text-xs text-ink-500 mb-2">Export Preview:</div>
            <div className="text-xs text-ink-400 font-mono">
              {selectedFormat === 'ulysses-md' && (
                <>
                  <div># {manuscript.title}</div>
                  <div className="mt-2"># Chapter Title</div>
                  <div className="mt-1">----</div>
                  <div className="mt-1">Scene prose...</div>
                  {includeFootnotes && <div className="mt-2">[1] Footnote text...</div>}
                </>
              )}
              {selectedFormat === 'markdown' && (
                <>
                  <div># {manuscript.title}</div>
                  {includeMetadata && (
                    <div className="mt-2">
                      ---
                      <br />
                      title: {manuscript.title}
                      <br />
                      ---
                    </div>
                  )}
                  <div className="mt-2">## Scene Title</div>
                  <div className="mt-1">Scene prose...</div>
                  <div className="mt-2">* * *</div>
                </>
              )}
              {selectedFormat === 'txt' && (
                <>
                  <div>{manuscript.title}</div>
                  <div>{'='.repeat(20)}</div>
                  <div className="mt-2">Chapter Title</div>
                  <div>---</div>
                  <div className="mt-1">Scene prose...</div>
                </>
              )}
              {selectedFormat === 'docx' && (
                <div className="text-ink-600">Word document format (coming soon)</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-ink-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ink-400 hover:text-ink-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-section-departure hover:bg-section-departure/80 text-white rounded text-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
