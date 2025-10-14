import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { logger } from './lib/logger'

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        logger.info('Service Worker registered', { scope: registration.scope }, 'ServiceWorker');
      })
      .catch((error) => {
        logger.warn('Service Worker registration failed', { error: error.message }, 'ServiceWorker');
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
