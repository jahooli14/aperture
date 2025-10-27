import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Import Inter font
import '@fontsource/inter/400.css' // Regular
import '@fontsource/inter/500.css' // Medium
import '@fontsource/inter/600.css' // Semibold
import '@fontsource/inter/700.css' // Bold

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
