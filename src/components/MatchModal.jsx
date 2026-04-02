import { useMemo } from 'react'
import MatchDateCard from './MatchDateCard'

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['#BA0C2F', '#D4364F', '#FFD700', '#FFFFFF', '#FF6B6B', '#E8334A']
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }))
  }, [])

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}

export default function MatchModal({ user, match, onChat, onClose, datePlan, datePlanLoading, matchId, onSendDateIdea }) {
  return (
    <div className="match-overlay" onClick={onClose}>
      <Confetti />
      <div className="match-content" onClick={(e) => e.stopPropagation()}>
        <div className="match-emoji">🎉</div>
        <h2 className="match-title">It's a Match!</h2>
        <p className="match-subtitle">You and {match.name} liked each other</p>

        <div className="match-photos">
          <img className="match-photo" src={user.photo_url || user.photo} alt={user.name} />
          <div className="match-heart-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <img className="match-photo" src={match.photo_url || match.photo} alt={match.name} />
        </div>

        {/* Date plan section */}
        {datePlanLoading && (
          <div className="date-plan-loading">
            <div className="date-plan-loading-dots">
              <span /><span /><span />
            </div>
            <p>Building your first date plan...</p>
          </div>
        )}
        {!datePlanLoading && datePlan && (
          <MatchDateCard
            matchId={matchId}
            plan={datePlan}
            onSendIdea={onSendDateIdea}
          />
        )}

        <div className="match-actions">
          <button className="match-btn primary" onClick={onChat}>
            Send a Message
          </button>
          <button className="match-btn secondary" onClick={onClose}>
            Keep Swiping
          </button>
        </div>
      </div>
    </div>
  )
}
