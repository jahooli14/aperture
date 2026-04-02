import { supabase } from './supabase';
import type { Idea, FrontierBlock } from './types';

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
  qualifies_as_frontier_block: boolean; // true if overall > 0.7
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
  const conceptualDistance = await calculateConceptualDistance(
    userId,
    idea.embedding || []
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
    qualifies_as_frontier_block: overall > 0.7,
  };
}

/**
 * 1. Domain pair novelty
 */
async function calculateDomainPairNovelty(
  userId: string,
  domainPair: [string, string]
): Promise<number> {
  const [a, b] = domainPair.sort();

  const { data, error } = await supabase
    .from('ie_domain_pairs')
    .select('times_generated, last_generated_at')
    .eq('user_id', userId)
    .eq('domain_a', a)
    .eq('domain_b', b)
    .single();

  if (error || !data) {
    // Never explored before = maximum novelty
    return 1.0;
  }

  // If explored before, novelty decays with time since last exploration
  const timesGenerated = data.times_generated;
  if (timesGenerated === 0) return 1.0;

  // Decay over 90 days
  const lastGenerated = data.last_generated_at
    ? new Date(data.last_generated_at)
    : new Date(0);
  const daysSince = (Date.now() - lastGenerated.getTime()) / (1000 * 60 * 60 * 24);

  const timeDecay = Math.min(1.0, daysSince / 90);

  // Exploration penalty: more times explored = less novel
  const explorationPenalty = Math.max(0, 1 - timesGenerated * 0.1);

  return timeDecay * explorationPenalty;
}

/**
 * 2. Conceptual distance from existing clusters
 */
async function calculateConceptualDistance(
  userId: string,
  embedding: number[]
): Promise<number> {
  if (embedding.length === 0) return 0.5; // Unknown

  // Find the closest idea using vector similarity
  const { data, error } = await supabase.rpc('match_ie_ideas', {
    query_embedding: embedding,
    match_threshold: 0.0, // Get all matches
    match_count: 1,
    filter_user_id: userId,
  });

  if (error || !data || data.length === 0) {
    // No existing ideas = maximum distance
    return 1.0;
  }

  // Distance = 1 - similarity
  const closestSimilarity = data[0].similarity;
  return 1 - closestSimilarity;
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
 * Create a frontier block from an approved idea
 */
export async function createFrontierBlock(
  userId: string,
  idea: Idea,
  fas: FASResult,
  abstractPattern?: string
): Promise<FrontierBlock | null> {
  if (!fas.qualifies_as_frontier_block) {
    console.log(`Idea "${idea.title}" does not qualify as frontier block (FAS: ${fas.overall})`);
    return null;
  }

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
      generation: idea.generation_number + 1,
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
