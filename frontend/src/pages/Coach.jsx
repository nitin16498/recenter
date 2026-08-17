import { useEffect, useRef, useState } from 'react'

// REC-8: real chat — history loads from /api/messages, sends persist via
// /api/chat. The reply is a stub until the LangGraph supervisor (REC-9).
export default function Coach() {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetch('/api/messages')
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setError('Backend not running — start uvicorn and refresh.'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setDraft('')
    setSending(true)
    setError(null)
    // Optimistic render of the user's message.
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const reply = await res.json()
      setMessages((prev) => [...prev, reply])
    } catch {
      setError('Message failed to send — is the backend running?')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page coach-page">
      <header className="identity-bar">
        <span className="identity-icon">🎯</span>
        <span className="identity-text">I am an engineer who ships projects</span>
      </header>

      <div className="chat-area">
        {messages.length === 0 && !error && (
          <div className="chat-empty">
            <p className="chat-empty-title">Your coach will meet you here</p>
            <p className="chat-empty-note">Say hello to start the conversation.</p>
          </div>
        )}
        <div className="message-list">
          {messages.map((m) => (
            <div key={m.id} className={`message ${m.role}`}>
              {m.content}
            </div>
          ))}
          {sending && <div className="message assistant thinking">…</div>}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && <p className="chat-error">{error}</p>}

      <footer className="composer">
        <form onSubmit={send} className="composer-form">
          <input
            className="composer-input"
            placeholder="Reply to your coach…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={sending}
            autoFocus
          />
          <button className="composer-send" type="submit" disabled={!draft.trim() || sending}>
            ↑
          </button>
        </form>
      </footer>
    </div>
  )
}
