/**
 * Build API and lib TypeScript files for Vercel deployment
 * Compiles TypeScript to JavaScript in-place
 */

import { execSync } from 'child_process'
import { mkdirSync } from 'fs'

try {
  // Create a temporary tsconfig for API compilation
  const apiTsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'node',
      resolveJsonModule: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false,
      noImplicitAny: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noImplicitReturns: false,
      outDir: './',
      rootDir: './'
    },
    include: ['api/**/*.ts', 'lib/**/*.ts', 'scripts/**/*.ts'],
    exclude: ['node_modules', 'src', 'dist']
  }

  // Write temporary tsconfig
  const fs = require('fs')
  fs.writeFileSync('tsconfig.api.json', JSON.stringify(apiTsConfig, null, 2))

  // Compile with tsc
  console.log('Compiling API and lib TypeScript files...')
  execSync('npx tsc -p tsconfig.api.json', { stdio: 'inherit' })

  // Remove temporary tsconfig
  fs.unlinkSync('tsconfig.api.json')

  console.log('✓ API and lib TypeScript compilation complete')
} catch (error) {
  console.error('✗ API compilation failed:', error)
  process.exit(1)
}
