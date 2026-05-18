// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import RewritePanel from './RewritePanel'
import { useAIStore } from '../stores/useAIStore'

// Mock only the network boundary — the real component, store, and diff run.
vi.mock('../lib/gemini', () => ({
  streamRewrite: async function* () {
    yield 'The old '
    yield 'house creaked.'
  },
}))

const ctx = {
  manuscriptTitle: 'Book',
  sectionLabel: 'Chapter 1',
  sceneTitle: 'Opening',
  sceneBeat: null,
  prose: 'The ancient old building made a noise.',
}

beforeEach(() => {
  cleanup()
  // jsdom doesn't implement scrollTo; the panel auto-scrolls its result.
  Element.prototype.scrollTo = vi.fn()
  useAIStore.getState().setApiKey('test-key')
})

describe('RewritePanel — the redraft flow end to end', () => {
  it('preset → streamed rewrite → tracked-changes diff → Replace fires onAccept', async () => {
    const onAccept = vi.fn()
    render(
      <RewritePanel
        passage="The ancient old building made a noise."
        ctx={ctx}
        onClose={() => {}}
        onAccept={onAccept}
      />
    )

    // The original passage is shown.
    expect(screen.getByText(/ancient old building/)).toBeTruthy()

    // Tap a preset — this runs the (mocked) stream through the real store path.
    fireEvent.click(screen.getByText('Tighten'))

    // Streaming finishes -> Replace + the tracked-changes Clean toggle appear.
    await waitFor(() => expect(screen.getByText('Replace')).toBeTruthy())
    expect(screen.getByText('Clean view')).toBeTruthy()

    // Clean view shows the rewritten passage contiguously.
    fireEvent.click(screen.getByText('Clean view'))
    await waitFor(() =>
      expect(document.body.textContent).toContain('The old house creaked.')
    )

    // Accept replaces with exactly the rewritten text.
    fireEvent.click(screen.getByText('Replace'))
    expect(onAccept).toHaveBeenCalledWith('The old house creaked.')
  })

  it('custom instruction also drives a rewrite', async () => {
    const onAccept = vi.fn()
    render(
      <RewritePanel
        passage="Some prose to change."
        ctx={ctx}
        onClose={() => {}}
        onAccept={onAccept}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/describe the change/i), {
      target: { value: 'make it tense' },
    })
    fireEvent.click(screen.getByText('Tighten')) // any trigger; stream is mocked
    await waitFor(() => expect(screen.getByText('Replace')).toBeTruthy())
    fireEvent.click(screen.getByText('Replace'))
    expect(onAccept).toHaveBeenCalledWith('The old house creaked.')
  })
})
