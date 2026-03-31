import { useState, useRef, useEffect } from 'react'

export default function ChatRoom({ match, messages, currentUserId, onSend, onBack }) {
  const [text, setText] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  const photoUrl = match.photo_url || match.photo

  return (
    <div className="chat-room">
      <div className="chat-room-header">
        <button className="chat-back" onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <img className="chat-room-avatar" src={photoUrl} alt={match.name} />
        <div className="chat-room-info">
          <div className="chat-room-name">{match.name}</div>
          <div className="chat-room-status">Online</div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--gray-400)',
            padding: '40px 20px',
            fontSize: '14px',
            lineHeight: '1.6',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</div>
            You matched with <strong style={{ color: 'var(--gray-600)' }}>{match.name}</strong>!<br />
            Break the ice and say hello.
          </div>
        )}
        {messages.map((msg) => {
          const isSent = (msg.sender_id === currentUserId) || (msg.sender === 'user')
          const time = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : msg.time || ''

          return (
            <div key={msg.id} className="message-wrapper">
              <div className={`message ${isSent ? 'sent' : 'received'}`}>
                {msg.text}
              </div>
              <div className={`message-meta ${isSent ? 'sent-meta' : ''}`}>
                {time}
                {isSent && <span className="message-read-icon">✓✓</span>}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="chat-send" type="submit" disabled={!text.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
