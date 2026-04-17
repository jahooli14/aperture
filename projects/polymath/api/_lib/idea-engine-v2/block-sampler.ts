import { supabase } from './supabase.js';
import type { FrontierBlock } from './types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const domainsConfig = JSON.parse(
  readFileSync(join(__dirname, 'domains.json'), 'utf-8')
);
const ALL_DOMAIN_IDS: string[] = domainsConfig.domains.map(
  (d: { id: string }) => d.id
);

export type MutationType = 'domain_shift' | 'expansion' | 'inversion';

// Retire a block after it has been mined this many times with low success.
const EXHAUST_SPAWN_THRESHOLD = 5;
const EXHAUST_SUCCESS_RATE = 0.2;
// Active blocks that haven't been touched in this long go dormant.
const DORMANT_DAYS = 30;

/**
 * All 'active' frontier blocks for a user.
 */
export async function getActiveBlocks(userId: string): Promise<FrontierBlock[]> {
  const { data, error } = await supabase
    .from('ie_frontier_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('[block-sampler] Failed to fetch active blocks:', error);
    return [];
  }
  return (data || []) as FrontierBlock[];
}

/**
 * Block sampling weight: blends proven success (after first spawn) with
 * initial FAS (before first spawn), decayed by age and modulated by the
 * block's own temperature.
 */
function blockWeight(block: FrontierBlock): number {
  const fas = block.frontier_advancement_score ?? 0.7;
  const quality = block.spawn_count > 0 ? block.success_rate : fas * 0.7;
  const daysOld =
    (Date.now() - new Date(block.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const recency = Math.max(0.1, 1 - daysOld / 90);
  const temp = block.temperature ?? 1.0;
  return Math.max(0.05, quality) * recency * temp;
}

/**
 * Pick one active block, weighted by blockWeight. Returns null if none exist.
 */
export async function sampleActiveBlock(
  userId: string
): Promise<FrontierBlock | null> {
  const blocks = await getActiveBlocks(userId);
  if (blocks.length === 0) return null;

  const weights = blocks.map(blockWeight);
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return blocks[Math.floor(Math.random() * blocks.length)];

  let r = Math.random() * total;
  for (let i = 0; i < blocks.length; i++) {
    r -= weights[i];
    if (r <= 0) return blocks[i];
  }
  return blocks[blocks.length - 1];
}

/**
 * Top-N active blocks for frontier-gravity injection into fresh prompts.
 */
export async function getTopActiveBlocks(
  userId: string,
  limit: number = 3
): Promise<FrontierBlock[]> {
  const blocks = await getActiveBlocks(userId);
  return blocks
    .map((b) => ({ block: b, w: blockWeight(b) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, limit)
    .map((x) => x.block);
}

/**
 * Choose a mutation operator. Biased toward domain_shift: the highest-value
 * move is applying a proven pattern to an unexplored domain.
 */
export function pickMutation(): MutationType {
  const r = Math.random();
  if (r < 0.55) return 'domain_shift';
  if (r < 0.85) return 'expansion';
  return 'inversion';
}

/**
 * Derive the child's domain pair from the parent block and mutation type.
 * - domain_shift: keep one parent domain, swap the other for a random one
 * - expansion / inversion: keep the same pair (change is in the prompt)
 */
export function mutateDomains(
  parentPair: [string, string],
  mutation: MutationType
): [string, string] {
  if (mutation !== 'domain_shift') return parentPair;

  const keepIdx = Math.random() < 0.5 ? 0 : 1;
  const kept = parentPair[keepIdx];
  const candidates = ALL_DOMAIN_IDS.filter(
    (d) => d !== parentPair[0] && d !== parentPair[1]
  );
  if (candidates.length === 0) return parentPair;
  const swapped = candidates[Math.floor(Math.random() * candidates.length)];
  return keepIdx === 0 ? [kept, swapped] : [swapped, kept];
}

/**
 * Mark that a block was sampled, so the dormancy sweep won't retire it
 * before its child idea has been reviewed.
 */
export async function markBlockSpawned(
  userId: string,
  blockId: string
): Promise<void> {
  const { error } = await supabase
    .from('ie_frontier_blocks')
    .update({ last_spawned_at: new Date().toISOString() })
    .eq('id', blockId)
    .eq('user_id', userId);

  if (error) {
    console.error('[block-sampler] Failed to mark block spawned:', error);
  }
}

/**
 * Update parent-block stats after a child idea is reviewed. Auto-exhausts a
 * block that has produced many children with poor approval rates.
 */
export async function updateBlockLifecycle(
  userId: string,
  blockId: string,
  approved: boolean
): Promise<void> {
  const { data: block, error } = await supabase
    .from('ie_frontier_blocks')
    .select('spawn_count, success_rate, status')
    .eq('id', blockId)
    .eq('user_id', userId)
    .single();

  if (error || !block) {
    console.error('[block-sampler] Failed to load block for lifecycle update:', error);
    return;
  }

  const priorApproved = Math.round(
    (block.success_rate || 0) * (block.spawn_count || 0)
  );
  const newSpawnCount = (block.spawn_count || 0) + 1;
  const newApproved = priorApproved + (approved ? 1 : 0);
  const newSuccessRate = newApproved / newSpawnCount;

  const exhausted =
    newSpawnCount >= EXHAUST_SPAWN_THRESHOLD &&
    newSuccessRate < EXHAUST_SUCCESS_RATE;

  const { error: updateError } = await supabase
    .from('ie_frontier_blocks')
    .update({
      spawn_count: newSpawnCount,
      success_rate: newSuccessRate,
      last_spawned_at: new Date().toISOString(),
      status: exhausted ? 'exhausted' : block.status,
    })
    .eq('id', blockId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('[block-sampler] Failed to update block lifecycle:', updateError);
  } else if (exhausted) {
    console.log(
      `[block-sampler] Block ${blockId} exhausted (${newSpawnCount} spawns, ${(newSuccessRate * 100).toFixed(0)}% success)`
    );
  }
}

/**
 * Retire active blocks that haven't been sampled in DORMANT_DAYS. Runs as
 * part of the review cycle so we don't pay the cost every generation.
 */
export async function sweepDormantBlocks(userId: string): Promise<number> {
  const cutoff = Date.now() - DORMANT_DAYS * 24 * 60 * 60 * 1000;

  const { data: active, error } = await supabase
    .from('ie_frontier_blocks')
    .select('id, last_spawned_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error || !active || active.length === 0) {
    if (error) console.error('[block-sampler] Sweep fetch failed:', error);
    return 0;
  }

  const toRetire = active
    .filter((b) => {
      const lastActivity = b.last_spawned_at
        ? new Date(b.last_spawned_at).getTime()
        : new Date(b.created_at).getTime();
      return lastActivity < cutoff;
    })
    .map((b) => b.id);

  if (toRetire.length === 0) return 0;

  const { error: updateError } = await supabase
    .from('ie_frontier_blocks')
    .update({ status: 'dormant' })
    .in('id', toRetire)
    .eq('user_id', userId);

  if (updateError) {
    console.error('[block-sampler] Sweep update failed:', updateError);
    return 0;
  }

  console.log(`[block-sampler] Marked ${toRetire.length} block(s) as dormant`);
  return toRetire.length;
}

/**
 * Render top active blocks as a short prompt fragment. Used to bias fresh
 * generations toward extending the current frontier rather than retreading.
 */
export function formatFrontierGravity(blocks: FrontierBlock[]): string {
  if (blocks.length === 0) return '';
  return blocks
    .map((b, i) => {
      const pattern = b.abstracted_pattern || b.concept_description;
      return `${i + 1}. ${b.concept_name} — ${pattern}`;
    })
    .join('\n');
}
