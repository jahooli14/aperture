/**
 * Developmental Milestone Taxonomy
 *
 * Structured framework for detecting and categorizing child development milestones
 * in voice memories. Based on WHO, CDC, and AAP guidelines.
 */

export interface MilestoneDomain {
  id: string
  name: string
  description: string
  indicators: string[]
}

export interface Milestone {
  id: string
  domain: string
  name: string
  typical_age_months: { min: number; max: number }
  significance: 'major' | 'moderate' | 'minor'
  indicators: string[]
  related_milestones?: string[]
}

export const MILESTONE_DOMAINS: MilestoneDomain[] = [
  {
    id: 'motor_gross',
    name: 'Gross Motor',
    description: 'Large muscle movement - sitting, crawling, walking',
    indicators: ['sit', 'crawl', 'walk', 'run', 'jump', 'climb', 'balance', 'roll']
  },
  {
    id: 'motor_fine',
    name: 'Fine Motor',
    description: 'Small muscle control - grasping, manipulating objects',
    indicators: ['grasp', 'pinch', 'hold', 'release', 'point', 'stack', 'scribble', 'draw']
  },
  {
    id: 'language',
    name: 'Language & Communication',
    description: 'Understanding and using language',
    indicators: ['babble', 'word', 'speak', 'say', 'talk', 'sentence', 'understand', 'respond']
  },
  {
    id: 'cognitive',
    name: 'Cognitive',
    description: 'Thinking, learning, problem-solving',
    indicators: ['recognize', 'remember', 'solve', 'understand', 'learn', 'imitate', 'explore']
  },
  {
    id: 'social_emotional',
    name: 'Social-Emotional',
    description: 'Interaction with others, emotional regulation',
    indicators: ['smile', 'laugh', 'wave', 'share', 'play', 'comfort', 'express', 'empathy']
  },
  {
    id: 'self_care',
    name: 'Self-Care',
    description: 'Independence in daily activities',
    indicators: ['feed', 'drink', 'dress', 'toilet', 'wash', 'brush', 'independent']
  }
]

export const MILESTONE_LIBRARY: Milestone[] = [
  // === GROSS MOTOR ===
  {
    id: 'first_roll',
    domain: 'motor_gross',
    name: 'First roll over',
    typical_age_months: { min: 2, max: 6 },
    significance: 'major',
    indicators: ['roll', 'rolled over', 'turns over', 'flipped']
  },
  {
    id: 'sitting_supported',
    domain: 'motor_gross',
    name: 'Sits with support',
    typical_age_months: { min: 4, max: 7 },
    significance: 'moderate',
    indicators: ['sit', 'sitting', 'supported']
  },
  {
    id: 'sitting_independently',
    domain: 'motor_gross',
    name: 'Sits independently',
    typical_age_months: { min: 5, max: 9 },
    significance: 'major',
    indicators: ['sit alone', 'sitting up', 'sits by herself', 'sits by himself', 'sits unassisted']
  },
  {
    id: 'crawling',
    domain: 'motor_gross',
    name: 'Crawls',
    typical_age_months: { min: 6, max: 11 },
    significance: 'major',
    indicators: ['crawl', 'crawling', 'army crawl', 'scooting']
  },
  {
    id: 'standing_supported',
    domain: 'motor_gross',
    name: 'Stands with support',
    typical_age_months: { min: 7, max: 10 },
    significance: 'moderate',
    indicators: ['stand', 'standing', 'pull up', 'holds onto']
  },
  {
    id: 'first_steps',
    domain: 'motor_gross',
    name: 'First steps',
    typical_age_months: { min: 9, max: 15 },
    significance: 'major',
    indicators: ['first step', 'walked', 'walking', 'took a step']
  },
  {
    id: 'walking_independently',
    domain: 'motor_gross',
    name: 'Walks independently',
    typical_age_months: { min: 11, max: 16 },
    significance: 'major',
    indicators: ['walk alone', 'walking independently', 'walks by herself', 'walks by himself']
  },
  {
    id: 'running',
    domain: 'motor_gross',
    name: 'Runs',
    typical_age_months: { min: 15, max: 24 },
    significance: 'moderate',
    indicators: ['run', 'running', 'ran']
  },
  {
    id: 'jumping',
    domain: 'motor_gross',
    name: 'Jumps',
    typical_age_months: { min: 18, max: 30 },
    significance: 'moderate',
    indicators: ['jump', 'jumping', 'jumped', 'hop']
  },

  // === FINE MOTOR ===
  {
    id: 'grasping_reflex',
    domain: 'motor_fine',
    name: 'Grasps objects',
    typical_age_months: { min: 0, max: 4 },
    significance: 'moderate',
    indicators: ['grasp', 'grabs', 'holds', 'grips']
  },
  {
    id: 'reaching',
    domain: 'motor_fine',
    name: 'Reaches for objects',
    typical_age_months: { min: 3, max: 6 },
    significance: 'moderate',
    indicators: ['reach', 'reaching', 'grabs at']
  },
  {
    id: 'pincer_grasp',
    domain: 'motor_fine',
    name: 'Pincer grasp',
    typical_age_months: { min: 8, max: 12 },
    significance: 'major',
    indicators: ['pinch', 'pincer', 'pick up small', 'thumb and finger']
  },
  {
    id: 'pointing',
    domain: 'motor_fine',
    name: 'Points to objects',
    typical_age_months: { min: 9, max: 14 },
    significance: 'major',
    indicators: ['point', 'pointing', 'points at']
  },
  {
    id: 'stacking',
    domain: 'motor_fine',
    name: 'Stacks blocks',
    typical_age_months: { min: 12, max: 18 },
    significance: 'moderate',
    indicators: ['stack', 'stacking', 'build', 'tower']
  },
  {
    id: 'scribbling',
    domain: 'motor_fine',
    name: 'Scribbles',
    typical_age_months: { min: 15, max: 24 },
    significance: 'moderate',
    indicators: ['scribble', 'draw', 'mark', 'crayon']
  },

  // === LANGUAGE ===
  {
    id: 'cooing',
    domain: 'language',
    name: 'Coos and babbles',
    typical_age_months: { min: 1, max: 4 },
    significance: 'moderate',
    indicators: ['coo', 'babble', 'gurgles', 'makes sounds']
  },
  {
    id: 'responsive_babbling',
    domain: 'language',
    name: 'Responds with babbling',
    typical_age_months: { min: 4, max: 8 },
    significance: 'moderate',
    indicators: ['babble back', 'responds', 'talks back']
  },
  {
    id: 'first_word',
    domain: 'language',
    name: 'First word',
    typical_age_months: { min: 10, max: 14 },
    significance: 'major',
    indicators: ['first word', 'said mama', 'said dada', 'said']
  },
  {
    id: 'word_10',
    domain: 'language',
    name: 'Uses 10+ words',
    typical_age_months: { min: 12, max: 18 },
    significance: 'major',
    indicators: ['words', 'vocabulary', 'says']
  },
  {
    id: 'two_word_phrases',
    domain: 'language',
    name: 'Two-word phrases',
    typical_age_months: { min: 18, max: 24 },
    significance: 'major',
    indicators: ['two word', 'more milk', 'no bed', 'combining words']
  },
  {
    id: 'simple_sentences',
    domain: 'language',
    name: 'Simple sentences',
    typical_age_months: { min: 24, max: 36 },
    significance: 'major',
    indicators: ['sentence', 'full sentence', 'three word']
  },

  // === COGNITIVE ===
  {
    id: 'recognizes_faces',
    domain: 'cognitive',
    name: 'Recognizes familiar faces',
    typical_age_months: { min: 2, max: 5 },
    significance: 'moderate',
    indicators: ['recognize', 'knows me', 'sees me', 'familiar']
  },
  {
    id: 'object_permanence',
    domain: 'cognitive',
    name: 'Object permanence',
    typical_age_months: { min: 6, max: 10 },
    significance: 'major',
    indicators: ['peek-a-boo', 'looks for', 'finds', 'hidden']
  },
  {
    id: 'cause_effect',
    domain: 'cognitive',
    name: 'Understands cause and effect',
    typical_age_months: { min: 8, max: 14 },
    significance: 'moderate',
    indicators: ['press button', 'knows that', 'if then', 'makes happen']
  },
  {
    id: 'problem_solving',
    domain: 'cognitive',
    name: 'Simple problem solving',
    typical_age_months: { min: 15, max: 24 },
    significance: 'moderate',
    indicators: ['figure out', 'solve', 'try different', 'experiment']
  },
  {
    id: 'pretend_play',
    domain: 'cognitive',
    name: 'Pretend play',
    typical_age_months: { min: 18, max: 30 },
    significance: 'major',
    indicators: ['pretend', 'imagine', 'play house', 'feed doll']
  },

  // === SOCIAL-EMOTIONAL ===
  {
    id: 'social_smile',
    domain: 'social_emotional',
    name: 'Social smile',
    typical_age_months: { min: 1, max: 3 },
    significance: 'major',
    indicators: ['smile', 'smiled at', 'smiling']
  },
  {
    id: 'laughing',
    domain: 'social_emotional',
    name: 'Laughs',
    typical_age_months: { min: 3, max: 6 },
    significance: 'major',
    indicators: ['laugh', 'giggle', 'chuckle']
  },
  {
    id: 'stranger_anxiety',
    domain: 'social_emotional',
    name: 'Stranger anxiety',
    typical_age_months: { min: 6, max: 12 },
    significance: 'moderate',
    indicators: ['cry when', 'afraid of stranger', 'cling', 'shy']
  },
  {
    id: 'waving',
    domain: 'social_emotional',
    name: 'Waves bye-bye',
    typical_age_months: { min: 9, max: 14 },
    significance: 'moderate',
    indicators: ['wave', 'bye-bye', 'waves hello']
  },
  {
    id: 'parallel_play',
    domain: 'social_emotional',
    name: 'Parallel play',
    typical_age_months: { min: 12, max: 24 },
    significance: 'moderate',
    indicators: ['play near', 'play alongside', 'watch other kids']
  },
  {
    id: 'sharing',
    domain: 'social_emotional',
    name: 'Shares toys',
    typical_age_months: { min: 24, max: 36 },
    significance: 'moderate',
    indicators: ['share', 'take turns', 'give to']
  },

  // === SELF-CARE ===
  {
    id: 'self_feeding_finger',
    domain: 'self_care',
    name: 'Self-feeds with fingers',
    typical_age_months: { min: 7, max: 12 },
    significance: 'moderate',
    indicators: ['feed herself', 'feed himself', 'pick up food', 'eat by']
  },
  {
    id: 'drinking_cup',
    domain: 'self_care',
    name: 'Drinks from cup',
    typical_age_months: { min: 9, max: 15 },
    significance: 'moderate',
    indicators: ['drink from cup', 'sippy cup', 'holds cup']
  },
  {
    id: 'self_feeding_utensil',
    domain: 'self_care',
    name: 'Uses spoon/fork',
    typical_age_months: { min: 15, max: 24 },
    significance: 'moderate',
    indicators: ['spoon', 'fork', 'eat with', 'use utensil']
  },
  {
    id: 'potty_interest',
    domain: 'self_care',
    name: 'Shows interest in potty',
    typical_age_months: { min: 18, max: 30 },
    significance: 'moderate',
    indicators: ['potty', 'toilet', 'diaper', 'pee', 'poop']
  },
  {
    id: 'dressing_simple',
    domain: 'self_care',
    name: 'Helps with dressing',
    typical_age_months: { min: 24, max: 36 },
    significance: 'moderate',
    indicators: ['put on', 'take off', 'help dress', 'shoes', 'shirt']
  }
]

/**
 * Get milestones by domain
 */
export function getMilestonesByDomain(domainId: string): Milestone[] {
  return MILESTONE_LIBRARY.filter(m => m.domain === domainId)
}

/**
 * Get milestones by age range
 */
export function getMilestonesByAge(ageMonths: number, rangeMonths: number = 3): Milestone[] {
  return MILESTONE_LIBRARY.filter(m =>
    ageMonths >= m.typical_age_months.min - rangeMonths &&
    ageMonths <= m.typical_age_months.max + rangeMonths
  )
}

/**
 * Search for milestone by text indicators
 */
export function findMilestonesByText(text: string): Milestone[] {
  const lowerText = text.toLowerCase()
  return MILESTONE_LIBRARY.filter(m =>
    m.indicators.some(indicator => lowerText.includes(indicator.toLowerCase()))
  )
}

/**
 * Get domain info
 */
export function getDomain(domainId: string): MilestoneDomain | undefined {
  return MILESTONE_DOMAINS.find(d => d.id === domainId)
}
