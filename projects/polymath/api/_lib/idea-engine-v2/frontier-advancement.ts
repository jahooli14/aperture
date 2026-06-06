import { supabase } from './supabase.js';
import type { Idea, FrontierBlock } from './types.js';

/**
 * Frontier Advancement Score (FAS) Calculation
 * Measures how much an idea advances the frontier:
 * - Structural novelty (new domain connections)
 * - Conceptual distance (embedding distance from clusters)
 * - Tractability leap (improvement over prior attempts)
 * - Surprise factor (unexpected approval)
 */

export interface FASComponents {
  structural_novelty: number; // 0-1
  conceptual_distance: number; // 0-1
  tractability_leap: number; // 0-1
  surprise_factor: number; // 0-1
}

export interface FASResult extends FASComponents {
  overall: number; // 0-1
  is_high_signal: boolean; // overall > HIGH_SIGNAL_THRESHOLD — used for digest curation, not block promotion
}

// FAS bar above which an approved idea is "meaningful" enough to surface in
// the daily email. Block promotion ignores this — every BUILD idea becomes a
// block so the sampler has more compositional material; the sampler weights
// by FAS, so low-FAS blocks get drawn rarely.
//
// A genuinely new idea on an unexplored domain pair now scores: 1.0 structural
// × 0.3 + ~0.5 distance × 0.25 + ~0 leap × 0.2 + ~0.5 surprise × 0.25 = ~0.55.
// So the threshold sits right at "novel pair, decent distance and surprise":
// strong cross-domain ideas clear it, safe restatements don't. Anything that
// reuses a recently-mined pair loses most of the structural slice and falls short.
export const HIGH_SIGNAL_THRESHOLD = 0.55;

// Structural novelty counts only mining inside this rolling window, not all
// time. The domain space is finite (20 domains → 210 pairs). An all-time
// counter only ever rises, so once every pair has been mined a handful of
// times the structural slice (30% of FAS) collapses toward 0 permanently and
// the digest bar becomes unreachable again — the exact "nothing clears the bar
// for weeks" failure this score has already hit once. A window lets a pair go
// quiet and read as novel again, so novelty is renewable rather than a one-way
// drain.
export const RECENT_MINING_WINDOW_DAYS = 21;

/**
 * Structural novelty from how many times a pair was mined in the recent window.
 *
 * `timesGenerated` includes the *current* idea's own generation — by review
 * time the idea is already stored, so we subtract one. A connection mined for
 * the first time *in the window* reads as fully novel; novelty then erodes 0.1
 * per prior recent exploration.
 *
 * The count is windowed (see RECENT_MINING_WINDOW_DAYS), not all-time: a pure
 * all-time counter only rises, so structural novelty would decay to ~0 for good
 * once the finite pair space saturates and the digest bar would go unreachable
 * — the failure this score has hit before. Pure + exported so it's unit-testable.
 */
export function structuralNoveltyFromCount(timesGenerated: number): number {
  const priorExplorations = Math.max(0, timesGenerated - 1);
  if (priorExplorations === 0) return 1.0;
  return Math.max(0, 1 - priorExplorations * 0.1);
}

/**
 * Calculate Frontier Advancement Score
 */
export async function calculateFAS(
  userId: string,
  idea: Idea,
  frontierBlocks: FrontierBlock[]
): Promise<FASResult> {
  // 1. Structural novelty: Has this domain pair been explored before?
  const domainPairNovelty = await calculateDomainPairNovelty(
    userId,
    idea.domain_pair
  );

  // 2. Conceptual distance: How far from existing idea clusters?
  // Pass idea.id so the self-match (the idea is already in ie_ideas by the
  // time FAS runs) doesn't collapse distance to 0.
  const conceptualDistance = await calculateConceptualDistance(
    userId,
    idea.embedding || [],
    idea.id
  );

  // 3. Tractability leap: Did we solve something previously hard?
  const tractabilityLeap = await calculateTractabilityLeap(
    userId,
    idea.domain_pair,
    idea.tractability_score || 0
  );

  // 4. Surprise factor: Was approval unexpected?
  const surpriseFactor = await calculateSurpriseFactor(
    userId,
    idea.domain_pair,
    idea.frontier_mode
  );

  // Weighted combination
  const overall =
    domainPairNovelty * 0.3 +
    conceptualDistance * 0.25 +
    tractabilityLeap * 0.2 +
    surpriseFactor * 0.25;

  return {
    structural_novelty: domainPairNovelty,
    conceptual_distance: conceptualDistance,
    tractability_leap: tractabilityLeap,
    surprise_factor: surpriseFactor,
    overall,
    is_high_signal: overall > HIGH_SIGNAL_THRESHOLD,
  };
}

/**
 * 1. Domain pair novelty
 */
async function calculateDomainPairNovelty(
  userId: string,
  domainPair: [string, string]
): Promise<number> {
  const [a, b] = [...domainPair].sort();

  const cutoff = new Date(
    Date.now() - RECENT_MINING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Count how many times this pair was mined inside the recent window. The
  // current idea is already in ie_ideas by review time, so a pair mined for the
  // first time in the window reads as count 1 → fully novel (the count-1 step
  // lives in structuralNoveltyFromCount). `.contains` maps to the TEXT[] @>
  // operator, so element order in domain_pair doesn't matter.
  const { count, error } = await supabase
    .from('ie_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .contains('domain_pair', [a, b]);

  if (error || count === null) {
    // Unknown = treat as novel (matches the prior "no data = max novelty" rule).
    return 1.0;
  }

  return structuralNoveltyFromCount(count);
}

/**
 * 2. Conceptual distance from existing clusters
 */
async function calculateConceptualDistance(
  userId: string,
  embedding: number[],
  excludeIdeaId?: string
): Promise<number> {
  if (embedding.length === 0) return 0.5; // Unknown

  // Find the closest idea using vector similarity. Request 2 so we can skip
  // the idea itself: FAS runs *after* the idea is stored, so the top match is
  // always a self-match with similarity 1.0 and distance 0.
  const { data, error } = await supabase.rpc('match_ie_ideas', {
    query_embedding: embedding,
    match_threshold: 0.0, // Get all matches
    match_count: 2,
    filter_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    // No existing ideas = maximum distance
    return 1.0;
  }

  const others = excludeIdeaId
    ? data.filter((m: { id: string }) => m.id !== excludeIdeaId)
    : data;

  if (others.length === 0) {
    // Only the self-match exists in the corpus — treat as maximum distance.
    return 1.0;
  }

  return 1 - others[0].similarity;
}

/**
 * 3. Tractability leap
 */
async function calculateTractabilityLeap(
  userId: string,
  domainPair: [string, string],
  tractabilityScore: number
): Promise<number> {
  // Find prior ideas with overlapping domains
  const { data, error } = await supabase
    .from('ie_ideas')
    .select('tractability_score, domain_pair')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .limit(100);

  if (error || !data || data.length === 0) {
    return 0; // No prior context
  }

  // Filter for domain overlap
  const overlappingIdeas = data.filter((idea) => {
    const overlap =
      idea.domain_pair &&
      (idea.domain_pair.includes(domainPair[0]) ||
        idea.domain_pair.includes(domainPair[1]));
    return overlap;
  });

  if (overlappingIdeas.length === 0) return 0;

  // Calculate average tractability of prior attempts
  const avgPriorTractability =
    overlappingIdeas.reduce(
      (sum, idea) => sum + (idea.tractability_score || 0),
      0
    ) / overlappingIdeas.length;

  // Leap = improvement over prior average
  const improvement = tractabilityScore - avgPriorTractability;

  return Math.max(0, Math.min(1, improvement)); // Clamp to 0-1
}

/**
 * 4. Surprise factor (1 - expected approval probability)
 */
async function calculateSurpriseFactor(
  userId: string,
  domainPair: [string, string],
  frontierMode: string
): Promise<number> {
  // Get approval rates for this domain pair and mode
  const [a, b] = domainPair.sort();

  const { data: pairData } = await supabase
    .from('ie_domain_pairs')
    .select('success_rate')
    .eq('user_id', userId)
    .eq('domain_a', a)
    .eq('domain_b', b)
    .single();

  const { data: modeData } = await supabase
    .from('ie_mode_stats')
    .select('success_rate')
    .eq('user_id', userId)
    .eq('frontier_mode', frontierMode)
    .single();

  const pairSuccessRate = pairData?.success_rate || 0.5; // Default to 50% if unknown
  const modeSuccessRate = modeData?.success_rate || 0.5;

  // Expected approval = average of pair and mode success rates
  const expectedApproval = (pairSuccessRate + modeSuccessRate) / 2;

  // Surprise = 1 - expected
  return 1 - expectedApproval;
}

/**
 * Create a frontier block from an approved idea. Every BUILD idea is promoted
 * — the sampler's weight function down-ranks low-FAS blocks naturally, so a
 * hard threshold here just deletes compositional material the engine could
 * still benefit from. Curation for the human-facing digest happens elsewhere
 * via the is_high_signal flag.
 */
export async function createFrontierBlock(
  userId: string,
  idea: Idea,
  fas: FASResult,
  abstractPattern?: string
): Promise<FrontierBlock | null> {
  const { data, error } = await supabase
    .from('ie_frontier_blocks')
    .insert({
      user_id: userId,
      source_idea_id: idea.id,
      concept_name: idea.title,
      concept_description: idea.description,
      abstracted_pattern: abstractPattern,
      domain_pair: idea.domain_pair,
      frontier_mode: idea.frontier_mode,
      novelty_at_creation: idea.novelty_score,
      surprise_score: fas.surprise_factor,
      frontier_advancement_score: fas.overall,
      generation: (idea.generation_number || 0) + 1,
      parent_blocks: idea.source_frontier_block_id ? [idea.source_frontier_block_id] : [],
      spawn_count: 0,
      success_rate: 0,
      temperature: 1.0,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating frontier block:', error);
    return null;
  }

  console.log(`🎯 Created frontier block: ${data.concept_name} (FAS: ${fas.overall.toFixed(2)})`);

  return data as FrontierBlock;
}
