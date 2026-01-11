import type {
  SceneNode,
  ValidationStatus,
  ChecklistItem,
  NarrativeSection,
  SensoryAuditState,
  Sense
} from '../types/manuscript'

// Generate checklist items based on Pulse Check answers
export function generateChecklist(scene: SceneNode): ChecklistItem[] {
  const items: ChecklistItem[] = []

  // Identity-based items
  if (scene.identityType === 'alex') {
    items.push({
      id: 'alex-sync',
      label: 'Al/Lexi speech patterns consistent',
      checked: false,
      category: 'identity'
    })
    items.push({
      id: 'alex-advice',
      label: 'Core wisdom tagged if present',
      checked: false,
      category: 'identity'
    })
  } else if (scene.identityType === 'villager-issue') {
    items.push({
      id: 'villager-issue',
      label: 'Mental issue clearly represented',
      checked: false,
      category: 'identity'
    })
  }

  // Sensory focus items
  if (scene.sensoryFocus) {
    const senseLabels: Record<Sense, string> = {
      sight: 'Visual recovery moment described',
      smell: 'Olfactory recovery moment described',
      sound: 'Auditory recovery moment described',
      taste: 'Gustatory recovery moment described',
      touch: 'Tactile recovery moment described'
    }
    items.push({
      id: `sense-${scene.sensoryFocus}`,
      label: senseLabels[scene.sensoryFocus],
      checked: false,
      category: 'sensory'
    })
  }

  // Awareness/drift items
  if (scene.awarenessLevel === 'high-drift' || scene.awarenessLevel === 'moderate-drift') {
    items.push({
      id: 'drift-footnote',
      label: 'Footnotes marked as acerbic (drift signal)',
      checked: false,
      category: 'footnote'
    })
  }

  // Section-specific items
  const sectionItems = getSectionSpecificItems(scene.section)
  items.push(...sectionItems)

  return items
}

function getSectionSpecificItems(section: NarrativeSection): ChecklistItem[] {
  switch (section) {
    case 'departure':
      return [{
        id: 'departure-conflict',
        label: 'High footnote conflict established',
        checked: false,
        category: 'structure'
      }]
    case 'escape':
      return [{
        id: 'escape-postman',
        label: 'Postman persona active',
        checked: false,
        category: 'structure'
      }]
    case 'rupture':
      return [{
        id: 'rupture-door',
        label: 'Threshold/door imagery present',
        checked: false,
        category: 'structure'
      }]
    case 'alignment':
      return [{
        id: 'alignment-merge',
        label: 'Persona merge signals present',
        checked: false,
        category: 'structure'
      }]
    case 'reveal':
      return [{
        id: 'reveal-symmetry',
        label: 'All reverberations echoed',
        checked: false,
        category: 'structure'
      }]
    default:
      return []
  }
}

// Validate scene and return status
export function validateScene(scene: SceneNode): ValidationStatus {
  // Red: Logic errors (identity inconsistency, invalid glasses usage)
  if (hasLogicErrors(scene)) {
    return 'red'
  }

  // Yellow: Written but incomplete checks
  if (scene.prose.length > 0 && !allChecklistComplete(scene)) {
    return 'yellow'
  }

  // Green: All complete
  if (scene.prose.length > 0 && allChecklistComplete(scene)) {
    return 'green'
  }

  return 'yellow'
}

function hasLogicErrors(scene: SceneNode): boolean {
  // Check for high-drift without acerbic footnotes
  if (
    (scene.awarenessLevel === 'high-drift' || scene.awarenessLevel === 'moderate-drift') &&
    scene.footnoteTone !== 'high-acerbic'
  ) {
    return true
  }

  // Check for invalid glasses mentions
  const invalidGlasses = scene.glassesmentions?.some(m => !m.isValidDraw && m.flagged)
  if (invalidGlasses) {
    return true
  }

  return false
}

function allChecklistComplete(scene: SceneNode): boolean {
  if (!scene.checklist || scene.checklist.length === 0) {
    return false
  }
  return scene.checklist.every(item => item.checked)
}

// Check if rupture section can be entered
export function canEnterRupture(sensoryAudit: SensoryAuditState): {
  allowed: boolean
  missingSenses: Sense[]
} {
  const senses: Sense[] = ['sight', 'smell', 'sound', 'taste', 'touch']
  const missingSenses = senses.filter(s => !sensoryAudit[s].activated)

  return {
    allowed: missingSenses.length === 0,
    missingSenses
  }
}

// Quality Signal Validator - checks drift/footnote consistency
export function validateQualitySignal(scene: SceneNode): {
  valid: boolean
  message: string
} {
  if (scene.awarenessLevel === 'high-drift' || scene.awarenessLevel === 'moderate-drift') {
    if (scene.footnoteTone !== 'high-acerbic') {
      return {
        valid: false,
        message: 'High drift requires acerbic footnotes to signal intentional style'
      }
    }
  }

  return { valid: true, message: '' }
}

// Check for glasses mentions that need review
export function flagGlassesMention(text: string): {
  isValidDraw: boolean
  reason: string
} {
  const lowerText = text.toLowerCase()

  // Valid patterns - described as draw/anchor/reach/want
  const validPatterns = ['draw', 'anchor', 'reach', 'want', 'desire', 'pull', 'tempt']
  const hasValidPattern = validPatterns.some(p => lowerText.includes(p))

  // Invalid patterns - described as active tool/wearing/using
  const invalidPatterns = ['wear', 'wore', 'put on', 'through the', 'see through', 'looking through']
  const hasInvalidPattern = invalidPatterns.some(p => lowerText.includes(p))

  if (hasInvalidPattern) {
    return {
      isValidDraw: false,
      reason: 'Glasses appear to be used as active tool - should be draw/anchor only'
    }
  }

  if (hasValidPattern) {
    return {
      isValidDraw: true,
      reason: 'Correctly described as draw/anchor'
    }
  }

  return {
    isValidDraw: false,
    reason: 'Unclear glasses usage - review needed'
  }
}
