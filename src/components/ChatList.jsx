export default function ChatList({ matches, messages, datePlans, onOpenChat }) {
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

  const getStatusBadge = (matchId) => {
    const plan = datePlans?.[matchId]
    if (!plan) return null
    const status = plan.status || 'proposed'
    const badges = {
      proposed: { icon: '💡', color: '#F59E0B' },
      waiting_approval: { icon: '⏳', color: '#F59E0B' },
      editing: { icon: '✏️', color: '#6B7280' },
      agreed: { icon: '🤝', color: '#10B981' },
      collecting_availability: { icon: '📅', color: '#3B82F6' },
      pending_overlap: { icon: '🔄', color: '#F59E0B' },
      scheduled: { icon: '📍', color: '#10B981' },
    }
    return badges[status] || null
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
            {newMatches.map((m) => {
              const badge = getStatusBadge(m.matchId)
              return (
                <div key={m.matchId} className="new-match-item" onClick={() => onOpenChat(m)}>
                  <div className="new-match-avatar-wrap">
                    <img className="new-match-avatar" src={m.profile.photo_url || m.profile.photo} alt={m.profile.name} />
                    {badge && (
                      <span className="match-status-badge" title={datePlans?.[m.matchId]?.status}>
                        {badge.icon}
                      </span>
                    )}
                  </div>
                  <span className="new-match-name">{m.profile.name}</span>
                </div>
              )
            })}
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
            const badge = getStatusBadge(m.matchId)

            return (
              <div key={m.matchId} className="chat-item" onClick={() => onOpenChat(m)}>
                <div className="chat-avatar-wrap">
                  <img className="chat-avatar" src={m.profile.photo_url || m.profile.photo} alt={m.profile.name} />
                  {badge && (
                    <span className="match-status-badge">
                      {badge.icon}
                    </span>
                  )}
                </div>
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
