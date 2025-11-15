import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { MergeResult, SourceConfig } from './types.js'

export class ChangeApplicator {
  private maxDailyChanges: number

  constructor(config: SourceConfig) {
    this.maxDailyChanges = config.maxDailyChanges
  }

  async applyChanges(mergeResults: MergeResult[]): Promise<{ applied: MergeResult[]; skipped: MergeResult[] }> {
    console.log(`Applying ${mergeResults.length} changes...`)

    // Respect daily limits
    const toApply = mergeResults.slice(0, this.maxDailyChanges)
    const skipped = mergeResults.slice(this.maxDailyChanges)

    if (skipped.length > 0) {
      console.log(`  Applying ${toApply.length}, skipping ${skipped.length} (daily limit: ${this.maxDailyChanges})`)
    }

    const applied: MergeResult[] = []

    for (const result of toApply) {
      if (await this.applySingleChange(result)) {
        applied.push(result)
        console.log(`  ✅ Applied: ${result.targetFile} (${result.targetSection})`)
      } else {
        console.log(`  ❌ Failed: ${result.targetFile} (${result.targetSection})`)
        skipped.push(result)
      }
    }

    return { applied, skipped }
  }

  private async applySingleChange(result: MergeResult): Promise<boolean> {
    try {
      // Read current file
      const currentContent = readFileSync(result.targetFile, 'utf-8')

      // Find the section to replace
      const updatedContent = this.replaceSectionContent(
        currentContent,
        result.targetSection,
        result.beforeContent,
        result.afterContent
      )

      if (!updatedContent) {
        console.log(`    Could not locate section "${result.targetSection}" in ${result.targetFile}`)
        return false
      }

      // Validate the change doesn't break file structure
      if (!this.validateFileStructure(updatedContent)) {
        console.log(`    Updated content would break file structure`)
        return false
      }

      // Write the updated content
      writeFileSync(result.targetFile, updatedContent, 'utf-8')
      return true

    } catch (error) {
      console.error(`    Error applying change to ${result.targetFile}:`, error)
      return false
    }
  }

  private replaceSectionContent(
    fileContent: string,
    sectionName: string,
    oldContent: string,
    newContent: string
  ): string | null {
    try {
      // Try to find the exact old content first
      if (fileContent.includes(oldContent)) {
        return fileContent.replace(oldContent, newContent)
      }

      // If exact match fails, try to find by section header
      const lines = fileContent.split('\n')
      let sectionStart = -1
      let sectionEnd = -1

      // Find section start
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(sectionName)) {
          sectionStart = i
          break
        }
      }

      if (sectionStart === -1) {
        return null
      }

      // Find section end (next ## heading or end of file)
      for (let i = sectionStart + 1; i < lines.length; i++) {
        if (lines[i].startsWith('##') || lines[i].startsWith('---')) {
          sectionEnd = i
          break
        }
      }

      if (sectionEnd === -1) {
        sectionEnd = lines.length
      }

      // Replace the section
      const beforeSection = lines.slice(0, sectionStart)
      const afterSection = lines.slice(sectionEnd)
      const newSectionLines = newContent.split('\n')

      const result = [
        ...beforeSection,
        ...newSectionLines,
        ...afterSection
      ].join('\n')

      return result

    } catch (error) {
      console.error('Error in replaceSectionContent:', error)
      return null
    }
  }

  private validateFileStructure(content: string): boolean {
    // Basic markdown structure validation
    const lines = content.split('\n')

    // Check for balanced markdown
    let codeBlockCount = 0
    for (const line of lines) {
      if (line.includes('```')) {
        codeBlockCount++
      }
    }

    // Code blocks should be balanced (even number)
    if (codeBlockCount % 2 !== 0) {
      console.log('    Validation failed: Unbalanced code blocks')
      return false
    }

    // Check for reasonable length (not empty, not huge)
    if (content.length < 100 || content.length > 50000) {
      console.log(`    Validation failed: Content length ${content.length} is outside reasonable bounds`)
      return false
    }

    return true
  }

  createBackup(filePath: string): string {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = `${filePath}.backup-${timestamp}`

      writeFileSync(backupPath, content, 'utf-8')
      return backupPath

    } catch (error) {
      console.error(`Error creating backup for ${filePath}:`, error)
      throw error
    }
  }

  restoreFromBackup(filePath: string, backupPath: string): boolean {
    try {
      const backupContent = readFileSync(backupPath, 'utf-8')
      writeFileSync(filePath, backupContent, 'utf-8')
      return true

    } catch (error) {
      console.error(`Error restoring ${filePath} from backup:`, error)
      return false
    }
  }
}

export class SafetyValidator {
  static validateChangeBatch(results: MergeResult[], config: SourceConfig): { valid: MergeResult[]; invalid: MergeResult[] } {
    const valid: MergeResult[] = []
    const invalid: MergeResult[] = []

    for (const result of results) {
      if (this.validateSingleChange(result, config)) {
        valid.push(result)
      } else {
        invalid.push(result)
      }
    }

    return { valid, invalid }
  }

  private static validateSingleChange(result: MergeResult, config: SourceConfig): boolean {
    // Check growth limits
    const beforeLength = result.beforeContent.length
    const afterLength = result.afterContent.length
    const growthRatio = afterLength / beforeLength

    if (growthRatio > config.maxSectionGrowth) {
      console.log(`  Invalid: Section would grow ${(growthRatio * 100).toFixed(1)}% (limit: ${(config.maxSectionGrowth * 100).toFixed(1)}%)`)
      return false
    }

    // Check that we're not removing too much content
    const beforeWords = new Set(result.beforeContent.toLowerCase().match(/\w+/g) || [])
    const afterWords = new Set(result.afterContent.toLowerCase().match(/\w+/g) || [])

    let preservedWords = 0
    for (const word of beforeWords) {
      if (afterWords.has(word)) {
        preservedWords++
      }
    }

    const preservationRatio = preservedWords / beforeWords.size
    if (preservationRatio < 0.7) {
      console.log(`  Invalid: Too much content would be lost (${(preservationRatio * 100).toFixed(1)}% preserved)`)
      return false
    }

    // Check for required elements
    if (!result.afterContent.includes('[Source:') && !result.afterContent.includes('Source: [')) {
      console.log(`  Invalid: No source citation`)
      return false
    }

    return true
  }
}