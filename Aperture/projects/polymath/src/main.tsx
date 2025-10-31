import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Import Inter font
import '@fontsource/inter/400.css' // Regular
import '@fontsource/inter/500.css' // Medium
import '@fontsource/inter/600.css' // Semibold
import '@fontsource/inter/700.css' // Bold

// Import Premium Dark design system
import './styles/premium-dark.css'
import './styles/ripple.css'

// Service worker temporarily disabled for debugging
console.log('[Main] Service Worker registration DISABLED for debugging')

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister()
      console.log('[Main] Unregistered service worker:', registration.scope)
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
