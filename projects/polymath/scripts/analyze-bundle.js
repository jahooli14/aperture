#!/usr/bin/env node

/**
 * Bundle Size Analyzer
 * Analyzes Vite build output and reports bundle sizes
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const DIST_DIR = join(process.cwd(), 'dist', 'assets')
const SIZE_LIMITS = {
  'index-*.js': 200 * 1024,        // 200KB for main bundle
  'react-vendor-*.js': 180 * 1024, // 180KB for React (currently 156KB)
  'supabase-*.js': 180 * 1024,     // 180KB for Supabase (currently 161KB)
  'ReaderPage-*.js': 130 * 1024,   // 130KB for Reader (markdown heavy)
  '*Page-*.js': 50 * 1024,         // 50KB for other pages
  '*-*.js': 150 * 1024,            // 150KB for other chunks
  '*-*.css': 100 * 1024,           // 100KB for CSS
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function analyzeBundle() {
  console.log('\n📦 Bundle Size Analysis\n')
  console.log('─'.repeat(60))

  const files = readdirSync(DIST_DIR)
  const bundles = {}
  let totalSize = 0
  let violations = []

  // Group files by type
  files.forEach(file => {
    const filePath = join(DIST_DIR, file)
    const stats = statSync(filePath)
    const size = stats.size
    totalSize += size

    // Categorize
    let category = 'Other'
    if (file.includes('react-vendor')) category = 'React Core'
    else if (file.includes('supabase')) category = 'Supabase'
    else if (file.includes('ui-vendor')) category = 'UI Libraries'
    else if (file.includes('capacitor')) category = 'Capacitor'
    else if (file.includes('google')) category = 'Google AI'
    else if (file.endsWith('.css')) category = 'Styles'
    else if (file.endsWith('.js')) category = 'App Code'

    if (!bundles[category]) bundles[category] = []
    bundles[category].push({ file, size })

    // Check limits based on file pattern
    let limitToCheck = null

    if (file.match(/^react-vendor-.*\.js$/)) {
      limitToCheck = { limit: 180 * 1024, type: 'React vendor' }
    } else if (file.match(/^supabase-.*\.js$/)) {
      limitToCheck = { limit: 180 * 1024, type: 'Supabase' }
    } else if (file.match(/^ReaderPage-.*\.js$/)) {
      limitToCheck = { limit: 130 * 1024, type: 'Reader page' }
    } else if (file.match(/^.*Page-.*\.js$/)) {
      limitToCheck = { limit: 50 * 1024, type: 'Page component' }
    } else if (file.match(/^index-.*\.js$/)) {
      limitToCheck = { limit: 200 * 1024, type: 'Main bundle' }
    } else if (file.match(/^.*-.*\.css$/)) {
      limitToCheck = { limit: 100 * 1024, type: 'CSS' }
    } else if (file.match(/^.*-.*\.js$/)) {
      limitToCheck = { limit: 150 * 1024, type: 'JavaScript chunk' }
    }

    if (limitToCheck && size > limitToCheck.limit) {
      violations.push({
        file,
        size,
        limit: limitToCheck.limit,
        excess: size - limitToCheck.limit,
        type: limitToCheck.type
      })
    }
  })

  // Print by category
  Object.entries(bundles)
    .sort(([, a], [, b]) => {
      const aSize = a.reduce((sum, f) => sum + f.size, 0)
      const bSize = b.reduce((sum, f) => sum + f.size, 0)
      return bSize - aSize
    })
    .forEach(([category, files]) => {
      const categorySize = files.reduce((sum, f) => sum + f.size, 0)
      console.log(`\n${category}: ${formatBytes(categorySize)}`)
      files
        .sort((a, b) => b.size - a.size)
        .forEach(({ file, size }) => {
          const sizeStr = formatBytes(size).padStart(10)
          console.log(`  ${sizeStr}  ${file}`)
        })
    })

  console.log('\n' + '─'.repeat(60))
  console.log(`Total: ${formatBytes(totalSize)}`)
  console.log('─'.repeat(60))

  // Check for violations
  if (violations.length > 0) {
    console.log('\n⚠️  Bundle Size Violations:\n')
    violations.forEach(({ file, size, limit, excess }) => {
      console.log(`❌ ${file}`)
      console.log(`   Size: ${formatBytes(size)} (limit: ${formatBytes(limit)})`)
      console.log(`   Exceeded by: ${formatBytes(excess)}\n`)
    })
    process.exit(1)
  } else {
    console.log('\n✅ All bundles within size limits\n')
  }
}

try {
  analyzeBundle()
} catch (error) {
  console.error('Error analyzing bundle:', error.message)
  process.exit(1)
}
