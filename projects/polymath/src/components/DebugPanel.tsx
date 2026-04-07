import { useEffect, useState } from 'react'
import { useThemeStore } from '../stores/useThemeStore'

export function DebugPanel() {
  const [logs, setLogs] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const { showBugTracker } = useThemeStore()

  useEffect(() => {
    // Intercept console.log
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      originalLog(...args)
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      setLogs(prev => [...prev.slice(-50), `[LOG] ${message}`]) // Keep last 50 logs
    }

    console.error = (...args) => {
      originalError(...args)
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      setLogs(prev => [...prev.slice(-50), `[ERROR] ${message}`])
    }

    // Cleanup
    return () => {
      console.log = originalLog
      console.error = originalError
    }
  }, [])

  // Hide debug panel if bug tracker is disabled
  if (!showBugTracker) {
    return null
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'rgb(var(--brand-primary-rgb))',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50vh',
        background: '#1a1a1a',
        color: "var(--brand-text-secondary)",
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '2px solid rgb(var(--brand-primary-rgb))',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      <div style={{
        padding: '12px',
        background: '#2a2a2a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #444'
      }}>
        <span style={{ fontWeight: 'bold', color: "var(--brand-text-secondary)" }}>Debug Console</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setLogs([])}
            style={{
              background: '#444',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'rgb(var(--color-error-rgb))',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: "var(--brand-text-secondary)", fontStyle: 'italic' }}>No logs yet...</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid #333',
                color: log.startsWith('[ERROR]') ? 'rgb(var(--color-error-rgb))' : 'rgb(var(--brand-primary-rgb))'
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
