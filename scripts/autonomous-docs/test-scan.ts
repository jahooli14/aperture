#!/usr/bin/env node

/**
 * Test script to run just the documentation scanner
 */

import { DocumentationScanner } from './src/scan-docs.js'
import { join } from 'path'

async function main() {
  // Go up two directories to get to repo root
  const repoRoot = join(process.cwd(), '..', '..')
  console.log(`Testing documentation scanner in: ${repoRoot}`)

  const scanner = new DocumentationScanner(repoRoot)

  // Scan documentation
  const docs = await scanner.scanDocumentation()

  console.log('\n📊 Results:')
  console.log(`   Total files found: ${docs.length}`)

  // Group by category
  const categories: Record<string, number> = {}
  docs.forEach(doc => {
    categories[doc.category] = (categories[doc.category] || 0) + 1
  })

  console.log('\n📋 By category:')
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`)
    })

  // Update the index
  await scanner.updateDocumentationIndex(docs)

  console.log('\n✅ Test complete!')
}

main().catch(console.error)
