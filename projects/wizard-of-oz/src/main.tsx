import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  console.error('Fatal error during React initialization:', error);

  // Show a basic error message if React fails to initialize
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #fef2f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 500px; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h1 style="color: #991b1b; margin: 0 0 15px 0; font-size: 24px;">Failed to Load</h1>
            <p style="color: #4b5563; margin-bottom: 20px;">Pupils encountered an error during startup. This might be due to cached data.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 20px; text-align: left;">
              <strong style="color: #374151;">Error:</strong>
              <pre style="margin: 10px 0 0 0; color: #dc2626; font-size: 12px; white-space: pre-wrap;">${error instanceof Error ? error.message : String(error)}</pre>
            </div>
            <a href="/clear-cache.html" style="display: inline-block; background: #0891B2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Clear Cache & Retry</a>
          </div>
        </div>
      </div>
    `;
  }
}
