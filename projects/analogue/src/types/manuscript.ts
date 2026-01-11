// Narrative section phases
export type NarrativeSection =
  | 'departure'    // High Drift / High Footnote Conflict
  | 'escape'       // Postman Persona / Sensory Recovery Focus
  | 'rupture'      // The Threshold (The door that won't open)
  | 'alignment'    // Persona Merge / Tightening Prose
  | 'reveal'       // Symmetry Validation

// Senses for recovery tracking
export type Sense = 'sight' | 'smell' | 'sound' | 'taste' | 'touch'

// Awareness/drift scale
export type AwarenessLevel = 'high-drift' | 'moderate-drift' | 'emerging' | 'cohesive' | 'fully-present'

// Identity scene type
export type IdentityType = 'alex' | 'villager-issue'

// Footnote tone
export type FootnoteTone = 'high-acerbic' | 'moderate' | 'gentle' | 'absent'

// Scene node status
export type NodeStatus = 'draft' | 'in-progress' | 'needs-review' | 'complete'

// Validation status for ToC
export type ValidationStatus = 'green' | 'yellow' | 'red'

// Scene Node - the core unit of the manuscript
export interface SceneNode {
  id: string
  order: number
  title: string
  section: NarrativeSection

  // Content
  prose: string
  footnotes: string
  wordCount: number

  // Pulse Check results
  identityType: IdentityType | null
  sensoryFocus: Sense | null
  awarenessLevel: AwarenessLevel | null
  footnoteTone: FootnoteTone | null

  // Validation
  status: NodeStatus
  validationStatus: ValidationStatus
  checklist: ChecklistItem[]

  // Tracking
  sensesActivated: Sense[]
  glassesmentions: GlassesMention[]
  reverberations: Reverberation[]

  // Timestamps
  createdAt: string
  updatedAt: string
  pulseCheckCompletedAt: string | null
}

// Dynamic checklist item
export interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  category: 'identity' | 'sensory' | 'footnote' | 'structure'
}

// Reverberation - tagged wisdom from villagers
export interface Reverberation {
  id: string
  sceneId: string
  text: string
  speaker: 'al' | 'lexi' | 'villager'
  villagerName?: string
  linkedRevealSceneId?: string | null
  createdAt: string
}

// Glasses mention tracking
export interface GlassesMention {
  id: string
  sceneId: string
  text: string
  isValidDraw: boolean // true if described as "draw" or "anchor"
  flagged: boolean
  createdAt: string
}

// Alex identity pair state
export interface AlexIdentityState {
  alPatterns: SpeechPattern[]
  lexiPatterns: SpeechPattern[]
  syncStatus: 'synced' | 'divergent' | 'needs-review'
  lastSyncCheck: string | null
}

// Speech pattern for identity tracking
export interface SpeechPattern {
  id: string
  phrase: string
  characterSource: 'al' | 'lexi'
  occurrences: PatternOccurrence[]
}

export interface PatternOccurrence {
  sceneId: string
  position: number
  context: string
}

// Sensory audit state
export interface SensoryAuditState {
  sight: SenseStatus
  smell: SenseStatus
  sound: SenseStatus
  taste: SenseStatus
  touch: SenseStatus
}

export interface SenseStatus {
  activated: boolean
  activationSceneId: string | null
  strength: 'weak' | 'moderate' | 'strong'
  occurrences: number
}

// Manuscript-level state
export interface ManuscriptState {
  id: string
  title: string
  protagonistRealName: string
  maskModeEnabled: boolean
  currentSection: NarrativeSection
  totalWordCount: number
  scenes: SceneNode[]
  alexIdentity: AlexIdentityState
  sensoryAudit: SensoryAuditState
  reverberationLibrary: Reverberation[]
  revealAuditUnlocked: boolean
  createdAt: string
  updatedAt: string
}

// Reveal audit ghost checklist
export interface RevealAuditItem {
  id: string
  villagerName: string
  issueTheme: string
  originalSceneId: string
  echoedInReveal: boolean
  echoText: string | null
}
