/**
 * Self-model homepage feature flag.
 *
 * Opt-in via any of:
 *   - URL: ?self=1 (also persists the choice) / ?self=0 (clears it)
 *   - localStorage: polymath-self-model === '1'
 *   - Settings toggle (writes the same localStorage key)
 */

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'polymath-self-model'

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSelfModelFlag(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent('polymath:self-model-flag-changed'))
  } catch {
    // ignore
  }
}

export function useSelfModelFlag(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    const q = params.get('self')
    if (q === '1') { setSelfModelFlag(true); return true }
    if (q === '0') { setSelfModelFlag(false); return false }
    return read()
  })

  useEffect(() => {
    const onChange = () => setEnabled(read())
    window.addEventListener('polymath:self-model-flag-changed', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('polymath:self-model-flag-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  return enabled
}
