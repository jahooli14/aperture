/**
 * NHS Developmental Milestones Data
 * Based on official NHS guidance from nhs.uk and NHS Start4Life
 *
 * Note: All ages are approximate ranges. Every baby develops at their own pace.
 */

export interface Milestone {
  id: string;
  category: 'physical' | 'social' | 'communication' | 'cognitive';
  title: string;
  description: string;
  ageRangeWeeks: {
    start: number; // weeks from birth
    end: number;
  };
  icon: string;
  advanceNoticeWeeks: number; // Show notification this many weeks before start
}

export const milestones: Milestone[] = [
  // Special Life Events
  {
    id: 'born',
    category: 'social',
    title: 'Born',
    description: 'Welcome to the world! Your baby has arrived.',
    ageRangeWeeks: { start: 0, end: 0 },
    icon: '👶',
    advanceNoticeWeeks: 0,
  },
  {
    id: 'coming-home',
    category: 'social',
    title: 'Coming Home',
    description: 'Welcome home! Your baby is settling into their new home.',
    ageRangeWeeks: { start: 0, end: 2 },
    icon: '🏠',
    advanceNoticeWeeks: 0,
  },

  // 0-3 Months
  {
    id: 'social-smile',
    category: 'social',
    title: 'First Social Smile',
    description: 'Your baby may start smiling at you and other familiar faces. This is one of those magical first moments!',
    ageRangeWeeks: { start: 4, end: 8 },
    icon: '😊',
    advanceNoticeWeeks: 2,
  },
  {
    id: 'head-lift',
    category: 'physical',
    title: 'Lifting Their Head',
    description: 'During tummy time, your baby may start lifting their head and chest. This builds important neck strength.',
    ageRangeWeeks: { start: 4, end: 12 },
    icon: '💪',
    advanceNoticeWeeks: 2,
  },
  {
    id: 'cooing',
    category: 'communication',
    title: 'Making Cooing Sounds',
    description: 'Listen out for sweet "ooh" and "aah" sounds. Your baby is learning to use their voice!',
    ageRangeWeeks: { start: 6, end: 10 },
    icon: '🗣️',
    advanceNoticeWeeks: 2,
  },

  // 3-6 Months
  {
    id: 'reaching',
    category: 'physical',
    title: 'Reaching for Objects',
    description: 'Your baby may start reaching out and batting at toys. Hand-eye coordination is developing!',
    ageRangeWeeks: { start: 12, end: 20 },
    icon: '👋',
    advanceNoticeWeeks: 2,
  },
  {
    id: 'rolling',
    category: 'physical',
    title: 'Rolling Over',
    description: 'Your baby may start rolling from front to back, and then back to front. Time to baby-proof!',
    ageRangeWeeks: { start: 16, end: 24 },
    icon: '🔄',
    advanceNoticeWeeks: 3,
  },
  {
    id: 'laughing',
    category: 'social',
    title: 'Giggling and Laughing',
    description: 'Get ready for one of the best sounds ever - your baby\'s first giggles and squeals of delight!',
    ageRangeWeeks: { start: 12, end: 20 },
    icon: '😄',
    advanceNoticeWeeks: 2,
  },
  {
    id: 'babbling',
    category: 'communication',
    title: 'Babbling Sounds',
    description: 'Your baby may start making sounds like "ba," "da," and "ga." Early language development is happening!',
    ageRangeWeeks: { start: 20, end: 28 },
    icon: '💬',
    advanceNoticeWeeks: 3,
  },

  // 6-9 Months
  {
    id: 'sitting',
    category: 'physical',
    title: 'Sitting Independently',
    description: 'Your baby may soon sit up without support. This opens up a whole new view of the world!',
    ageRangeWeeks: { start: 22, end: 36 },
    icon: '🪑',
    advanceNoticeWeeks: 4,
  },
  {
    id: 'stranger-awareness',
    category: 'social',
    title: 'Recognising Familiar Faces',
    description: 'Your baby may start showing they know the difference between family and strangers. This is a healthy development!',
    ageRangeWeeks: { start: 24, end: 32 },
    icon: '👨‍👩‍👧',
    advanceNoticeWeeks: 3,
  },

  // 9-12 Months
  {
    id: 'crawling',
    category: 'physical',
    title: 'Moving Around',
    description: 'Your baby may start crawling, shuffling, or finding their own way to explore. Not all babies crawl - some shuffle on their bottoms, and that\'s perfectly normal!',
    ageRangeWeeks: { start: 28, end: 44 },
    icon: '🚼',
    advanceNoticeWeeks: 4,
  },
  {
    id: 'pulling-up',
    category: 'physical',
    title: 'Pulling to Stand',
    description: 'Your baby may start pulling themselves up using furniture. Keep an eye out as they explore standing!',
    ageRangeWeeks: { start: 36, end: 48 },
    icon: '🧍',
    advanceNoticeWeeks: 4,
  },
  {
    id: 'waving',
    category: 'social',
    title: 'Waving and Clapping',
    description: 'Your baby may start copying actions like waving bye-bye and clapping. So sweet!',
    ageRangeWeeks: { start: 36, end: 48 },
    icon: '👋',
    advanceNoticeWeeks: 4,
  },
  {
    id: 'first-words',
    category: 'communication',
    title: 'First Words',
    description: 'You might hear "mama," "dada," or another word used with meaning. Every baby\'s first word journey is unique!',
    ageRangeWeeks: { start: 40, end: 56 },
    icon: '🗨️',
    advanceNoticeWeeks: 6,
  },
  {
    id: 'pincer-grip',
    category: 'physical',
    title: 'Picking Up Small Objects',
    description: 'Your baby may start using their thumb and forefinger to pick up small items. Time to watch what\'s on the floor even more carefully!',
    ageRangeWeeks: { start: 36, end: 48 },
    icon: '👌',
    advanceNoticeWeeks: 4,
  },

  // 12-18 Months
  {
    id: 'walking',
    category: 'physical',
    title: 'First Steps',
    description: 'Your baby may start taking their first independent steps! Expect lots of tumbles - that\'s all part of learning.',
    ageRangeWeeks: { start: 48, end: 72 },
    icon: '👣',
    advanceNoticeWeeks: 6,
  },
  {
    id: 'words-10-20',
    category: 'communication',
    title: 'Building Vocabulary',
    description: 'Your child may be using 10-20 words now. All children learn to talk at different ages.',
    ageRangeWeeks: { start: 72, end: 84 },
    icon: '📚',
    advanceNoticeWeeks: 8,
  },
  {
    id: 'pretend-play',
    category: 'cognitive',
    title: 'Pretend Play',
    description: 'Watch for your child starting to pretend - maybe feeding a teddy or putting dolls to bed. Imagination is developing!',
    ageRangeWeeks: { start: 72, end: 96 },
    icon: '🧸',
    advanceNoticeWeeks: 8,
  },

  // 18-24 Months
  {
    id: 'two-word-phrases',
    category: 'communication',
    title: 'Putting Words Together',
    description: 'Your child may start combining two words, like "all gone" or "daddy bye-bye." Language is really taking off!',
    ageRangeWeeks: { start: 78, end: 96 },
    icon: '💭',
    advanceNoticeWeeks: 8,
  },
  {
    id: 'running',
    category: 'physical',
    title: 'Running and Jumping',
    description: 'Get ready for more movement! Your child may start running and even jumping with both feet off the ground.',
    ageRangeWeeks: { start: 96, end: 120 },
    icon: '🏃',
    advanceNoticeWeeks: 10,
  },
  {
    id: 'kicking-ball',
    category: 'physical',
    title: 'Kicking a Ball',
    description: 'Your child may start kicking balls and showing better coordination. Physical play is developing!',
    ageRangeWeeks: { start: 96, end: 120 },
    icon: '⚽',
    advanceNoticeWeeks: 10,
  },
  {
    id: 'vocabulary-100',
    category: 'communication',
    title: 'Growing Vocabulary',
    description: 'Your child may have built up a vocabulary of 100-200 words. Every child\'s language journey is different.',
    ageRangeWeeks: { start: 96, end: 120 },
    icon: '🗣️',
    advanceNoticeWeeks: 12,
  },
];

/**
 * Get milestones that should be displayed based on baby's age in weeks
 * Shows milestones in the "advance notice" window before they typically occur
 */
export function getUpcomingMilestones(babyAgeWeeks: number): Milestone[] {
  return milestones.filter((milestone) => {
    const notificationStartWeek = milestone.ageRangeWeeks.start - milestone.advanceNoticeWeeks;
    const notificationEndWeek = milestone.ageRangeWeeks.end;

    return babyAgeWeeks >= notificationStartWeek && babyAgeWeeks <= notificationEndWeek;
  });
}

/**
 * Calculate baby's age in weeks from birthdate
 */
export function calculateAgeInWeeks(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - birth.getTime());
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  return diffWeeks;
}

/**
 * Format age range for display
 */
export function formatAgeRange(startWeeks: number, endWeeks: number): string {
  const startMonths = Math.floor(startWeeks / 4);
  const endMonths = Math.floor(endWeeks / 4);

  if (startMonths === endMonths) {
    return `around ${startMonths} ${startMonths === 1 ? 'month' : 'months'}`;
  }

  return `between ${startMonths}-${endMonths} months`;
}
