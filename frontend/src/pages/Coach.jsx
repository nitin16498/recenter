import { useEffect, useState } from 'react'

// REC-6 scope: prove the frontend↔backend wiring with /api/health.
// The real chat (message list, persistence, agent replies) is REC-8/REC-9.
export default function Coach() {
  const [backendStatus, setBackendStatus] = useState('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.status === 'ok' ? 'connected' : 'unexpected reply'))
      .catch(() => setBackendStatus('not running'))
  }, [])

  return (
    <div className="page coach-page">
      <header className="identity-bar">
        <span className="identity-icon">🎯</span>
        <span className="identity-text">I am an engineer who ships projects</span>
      </header>

      <div className="chat-area">
        <div className="chat-empty">
          <p className="chat-empty-title">Your coach will meet you here</p>
          <p className="chat-empty-note">
            Chat arrives in REC-8. Backend: <strong>{backendStatus}</strong>
          </p>
        </div>
      </div>

      <footer className="composer">
        <input
          className="composer-input"
          placeholder="Reply to your coach… (coming in REC-8)"
          disabled
        />
      </footer>
    </div>
  )
}
