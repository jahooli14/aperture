import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArticleVerdict } from './ArticleVerdict'

const noop = () => {}

// framer-motion's whileInView needs this; jsdom has none.
class FakeObserver { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } }
;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver

describe('ArticleVerdict', () => {
  it('offers the note first on an article with no verdict', () => {
    const onCaptureThought = vi.fn()
    render(<ArticleVerdict resonance={null} saving={false} onChoose={noop} onUndo={noop} onCaptureThought={onCaptureThought} onDone={noop} />)
    const buttons = screen.getAllByRole('button').map(b => b.textContent)
    expect(buttons[0]).toMatch(/Sparked something\? Say it/)
    expect(buttons).toContain('This was good')
    expect(buttons).toContain('Not for me')
    fireEvent.click(screen.getByText(/Sparked something\? Say it/))
    expect(onCaptureThought).toHaveBeenCalledTimes(1)
  })

  it.each(['good', 'not_for_me'] as const)('still offers the note after a %s verdict', verdict => {
    const onCaptureThought = vi.fn()
    render(<ArticleVerdict resonance={verdict} saving={false} onChoose={noop} onUndo={noop} onCaptureThought={onCaptureThought} onDone={noop} />)
    fireEvent.click(screen.getByText(/Sparked something\? Say it/))
    expect(onCaptureThought).toHaveBeenCalledTimes(1)
  })
})
