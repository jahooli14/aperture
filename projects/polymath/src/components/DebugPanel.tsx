import { useEffect, useState } from 'react'

export function DebugPanel() {
  const [logs, setLogs] = useState<string[]>([])
  const [isVisible, setIsVisible] = useState(false)

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

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          background: '#3b82f6',
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
        🐛
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
        color: '#fff',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '2px solid #3b82f6',
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
        <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>Debug Console</span>
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
              background: '#ef4444',
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
          <div style={{ color: '#666', fontStyle: 'italic' }}>No logs yet...</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid #333',
                color: log.startsWith('[ERROR]') ? '#ef4444' : '#10b981'
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
