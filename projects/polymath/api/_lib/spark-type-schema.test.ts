import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { SPARK_TYPES_WRITTEN } from './mull-generator.js'

/**
 * The database's CHECK constraint and the code's spark types have to agree.
 *
 * They have disagreed twice. Migration 022 records the first time: 'gap' was
 * added to the rotation and never to the constraint, so the whole day's bake
 * 500'd. The mull rebuild did it again with 'mull' — and that one took four
 * days to find, because `bake?explain=1` writes nothing, so the one step
 * that was failing is the one step the diagnostic skips.
 *
 * Reading the SQL is crude and that is the point: it fails on the commit
 * that adds a type without a migration, which is the only moment the fix is
 * cheap.
 */
describe('sparks_type_check covers every type the code writes', () => {
  const dir = join(__dirname, '../../migrations')

  /** The last migration that redefines the constraint is the live one. */
  const latest = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => readFileSync(join(dir, f), 'utf8').includes('sparks_type_check'))
    .pop()

  it('a migration defines the constraint', () => {
    expect(latest).toBeDefined()
  })

  const sql = readFileSync(join(dir, latest!), 'utf8')
  const allowed = [...sql.matchAll(/'([a-z_]+)'/g)].map(m => m[1])

  for (const type of SPARK_TYPES_WRITTEN) {
    it(`allows '${type}'`, () => {
      expect(allowed).toContain(type)
    })
  }
})
