import ReactDOM from 'react-dom/client'
import App from './App'
import { initShareHandler } from './lib/shareHandler'

// Import Inter font
import '@fontsource/inter/400.css' // Regular
import '@fontsource/inter/500.css' // Medium
import '@fontsource/inter/600.css' // Semibold
import '@fontsource/inter/700.css' // Bold

// Import Premium Dark design system
import './styles/premium-dark.css'
import './styles/ripple.css'

// CRITICAL: Initialize share handler BEFORE React renders
// This captures Web Share Target params before React Router can lose them
initShareHandler()

// Register service worker for PWA support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[Main] Service Worker registered:', registration.scope)

        // Check for updates every hour
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      })
      .catch((error) => {
        console.error('[Main] Service Worker registration failed:', error)
      })
  })
}

// Global error handlers for debugging mobile crashes
window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  })

  // Store error in localStorage for mobile debugging
  try {
    const errors = JSON.parse(localStorage.getItem('app_errors') || '[]')
    errors.push({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    })
    // Keep last 10 errors
    localStorage.setItem('app_errors', JSON.stringify(errors.slice(-10)))
  } catch (e) {
    console.error('[Main] Failed to store error:', e)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED PROMISE REJECTION]', {
    reason: event.reason,
    promise: event.promise
  })

  // Store rejection in localStorage for mobile debugging
  try {
    const errors = JSON.parse(localStorage.getItem('app_errors') || '[]')
    errors.push({
      timestamp: new Date().toISOString(),
      type: 'unhandledrejection',
      reason: event.reason?.toString(),
      stack: event.reason?.stack
    })
    // Keep last 10 errors
    localStorage.setItem('app_errors', JSON.stringify(errors.slice(-10)))
  } catch (e) {
    console.error('[Main] Failed to store rejection:', e)
  }
})

console.log('[Main] Global error handlers installed')

// Emergency fallback - show something if React fails to render
try {
  console.log('[Main] Starting React render...')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
  )
  console.log('[Main] React render initiated successfully')
} catch (error) {
  console.error('[Main] FATAL: Failed to render React app:', error)
  // Show emergency fallback UI
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0a; color: #fff; font-family: system-ui, sans-serif; padding: 20px;">
        <div style="max-width: 600px; text-align: center;">
          <h1 style="color: #ef4444; margin-bottom: 20px;">App Failed to Load</h1>
          <p style="color: #9ca3af; margin-bottom: 20px;">The app encountered a fatal error during initialization.</p>
          <pre style="background: #1a1a1a; padding: 20px; borderRadius: 8px; text-align: left; overflow-x: auto; font-size: 12px;">${error instanceof Error ? error.stack : String(error)}</pre>
          <button onclick="localStorage.clear(); window.location.reload();" style="margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: white; borderRadius: 8px; cursor: pointer;">Clear Cache & Reload</button>
        </div>
      </div>
    `
  }
}
