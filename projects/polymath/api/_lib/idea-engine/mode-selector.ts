import { supabase } from './supabase.js';
import type { FrontierMode, ModeStats, EvolutionaryPressure } from './types.js';

const ALL_MODES: FrontierMode[] = [
  'translate',
  'tool_transfer',
  'assumption_audit',
  'analogy_mine',
  'compression',
  'inversion',
];

/**
 * Mode Selector
 * Selects frontier mode based on:
 * - Mode entropy (detect collapse)
 * - Success rates (amplify winners)
 * - Forced exploration (maintain diversity)
 */

export interface ModeSelectorConfig {
  entropyThreshold: number; // 0.6 - below this triggers forced exploration
  explorationRate: number; // 0.3 - 30% of selections ignore learned preferences
  minModeWeight: number; // 0.1 - floor probability for each mode
}

const DEFAULT_CONFIG: ModeSelectorConfig = {
  entropyThreshold: 0.6,
  explorationRate: 0.3,
  minModeWeight: 0.1,
};

/**
 * Get mode usage stats for user
 */
async function getModeStats(userId: string): Promise<Map<FrontierMode, ModeStats>> {
  const { data, error } = await supabase
    .from('ie_mode_stats')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching mode stats:', error);
    return new Map();
  }

  const map = new Map<FrontierMode, ModeStats>();
  for (const stat of data || []) {
    map.set(stat.frontier_mode as FrontierMode, stat);
  }

  return map;
}

/**
 * Calculate Shannon entropy of mode distribution
 * Returns 0-1 (0 = collapsed to one mode, 1 = uniform)
 */
export async function calculateModeEntropy(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('calculate_mode_entropy', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error calculating mode entropy:', error);
    return 1.0; // Default to maximum entropy
  }

  return data as number;
}

/**
 * Detect if mode collapse is happening
 */
export async function detectModeCollapse(
  userId: string,
  threshold: number = 0.6
): Promise<boolean> {
  const entropy = await calculateModeEntropy(userId);
  return entropy < threshold;
}

/**
 * Select frontier mode based on evolutionary pressure
 */
export async function selectFrontierMode(
  userId: string,
  pressure?: EvolutionaryPressure,
  config: ModeSelectorConfig = DEFAULT_CONFIG
): Promise<FrontierMode> {
  const rand = Math.random();

  // Forced exploration: ignore learned preferences
  if (rand < config.explorationRate) {
    return ALL_MODES[Math.floor(Math.random() * ALL_MODES.length)];
  }

  // Load mode stats
  const modeStats = await getModeStats(userId);

  // If no stats yet (cold start), uniform random
  if (modeStats.size === 0) {
    return ALL_MODES[Math.floor(Math.random() * ALL_MODES.length)];
  }

  // Calculate weights based on success rate + amplification from pressure
  const weights = new Map<FrontierMode, number>();

  for (const mode of ALL_MODES) {
    const stats = modeStats.get(mode);
    let weight = config.minModeWeight; // Floor weight

    if (stats) {
      // Base weight on success rate (0-1)
      weight += stats.success_rate || 0;

      // Apply amplification from evolutionary pressure
      if (pressure?.amplify.modes) {
        const amplification = pressure.amplify.modes.find((m) => m[0] === mode);
        if (amplification) {
          weight += amplification[1]; // Boost
        }
      }

      // Apply suppression from evolutionary pressure
      if (pressure?.suppress.modes) {
        const suppression = pressure.suppress.modes.find((m) => m[0] === mode);
        if (suppression) {
          weight = Math.max(config.minModeWeight, weight - suppression[1]); // Penalty
        }
      }
    }

    weights.set(mode, weight);
  }

  // Check for mode collapse
  const isCollapsed = await detectModeCollapse(userId, config.entropyThreshold);
  if (isCollapsed) {
    // Force diversity: boost least-used modes
    const leastUsedMode = ALL_MODES
      .map((mode) => ({
        mode,
        uses: modeStats.get(mode)?.times_used || 0,
      }))
      .sort((a, b) => a.uses - b.uses)[0].mode;

    return leastUsedMode;
  }

  // Weighted random selection
  const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
  let randomValue = Math.random() * totalWeight;

  for (const [mode, weight] of weights.entries()) {
    randomValue -= weight;
    if (randomValue <= 0) {
      return mode;
    }
  }

  // Fallback (shouldn't reach here)
  return ALL_MODES[Math.floor(Math.random() * ALL_MODES.length)];
}

/**
 * Record mode usage
 */
export async function recordModeUsage(
  userId: string,
  mode: FrontierMode
): Promise<void> {
  // Check if mode stats exist
  const { data: existing } = await supabase
    .from('ie_mode_stats')
    .select('times_used')
    .eq('user_id', userId)
    .eq('frontier_mode', mode)
    .single();

  const { error } = await supabase.from('ie_mode_stats').upsert(
    {
      user_id: userId,
      frontier_mode: mode,
      times_used: (existing?.times_used || 0) + 1,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,frontier_mode',
    }
  );

  if (error) {
    console.error('Error recording mode usage:', error);
  }
}

/**
 * Update mode success rate after Opus review
 */
export async function updateModeSuccessRate(
  userId: string,
  mode: FrontierMode,
  approved: boolean
): Promise<void> {
  const stats = await getModeStats(userId);
  const currentStats = stats.get(mode);

  if (!currentStats) {
    // Initialize if doesn't exist
    await supabase.from('ie_mode_stats').insert({
      user_id: userId,
      frontier_mode: mode,
      times_used: 1,
      times_approved: approved ? 1 : 0,
      success_rate: approved ? 1.0 : 0.0,
      last_used_at: new Date().toISOString(),
    });
    return;
  }

  const newTimesApproved = currentStats.times_approved + (approved ? 1 : 0);
  const newSuccessRate = newTimesApproved / currentStats.times_used;

  const { error } = await supabase
    .from('ie_mode_stats')
    .update({
      times_approved: newTimesApproved,
      success_rate: newSuccessRate,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('frontier_mode', mode);

  if (error) {
    console.error('Error updating mode success rate:', error);
  }
}

/**
 * Initialize mode stats (run once per user)
 */
export async function initializeModeStats(userId: string): Promise<void> {
  const modes = ALL_MODES.map((mode) => ({
    user_id: userId,
    frontier_mode: mode,
    times_used: 0,
    times_approved: 0,
    success_rate: 0,
    weight_adjustment: 0,
  }));

  const { error } = await supabase.from('ie_mode_stats').upsert(modes, {
    onConflict: 'user_id,frontier_mode',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('Error initializing mode stats:', error);
    throw error;
  }

  console.log(`Initialized mode stats for user ${userId}`);
}
