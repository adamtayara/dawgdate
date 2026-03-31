export default function ChatList({ matches, messages, onOpenChat }) {
  if (matches.length === 0) {
    return (
      <div className="no-matches">
        <div className="no-matches-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3>No matches yet</h3>
        <p>Keep swiping to find your match!</p>
      </div>
    )
  }

  // Separate new matches (no messages) from conversations
  const newMatches = matches.filter(m => !(messages[m.matchId]?.length > 0))
  const conversations = matches.filter(m => messages[m.matchId]?.length > 0)

  return (
    <div className="chat-list">
      <div className="chat-list-header">Messages</div>

      {newMatches.length > 0 && (
        <>
          <div className="chat-list-subtitle">New Matches</div>
          <div className="new-matches-row">
            {newMatches.map((m) => (
              <div key={m.matchId} className="new-match-item" onClick={() => onOpenChat(m)}>
                <img className="new-match-avatar" src={m.profile.photo_url || m.profile.photo} alt={m.profile.name} />
                <span className="new-match-name">{m.profile.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {conversations.length > 0 && (
        <>
          <div className="chat-divider"><div className="chat-divider-line" /></div>
          {conversations.map((m) => {
            const msgs = messages[m.matchId] || []
            const lastMsg = msgs[msgs.length - 1]
            const time = lastMsg?.created_at
              ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : lastMsg?.time || ''

            return (
              <div key={m.matchId} className="chat-item" onClick={() => onOpenChat(m)}>
                <img className="chat-avatar" src={m.profile.photo_url || m.profile.photo} alt={m.profile.name} />
                <div className="chat-info">
                  <div className="chat-name">{m.profile.name}</div>
                  <div className="chat-preview">
                    {lastMsg ? lastMsg.text : 'Say hello! 👋'}
                  </div>
                </div>
                <div className="chat-meta">
                  {time && <div className="chat-time">{time}</div>}
                </div>
              </div>
            )
          })}
        </>
      )}

      {conversations.length === 0 && newMatches.length > 0 && (
        <div style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--gray-400)', fontSize: '14px' }}>
          Tap a match to start chatting!
        </div>
      )}
    </div>
  )
}
