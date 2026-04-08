/**
 * Project Theme Helpers
 * Shared color/theme utilities for project cards and components
 */

export const PROJECT_COLORS: Record<string, string> = {
  tech: 'var(--project-tech-rgb)',
  art: 'var(--project-art-rgb)',
  writing: 'var(--project-writing-rgb)',
  music: 'var(--project-music-rgb)',
  business: 'var(--project-business-rgb)',
  life: 'var(--project-life-rgb)',
  creative: 'var(--project-creative-rgb)',
  learning: 'var(--project-learning-rgb)',
  default: 'var(--project-default-rgb)'
}

/**
 * All valid project type categories used across Create/Edit dialogs.
 */
export const PROJECT_TYPES = ['Writing', 'Tech', 'Art', 'Music', 'Business', 'Creative', 'Learning'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

/**
 * Returns a theme object with border, bg, text, and raw rgb values
 * for a given project type and title. Uses a deterministic hash
 * fallback when the type is not in PROJECT_COLORS.
 */
export function getTheme(type: string, title: string) {
  const t = type?.toLowerCase().trim() || ''
  let rgb = PROJECT_COLORS[t]
  if (!rgb) {
    const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash)
    }
    rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
  }
  return {
    border: `rgba(${rgb}, 0.25)`,
    borderColor: `rgba(${rgb}, 0.25)`,
    bg: `rgba(${rgb}, 0.1)`,
    backgroundColor: `rgba(${rgb}, 0.08)`,
    text: `rgb(${rgb})`,
    textColor: `rgb(${rgb})`,
    rgb: rgb
  }
}
