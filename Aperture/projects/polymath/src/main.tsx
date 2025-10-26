import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Register service worker for offline support
console.log('[Main] Starting app, serviceWorker available:', 'serviceWorker' in navigator)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('[Main] Window loaded, registering service worker...')
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[Main] ✓ Service Worker registered:', registration.scope)
        console.log('[Main] SW state:', registration.active?.state)
      })
      .catch((error) => {
        console.error('[Main] ✗ Service Worker registration failed:', error)
      })
  })
} else {
  console.error('[Main] Service Worker NOT supported in this browser')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
