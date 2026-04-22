/**
 * PWA Hook
 * Handles service worker registration, install prompts, and updates
 */

import { useState, useEffect } from 'react'

interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  isUpdateAvailable: boolean
  promptInstall: () => Promise<void>
  dismissInstall: () => void
}

let deferredPrompt: any = null

export function usePWA(): PWAState {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      // Check if running in standalone mode (already installed)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://')
      setIsInstalled(isStandalone)
    }

    checkInstalled()

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired')
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later
      deferredPrompt = e
      // Update UI to show install prompt
      setIsInstallable(true)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully')
      setIsInstalled(true)
      setIsInstallable(false)
      deferredPrompt = null
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    // The service worker itself is registered once in main.tsx (/sw.js, built
    // by vite-plugin-pwa). Here we just observe it so we can surface the
    // "update available" UI. Registering a second time from this hook used to
    // pull in a separate legacy SW (/service-worker.js) that cached API
    // responses — including 401s — for 7 days, trapping users in auth loops
    // until they redownloaded the PWA. Don't resurrect that.
    if (!('serviceWorker' in navigator)) return

    let cancelled = false
    let updateInterval: ReturnType<typeof setInterval> | undefined

    const watchForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (cancelled || !registration) return

        updateInterval = setInterval(() => {
          registration.update().catch(() => {})
        }, 60 * 60 * 1000)

        const handleUpdateFound = () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              const dismissed = localStorage.getItem('pwa-update-dismissed')
              if (!dismissed || Date.now() - parseInt(dismissed) > 60 * 60 * 1000) {
                setIsUpdateAvailable(true)
              }
            }
          })
        }

        registration.addEventListener('updatefound', handleUpdateFound)

        // If an update was already waiting when we mounted, surface it now.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setIsUpdateAvailable(true)
        }
      } catch (error) {
        console.error('[PWA] Could not observe service worker:', error)
      }
    }

    watchForUpdates()

    const handleControllerChange = () => {
      sessionStorage.removeItem('sw-reloaded')
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      cancelled = true
      if (updateInterval) clearInterval(updateInterval)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) {
      console.warn('[PWA] Install prompt not available')
      return
    }

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice
    console.log('[PWA] User response:', outcome)

    // Clear the deferred prompt
    deferredPrompt = null
    setIsInstallable(false)

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt')
    } else {
      console.log('[PWA] User dismissed the install prompt')
    }
  }

  const dismissInstall = () => {
    setIsInstallable(false)
    // Store dismissal in localStorage to not show again for a while
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  return {
    isInstallable,
    isInstalled,
    isUpdateAvailable,
    promptInstall,
    dismissInstall
  }
}
