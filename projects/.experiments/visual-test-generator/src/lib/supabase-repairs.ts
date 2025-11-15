import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { TestRepair, SelfHealingConfig } from '../types'

let supabase: SupabaseClient | null = null

export function initSupabase(config: SelfHealingConfig): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey)
  }
  return supabase
}

export async function saveRepair(
  repair: TestRepair,
  config: SelfHealingConfig
): Promise<void> {
  const client = initSupabase(config)

  const { error } = await client.from('test_repairs').insert({
    id: repair.id,
    test_file: repair.testFile,
    test_name: repair.testName,
    old_locator: repair.oldLocator,
    new_locator: repair.newLocator,
    new_coordinates: repair.newCoordinates,
    description: repair.description,
    screenshot: repair.screenshot,
    timestamp: repair.timestamp.toISOString(),
    action: repair.action,
    fill_value: repair.fillValue,
    confidence: repair.confidence,
    reasoning: repair.reasoning,
    status: repair.status,
    error_message: repair.errorMessage,
  })

  if (error) {
    console.error('Failed to save repair to Supabase:', error)
  }
}

export async function getRepairs(
  config: SelfHealingConfig,
  status?: 'pending' | 'approved' | 'rejected'
): Promise<TestRepair[]> {
  const client = initSupabase(config)

  let query = client
    .from('test_repairs')
    .select('*')
    .order('timestamp', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch repairs:', error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    testFile: row.test_file,
    testName: row.test_name,
    oldLocator: row.old_locator,
    newLocator: row.new_locator,
    newCoordinates: row.new_coordinates,
    description: row.description,
    screenshot: row.screenshot,
    timestamp: new Date(row.timestamp),
    action: row.action,
    fillValue: row.fill_value,
    confidence: row.confidence,
    reasoning: row.reasoning,
    status: row.status,
    errorMessage: row.error_message,
  }))
}

export async function approveRepair(
  repairId: string,
  config: SelfHealingConfig
): Promise<void> {
  const client = initSupabase(config)

  const { error } = await client
    .from('test_repairs')
    .update({ status: 'approved' })
    .eq('id', repairId)

  if (error) {
    console.error('Failed to approve repair:', error)
    throw error
  }
}

export async function rejectRepair(
  repairId: string,
  config: SelfHealingConfig
): Promise<void> {
  const client = initSupabase(config)

  const { error } = await client
    .from('test_repairs')
    .update({ status: 'rejected' })
    .eq('id', repairId)

  if (error) {
    console.error('Failed to reject repair:', error)
    throw error
  }
}
