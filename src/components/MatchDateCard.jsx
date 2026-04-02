import { useState } from 'react'
import { submitDatePlanFeedback } from '../lib/ai'

const FEEDBACK_OPTIONS = [
  { value: 'perfect',      label: '🎯 This is exactly us',   color: '#10B981' },
  { value: 'accurate',     label: '✓ Pretty accurate',       color: '#3B82F6' },
  { value: 'too_fancy',    label: '💸 Too fancy for us',     color: '#F59E0B' },
  { value: 'too_boring',   label: '😴 A bit too low-key',    color: '#8B5CF6' },
  { value: 'not_our_vibe', label: '↩ Not really our vibe',  color: '#6B7280' },
]

export default function MatchDateCard({ matchId, plan, onSendIdea, compact = false }) {
  const [feedback, setFeedback] = useState(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [sending, setSending] = useState(false)

  const handleFeedback = async (value) => {
    setFeedback(value)
    setShowFeedback(false)
    try { await submitDatePlanFeedback(matchId, value) } catch {}
  }

  const handleSend = async () => {
    if (!onSendIdea || sending) return
    setSending(true)
    await onSendIdea(`💡 Date idea for us:\n\n${plan}`)
    setSending(false)
  }

  if (!plan) return null

  if (compact) {
    return (
      <div className="date-plan-compact">
        <div className="date-plan-compact-icon">💡</div>
        <p className="date-plan-compact-text">{plan}</p>
      </div>
    )
  }

  return (
    <div className="date-plan-card">
      <div className="date-plan-header">
        <div className="date-plan-icon-wrap">
          <span>💡</span>
        </div>
        <div>
          <div className="date-plan-title">Your AI First Date</div>
          <div className="date-plan-subtitle">Built from both your styles</div>
        </div>
      </div>

      <p className="date-plan-text">{plan}</p>

      <div className="date-plan-actions">
        {onSendIdea && (
          <button
            className="date-plan-send-btn"
            onClick={handleSend}
            disabled={sending}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            {sending ? 'Sending...' : 'Send this idea'}
          </button>
        )}

        <button
          className="date-plan-feedback-btn"
          onClick={() => setShowFeedback(!showFeedback)}
        >
          {feedback
            ? FEEDBACK_OPTIONS.find(f => f.value === feedback)?.label
            : '↑ How accurate is this?'
          }
        </button>
      </div>

      {showFeedback && (
        <div className="date-plan-feedback-list">
          {FEEDBACK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className="feedback-option"
              style={{ '--feedback-color': opt.color }}
              onClick={() => handleFeedback(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
