import type { SceneNode, ValidationStatus } from '../types/manuscript'

// Simple validation: green if prose written, yellow if empty
export function validateScene(scene: SceneNode): ValidationStatus {
  if (scene.prose.length > 0) {
    return 'green'
  }
  return 'yellow'
}

// No-op: checklist generation removed
export function generateChecklist(): [] {
  return []
}
