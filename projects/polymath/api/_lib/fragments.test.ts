import { describe, it, expect } from 'vitest'
import { chooseProject } from './fragments.js'

/**
 * Every number here is measured from the live corpus, not invented. The
 * whole failure this guards against is that an absolute similarity floor
 * decides nothing in this vector space: notes score 0.55-0.66 against their
 * nearest project whatever they are about, so 0.5 admitted 98% of them and
 * the winner was whichever project won by a hair.
 */
describe('chooseProject', () => {
  it('takes a project that clearly beats the rest', () => {
    // "Aperture app interface on large displays" -> Aperture, by 0.102.
    expect(chooseProject([0.71, 0.61, 0.58])).toBe(0)
  })

  it('refuses a coin toss, however high both scores are', () => {
    // "Cervical spine injection recovery" scored 0.000 apart on
    // "Painting where you tip the canvas" and "Paint one wood block".
    expect(chooseProject([0.62, 0.62, 0.60])).toBeNull()
    // "Nutritional profile of yellow tropical fruit", 0.003 apart.
    expect(chooseProject([0.601, 0.598])).toBeNull()
  })

  it('refuses anything below the floor even when it wins by miles', () => {
    // Nearest does not mean near. A lone weak match is still not about it.
    expect(chooseProject([0.31, 0.02])).toBeNull()
  })

  it('needs no margin when there is only one project to choose from', () => {
    expect(chooseProject([0.62])).toBe(0)
    expect(chooseProject([0.31])).toBeNull()
  })

  it('says nothing when there are no projects with vectors', () => {
    expect(chooseProject([])).toBeNull()
  })

  it('keeps the measured true pairs and drops the measured wrong ones', () => {
    // Real margins, in order: Aperture, the dream-door note to the vivid
    // dreams book, the woodwork course to the wood block, the baby's
    // milestone to Pupils -- all attach.
    for (const m of [0.102, 0.089, 0.073, 0.067]) {
      expect(chooseProject([0.66, 0.66 - m])).toBe(0)
    }
    // And the ones that were wrong: a note about Arsenal's defensive
    // organisation landing on "The Geometry of Good Vibes" (0.055), and
    // "this input is nice UX" landing there too rather than on Aperture.
    for (const m of [0.056, 0.055, 0.052, 0.019, 0.002]) {
      expect(chooseProject([0.66, 0.66 - m])).toBeNull()
    }
  })

  it('is unmoved by how many weak candidates trail behind', () => {
    // Only the runner-up can dispute the winner; a long tail is not evidence.
    expect(chooseProject([0.70, 0.60, 0.59, 0.58, 0.57, 0.20])).toBe(0)
  })
})
