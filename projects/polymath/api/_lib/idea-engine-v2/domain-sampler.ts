import { supabase } from './supabase.js';
import type { DomainPair, Domain } from './types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const domains = JSON.parse(readFileSync(join(__dirname, 'domains.json'), 'utf-8'));

/**
 * Domain Sampler
 * Selects domain pairs based on:
 * - 70% high-distance pairs (unexplored or high distance score)
 * - 20% medium-distance pairs
 * - 10% single-domain deep iteration
 */

export interface DomainSamplerConfig {
  highDistanceWeight: number; // 0.7
  mediumDistanceWeight: number; // 0.2
  singleDomainWeight: number; // 0.1
  penaltyThreshold: number; // Skip pairs with penalty > this
}

const DEFAULT_CONFIG: DomainSamplerConfig = {
  highDistanceWeight: 0.7,
  mediumDistanceWeight: 0.2,
  singleDomainWeight: 0.1,
  penaltyThreshold: 0.5,
};

/**
 * Calculate semantic distance between two domains based on concept overlap
 */
function calculateDomainDistance(domainA: Domain, domainB: Domain): number {
  const conceptsA = new Set(domainA.concepts.map((c) => c.toLowerCase()));
  const conceptsB = new Set(domainB.concepts.map((c) => c.toLowerCase()));

  const intersection = new Set([...conceptsA].filter((x) => conceptsB.has(x)));
  const union = new Set([...conceptsA, ...conceptsB]);

  const jaccardSimilarity = intersection.size / union.size;
  const distance = 1 - jaccardSimilarity; // Higher = more distant

  return distance;
}

/**
 * Get domain pairs with their usage stats
 */
async function getDomainPairStats(
  userId: string
): Promise<Map<string, DomainPair>> {
  const { data, error } = await supabase
    .from('ie_domain_pairs')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching domain pair stats:', error);
    return new Map();
  }

  const map = new Map<string, DomainPair>();
  for (const pair of data || []) {
    const key = [pair.domain_a, pair.domain_b].sort().join('|');
    map.set(key, pair);
  }

  return map;
}

/**
 * Create or update domain pair stats
 */
export async function recordDomainPairGeneration(
  userId: string,
  domainA: string,
  domainB: string
): Promise<void> {
  const [a, b] = [domainA, domainB].sort(); // Always sort alphabetically

  // Check if pair exists
  const { data: existing } = await supabase
    .from('ie_domain_pairs')
    .select('times_generated')
    .eq('user_id', userId)
    .eq('domain_a', a)
    .eq('domain_b', b)
    .single();

  const { error } = await supabase.from('ie_domain_pairs').upsert(
    {
      user_id: userId,
      domain_a: a,
      domain_b: b,
      times_generated: (existing?.times_generated || 0) + 1,
      last_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,domain_a,domain_b',
    }
  );

  if (error) {
    console.error('Error recording domain pair generation:', error);
  }
}

/**
 * Sample a domain pair based on evolutionary pressure
 */
export async function sampleDomainPair(
  userId: string,
  config: DomainSamplerConfig = DEFAULT_CONFIG,
  rejectionPatterns: string[] = []
): Promise<[string, string]> {
  const allDomains: Domain[] = domains.domains as any[];
  const domainPairStats = await getDomainPairStats(userId);

  // Build list of all possible pairs
  const allPairs: Array<{
    domains: [string, string];
    distance: number;
    stats?: DomainPair;
    penalty: number;
  }> = [];

  for (let i = 0; i < allDomains.length; i++) {
    for (let j = i + 1; j < allDomains.length; j++) {
      const domainA = allDomains[i];
      const domainB = allDomains[j];
      const key = [domainA.id, domainB.id].sort().join('|');
      const stats = domainPairStats.get(key);

      // Check if this pair is penalized by rejection patterns
      const isPenalized = rejectionPatterns.includes(key);
      const penalty = isPenalized ? (stats?.penalty_weight || 0.5) : 0;

      // Skip heavily penalized pairs
      if (penalty > config.penaltyThreshold) {
        continue;
      }

      const distance = calculateDomainDistance(domainA, domainB);

      allPairs.push({
        domains: [domainA.id, domainB.id],
        distance,
        stats,
        penalty,
      });
    }
  }

  // Single-domain pairs (for deep iteration)
  for (const domain of allDomains) {
    const key = `${domain.id}|${domain.id}`;
    const stats = domainPairStats.get(key);
    const isPenalized = rejectionPatterns.includes(key);
    const penalty = isPenalized ? (stats?.penalty_weight || 0.5) : 0;

    if (penalty <= config.penaltyThreshold) {
      allPairs.push({
        domains: [domain.id, domain.id],
        distance: 0, // Zero distance for same domain
        stats,
        penalty,
      });
    }
  }

  // Categorize pairs by distance
  const highDistancePairs = allPairs.filter((p) => p.distance > 0.7);
  const mediumDistancePairs = allPairs.filter(
    (p) => p.distance >= 0.3 && p.distance <= 0.7
  );
  const singleDomainPairs = allPairs.filter((p) => p.distance === 0);

  // Sample based on weights
  const rand = Math.random();
  let selectedPairs: typeof allPairs;

  if (rand < config.highDistanceWeight) {
    // 70%: High distance
    selectedPairs =
      highDistancePairs.length > 0 ? highDistancePairs : allPairs;
  } else if (rand < config.highDistanceWeight + config.mediumDistanceWeight) {
    // 20%: Medium distance
    selectedPairs =
      mediumDistancePairs.length > 0 ? mediumDistancePairs : allPairs;
  } else {
    // 10%: Single domain
    selectedPairs =
      singleDomainPairs.length > 0 ? singleDomainPairs : allPairs;
  }

  // Within category, prefer less-explored pairs
  selectedPairs.sort((a, b) => {
    const aExploration = a.stats?.times_generated || 0;
    const bExploration = b.stats?.times_generated || 0;
    const aPenalty = a.penalty;
    const bPenalty = b.penalty;

    // Penalize more, explore less = lower priority
    return aExploration + aPenalty * 10 - (bExploration + bPenalty * 10);
  });

  // Add some randomness to avoid deterministic selection
  const topN = Math.min(5, selectedPairs.length);
  const candidates = selectedPairs.slice(0, topN);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  return selected.domains as [string, string];
}

/**
 * Get neglected domain pairs (for forced exploration)
 */
export async function getNeglectedDomainPairs(
  userId: string,
  thresholdDays: number = 30,
  limit: number = 5
): Promise<Array<[string, string]>> {
  const { data, error } = await supabase.rpc('get_neglected_domain_pairs', {
    p_user_id: userId,
    threshold_days: thresholdDays,
    limit_count: limit,
  });

  if (error) {
    console.error('Error fetching neglected domain pairs:', error);
    return [];
  }

  return (data || []).map((row: any) => [row.domain_a, row.domain_b]);
}

/**
 * Initialize domain pairs in the database (run once)
 */
export async function initializeDomainPairs(userId: string): Promise<void> {
  const allDomains: Domain[] = domains.domains as any[];
  const pairs: Array<{
    user_id: string;
    domain_a: string;
    domain_b: string;
    distance_score: number;
  }> = [];

  for (let i = 0; i < allDomains.length; i++) {
    for (let j = i; j < allDomains.length; j++) {
      const domainA = allDomains[i];
      const domainB = allDomains[j];
      const distance = calculateDomainDistance(domainA, domainB);

      const [a, b] = [domainA.id, domainB.id].sort();

      pairs.push({
        user_id: userId,
        domain_a: a,
        domain_b: b,
        distance_score: distance,
      });
    }
  }

  const { error } = await supabase.from('ie_domain_pairs').upsert(pairs, {
    onConflict: 'user_id,domain_a,domain_b',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('Error initializing domain pairs:', error);
    throw error;
  }

  console.log(`Initialized ${pairs.length} domain pairs for user ${userId}`);
}
