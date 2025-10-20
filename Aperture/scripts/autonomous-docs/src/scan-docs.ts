/**
 * Documentation Scanner
 *
 * Scans all .md files in the repository and generates/updates
 * the documentation index in .claude/startup.md
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { writeFileSync } from 'fs'

interface DocFile {
  path: string
  relativePath: string
  category: string
  title: string
  description: string
}

export class DocumentationScanner {
  private repoRoot: string
  private ignorePaths = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.dev/worktree', // Git worktrees
    '.archive', // Archived files
    'scripts/autonomous-docs/node_modules'
  ]

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot
  }

  /**
   * Scan repository for all .md files and categorize them
   */
  async scanDocumentation(): Promise<DocFile[]> {
    console.log('📚 Scanning documentation files...')

    const docs: DocFile[] = []

    // Scan root directory
    docs.push(...this.scanDirectory(this.repoRoot, ''))

    console.log(`   Found ${docs.length} documentation files`)
    return docs
  }

  /**
   * Recursively scan directory for .md files
   */
  private scanDirectory(dirPath: string, relativePath: string): DocFile[] {
    const docs: DocFile[] = []

    try {
      const entries = readdirSync(dirPath)

      for (const entry of entries) {
        const fullPath = join(dirPath, entry)
        const entryRelativePath = join(relativePath, entry)

        // Skip ignored paths
        if (this.shouldIgnore(entryRelativePath)) {
          continue
        }

        const stats = statSync(fullPath)

        if (stats.isDirectory()) {
          // Recursively scan subdirectory
          docs.push(...this.scanDirectory(fullPath, entryRelativePath))
        } else if (stats.isFile() && entry.endsWith('.md')) {
          // Process markdown file
          const doc = this.processMarkdownFile(fullPath, entryRelativePath)
          if (doc) {
            docs.push(doc)
          }
        }
      }
    } catch (error) {
      console.error(`   Error scanning ${dirPath}:`, error)
    }

    return docs
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnore(path: string): boolean {
    return this.ignorePaths.some(ignorePath =>
      path.includes(ignorePath)
    )
  }

  /**
   * Extract metadata from markdown file
   */
  private processMarkdownFile(fullPath: string, relativePath: string): DocFile | null {
    try {
      const content = readFileSync(fullPath, 'utf-8')

      // Extract first heading as title
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : relativePath

      // Extract description (first paragraph after title, or purpose section)
      let description = this.extractDescription(content)

      // Categorize based on path and content
      const category = this.categorizeDoc(relativePath, content)

      return {
        path: fullPath,
        relativePath,
        category,
        title,
        description
      }
    } catch (error) {
      console.error(`   Error processing ${relativePath}:`, error)
      return null
    }
  }

  /**
   * Extract description from markdown content
   */
  private extractDescription(content: string): string {
    // Look for **Purpose**: pattern
    const purposeMatch = content.match(/\*\*Purpose\*\*:\s*(.+?)(?:\n|$)/i)
    if (purposeMatch) {
      return purposeMatch[1].trim()
    }

    // Look for > **Purpose** pattern
    const blockPurposeMatch = content.match(/>\s*\*\*Purpose\*\*:\s*(.+?)(?:\n|$)/i)
    if (blockPurposeMatch) {
      return blockPurposeMatch[1].trim()
    }

    // Look for description in frontmatter or first paragraph
    const descMatch = content.match(/(?:^|\n)(?:>|)\s*(.+?)(?:\n\n|$)/)
    if (descMatch && !descMatch[1].startsWith('#')) {
      return descMatch[1].replace(/^>\s*/, '').trim().slice(0, 100)
    }

    return 'Documentation file'
  }

  /**
   * Categorize documentation based on path and content
   */
  private categorizeDoc(path: string, content: string): string {
    // Core documentation
    if (path.includes('.claude/startup.md')) return 'core'
    if (path.match(/^CLAUDE.*\.md$/)) return 'core'
    if (path === 'NEXT_SESSION.md') return 'core'

    // Navigation & Strategy
    if (path === 'NAVIGATION.md') return 'navigation'
    if (path.includes('WHEN_TO_READ.md')) return 'navigation'
    if (path.includes('CAPABILITIES.md')) return 'navigation'

    // Debugging & Troubleshooting
    if (path.includes('DEBUG') || path.includes('COMMON_MISTAKES')) return 'debugging'
    if (path.includes('PROACTIVE_LOG_MONITORING')) return 'debugging'
    if (path.includes('OBSERVABILITY')) return 'debugging'

    // Development & Process
    if (path.includes('SESSION_CHECKLIST') || path.includes('DEVELOPMENT')) return 'development'
    if (path.includes('TESTING') || path.includes('DEPLOYMENT')) return 'development'

    // Meta Projects
    if (path.includes('scripts/autonomous-docs') || path.includes('scripts/self-healing')) return 'meta'
    if (path.includes('CONTINUOUS_IMPROVEMENT') || path.includes('LESSONS_LEARNED')) return 'meta'
    if (path.includes('DECISION_LOG')) return 'meta'

    // Reference & Analysis
    if (path.includes('FRONTIER') || path.includes('GOOGLE_CLOUD') || path.includes('ANALYSIS')) return 'reference'
    if (path.includes('knowledge-base')) return 'reference'

    // Quick Reference
    if (path.includes('QUICK_REFERENCE') || path.includes('CHEATSHEET')) return 'quick-reference'
    if (path.includes('STARTUP_EXAMPLE') || path.includes('DOCUMENTATION_INDEX')) return 'quick-reference'

    // Project-specific
    if (path.includes('projects/')) return 'project-specific'

    // Default
    return 'other'
  }

  /**
   * Update the documentation index in .claude/startup.md
   */
  async updateDocumentationIndex(docs: DocFile[]): Promise<void> {
    console.log('📝 Updating documentation index...')

    const startupPath = join(this.repoRoot, '.claude', 'startup.md')
    const startupContent = readFileSync(startupPath, 'utf-8')

    // Generate new index section
    const indexContent = this.generateIndexSection(docs)

    // Find and replace the CONTEXTUAL DOCUMENTATION INDEX section
    const sectionStart = '## 📖 CONTEXTUAL DOCUMENTATION INDEX'
    const nextSectionStart = '\n## 🚨 AUTOMATIC SESSION STARTUP SEQUENCE'

    const startIndex = startupContent.indexOf(sectionStart)
    const endIndex = startupContent.indexOf(nextSectionStart)

    if (startIndex === -1 || endIndex === -1) {
      console.error('   ⚠️ Could not find documentation index section in startup.md')
      return
    }

    const updatedContent =
      startupContent.slice(0, startIndex) +
      indexContent +
      startupContent.slice(endIndex)

    writeFileSync(startupPath, updatedContent, 'utf-8')
    console.log('   ✅ Documentation index updated')
  }

  /**
   * Generate the documentation index section markdown
   */
  private generateIndexSection(docs: DocFile[]): string {
    const categories = {
      core: { title: 'Core Documentation (Auto-Read)', docs: [] as DocFile[], showAll: true },
      navigation: { title: 'Navigation & Strategy', docs: [] as DocFile[], showAll: true },
      debugging: { title: 'Debugging & Troubleshooting (Read when debugging)', docs: [] as DocFile[], showAll: true },
      development: { title: 'Development & Process (Read when implementing)', docs: [] as DocFile[], showAll: false },
      meta: { title: 'Meta Projects (Read when working on infrastructure)', docs: [] as DocFile[], showAll: false },
      reference: { title: 'Reference & Analysis (Read when researching)', docs: [] as DocFile[], showAll: false },
      'quick-reference': { title: 'Quick Reference (Read when needed)', docs: [] as DocFile[], showAll: true },
      'project-specific': { title: 'Project-Specific Documentation', docs: [] as DocFile[], showAll: false },
      other: { title: 'Other Documentation', docs: [] as DocFile[], showAll: false }
    }

    // Group docs by category
    docs.forEach(doc => {
      const category = doc.category as keyof typeof categories
      if (categories[category]) {
        categories[category].docs.push(doc)
      } else {
        categories.other.docs.push(doc)
      }
    })

    // Generate markdown
    let markdown = `## 📖 CONTEXTUAL DOCUMENTATION INDEX\n\n`
    markdown += `**These docs are read ONLY when needed, not at startup.**\n\n`
    markdown += `**Last scanned**: ${new Date().toISOString().split('T')[0]}\n`
    markdown += `**Total files**: ${docs.length}\n\n`

    // Add each category
    Object.entries(categories).forEach(([key, { title, docs, showAll }]) => {
      if (docs.length === 0) return

      markdown += `### ${title}\n`

      // Sort docs by path
      docs.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

      if (showAll || docs.length <= 5) {
        // Show all docs for important categories or small lists
        docs.forEach(doc => {
          markdown += `- \`${doc.relativePath}\` - ${doc.description}\n`
        })
      } else {
        // Show key docs + count for large lists
        const keyDocs = docs.filter(d =>
          !d.relativePath.includes('.archive') &&
          !d.relativePath.includes('node_modules') &&
          !d.description.includes('Documentation file')
        ).slice(0, 5)

        keyDocs.forEach(doc => {
          markdown += `- \`${doc.relativePath}\` - ${doc.description}\n`
        })

        if (docs.length > keyDocs.length) {
          markdown += `- *... and ${docs.length - keyDocs.length} more files (see DOCUMENTATION_INDEX.md for full list)*\n`
        }
      }

      markdown += `\n`
    })

    markdown += `**When to read what**: See \`.process/WHEN_TO_READ.md\` for complete reading strategy\n\n`
    markdown += `---\n`

    return markdown
  }
}
