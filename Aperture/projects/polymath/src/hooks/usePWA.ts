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
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service worker registered:', registration.scope)

          // Check for updates every hour
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000)

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New service worker installed, update available')
                  // Only show update notification if not dismissed recently
                  const dismissed = localStorage.getItem('pwa-update-dismissed')
                  if (!dismissed || Date.now() - parseInt(dismissed) > 60 * 60 * 1000) {
                    setIsUpdateAvailable(true)
                  }
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[PWA] Service worker registration failed:', error)
        })

      // Listen for controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated, reloading page')
        window.location.reload()
      })
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
