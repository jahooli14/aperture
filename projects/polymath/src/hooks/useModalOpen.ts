import { useEffect, useState } from 'react'

// A dialog or sheet, or any full-screen surface that says it owns the screen
// (the session's focus shell). Anything that wants the floating + button out
// of its way adds `data-hides-fab`.
const MODAL_SELECTOR = '[aria-modal="true"], [data-hides-fab]'

/**
 * True while any dialog, bottom sheet or full-screen session view is open.
 *
 * The floating + button sits above every sheet (it has to — it's the
 * recorder's stop button), which put it on top of each sheet's main action:
 * "Create list", "Tap to talk", "Start this project". Watching the DOM for
 * the shared `aria-modal` attribute means every present and future sheet is
 * covered without each one having to announce itself.
 */
export function useModalOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const check = () => setOpen(document.querySelector(MODAL_SELECTOR) !== null)
    check()
    // Coalesce bursts (animations, toasts) into one lookup per frame.
    let frame = 0
    const observer = new MutationObserver(() => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; check() })
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'data-hides-fab'],
    })
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [])

  return open
}
