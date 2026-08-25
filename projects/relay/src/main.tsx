import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { setupAuthFetch } from './lib/authFetch'
import { AuthProvider } from './lib/useAuth'
import App from './App'
import './index.css'

setupAuthFetch()
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
