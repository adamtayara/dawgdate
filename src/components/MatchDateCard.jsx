import { useState, useMemo } from 'react'
import AvailabilityPicker from './AvailabilityPicker'
import { findOverlaps, rankOverlaps, suggestAlternatives, formatDayShort, formatTimeRange } from '../lib/scheduling'

export default function MatchDateCard({
  datePlan,
  currentUserId,
  matchProfile,
  onApprove,
  onRequestChange,
  onSubmitAvailability,
  onSchedule,
  compact = false,
}) {
  const [showChangeInput, setShowChangeInput] = useState(false)
  const [changeSuggestion, setChangeSuggestion] = useState('')
  const [submittingChange, setSubmittingChange] = useState(false)
  const [showAvailability, setShowAvailability] = useState(false)
  const [showOverlapOptions, setShowOverlapOptions] = useState(false)

  if (!datePlan?.plan_text) return null

  const status = datePlan.status || 'proposed'
  const isUser1 = currentUserId === datePlan.user1_id
  const myApproval = isUser1 ? datePlan.user1_approved_version : datePlan.user2_approved_version
  const theirApproval = isUser1 ? datePlan.user2_approved_version : datePlan.user1_approved_version
  const iApproved = myApproval === datePlan.current_version
  const theyApproved = theirApproval === datePlan.current_version
  const matchName = matchProfile?.name || 'your match'

  const myAvailability = isUser1 ? datePlan.user1_availability : datePlan.user2_availability
  const theirAvailability = isUser1 ? datePlan.user2_availability : datePlan.user1_availability

  // Compute overlaps when both have submitted
  const overlaps = useMemo(() => {
    if (!myAvailability?.length || !theirAvailability?.length) return []
    return rankOverlaps(findOverlaps(myAvailability, theirAvailability))
  }, [myAvailability, theirAvailability])

  const alternatives = useMemo(() => {
    if (overlaps.length > 0) return []
    return suggestAlternatives(myAvailability || [], theirAvailability || [])
  }, [myAvailability, theirAvailability, overlaps])

  // Compact mode — just show a summary line
  if (compact) {
    const statusIcons = {
      proposed: '💡',
      waiting_approval: '⏳',
      editing: '✏️',
      agreed: '🤝',
      collecting_availability: '📅',
      pending_overlap: '🔄',
      scheduled: '📍',
    }
    return (
      <div className="date-plan-compact">
        <div className="date-plan-compact-icon">{statusIcons[status] || '💡'}</div>
        <p className="date-plan-compact-text">
          {status === 'scheduled'
            ? `Date scheduled${datePlan.scheduled_at ? ` — ${formatDayShort(datePlan.scheduled_at.split('T')[0])}` : ''}`
            : status === 'agreed'
            ? 'Date plan agreed!'
            : datePlan.plan_text
          }
        </p>
      </div>
    )
  }

  const handleChangeSubmit = async () => {
    if (!changeSuggestion.trim() || submittingChange) return
    setSubmittingChange(true)
    await onRequestChange(changeSuggestion.trim())
    setChangeSuggestion('')
    setShowChangeInput(false)
    setSubmittingChange(false)
  }

  const handleScheduleSlot = async (slot) => {
    const dateTime = `${slot.date}T${slot.start}:00`
    await onSchedule(dateTime)
  }

  // ── RENDER BY STATUS ──

  return (
    <div className={`date-card date-card-${status}`}>
      {/* Header */}
      <div className="date-card-header">
        <div className="date-card-icon-wrap">
          {status === 'scheduled' ? '📍' : status === 'agreed' ? '🤝' : '💡'}
        </div>
        <div>
          <div className="date-card-title">
            {status === 'scheduled' ? 'Date Scheduled' :
             status === 'agreed' ? "You're Both In!" :
             status === 'editing' ? 'Updating Plan...' :
             'Your First Date Idea'}
          </div>
          <div className="date-card-subtitle">
            {status === 'scheduled'
              ? formatDayShort(datePlan.scheduled_at?.split('T')[0] || '') + ' ' + formatTimeRange(
                  datePlan.scheduled_at?.split('T')[1]?.substring(0, 5) || '18:00',
                  String(parseInt(datePlan.scheduled_at?.split('T')[1]?.substring(0, 2) || '18') + 2).padStart(2, '0') + ':00'
                )
              : `v${datePlan.current_version || 1} · Built from both your vibes`}
          </div>
        </div>
      </div>

      {/* Plan text */}
      <div className={`date-card-plan-text ${status === 'editing' ? 'dimmed' : ''}`}>
        {datePlan.plan_text}
      </div>

      {/* Editing state overlay */}
      {status === 'editing' && (
        <div className="date-card-editing-overlay">
          <div className="date-card-loading-dots">
            <span /><span /><span />
          </div>
          <p>Cooking up something new...</p>
          {datePlan.change_suggestion && (
            <div className="date-card-suggestion-quote">
              "{datePlan.change_suggestion}"
            </div>
          )}
        </div>
      )}

      {/* ── PROPOSED / WAITING APPROVAL ── */}
      {(status === 'proposed' || status === 'waiting_approval') && (
        <div className="date-card-approval-section">
          {/* Approval indicators */}
          <div className="date-card-approval-row">
            <div className={`date-card-approval-indicator ${iApproved ? 'approved' : ''}`}>
              <span className="approval-check">{iApproved ? '✓' : ''}</span>
              <span>You</span>
            </div>
            <div className={`date-card-approval-indicator ${theyApproved ? 'approved' : ''}`}>
              <span className="approval-check">{theyApproved ? '✓' : ''}</span>
              <span>{matchName}</span>
            </div>
          </div>

          {/* Action buttons */}
          {!iApproved && !showChangeInput && (
            <div className="date-card-actions">
              <button className="date-card-btn approve" onClick={onApprove}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                I'm in!
              </button>
              <button className="date-card-btn change" onClick={() => setShowChangeInput(true)}>
                Change it
              </button>
            </div>
          )}

          {/* Waiting message */}
          {iApproved && !theyApproved && (
            <div className="date-card-waiting">
              <img className="date-card-waiting-avatar" src={matchProfile?.photo_url} alt="" />
              <span>Waiting for {matchName}...</span>
            </div>
          )}

          {/* Change input */}
          {showChangeInput && (
            <div className="date-card-change-input">
              <textarea
                className="date-card-change-textarea"
                placeholder="What sounds better? (e.g., 'something more chill' or 'maybe coffee instead')"
                value={changeSuggestion}
                onChange={(e) => setChangeSuggestion(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="date-card-change-actions">
                <button className="date-card-btn-sm cancel" onClick={() => { setShowChangeInput(false); setChangeSuggestion('') }}>
                  Cancel
                </button>
                <button
                  className="date-card-btn-sm submit"
                  onClick={handleChangeSubmit}
                  disabled={!changeSuggestion.trim() || submittingChange}
                >
                  {submittingChange ? 'Updating...' : 'Submit'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AGREED ── */}
      {status === 'agreed' && !showAvailability && (
        <div className="date-card-agreed-section">
          <div className="date-card-agreed-banner">
            <span className="agreed-emoji">🎉</span>
            <span>You both said yes!</span>
          </div>
          <button className="date-card-btn schedule" onClick={() => setShowAvailability(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Pick a time
          </button>
        </div>
      )}

      {/* ── COLLECTING AVAILABILITY ── */}
      {(status === 'collecting_availability' || status === 'agreed' && showAvailability || status === 'pending_overlap') && status !== 'scheduled' && (
        <>
          {/* Show overlap options if both submitted and overlaps exist */}
          {overlaps.length > 0 && myAvailability?.length > 0 && theirAvailability?.length > 0 ? (
            <div className="date-card-overlaps">
              <div className="date-card-overlap-header">
                <span>🎯</span> Best times for you both
              </div>
              {overlaps.slice(0, 3).map((slot, i) => (
                <button
                  key={i}
                  className="date-card-overlap-option"
                  onClick={() => handleScheduleSlot(slot)}
                >
                  <div className="overlap-option-info">
                    <span className="overlap-day">{formatDayShort(slot.date)}</span>
                    <span className="overlap-time">{formatTimeRange(slot.start, slot.end)}</span>
                  </div>
                  <span className="overlap-pick">Pick</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* No overlap or still collecting */}
              {myAvailability?.length > 0 && theirAvailability?.length > 0 && overlaps.length === 0 && (
                <div className="date-card-no-overlap">
                  <span>😅</span> No perfect overlap yet
                  {alternatives.length > 0 && (
                    <div className="date-card-alternatives">
                      {alternatives.map((alt, i) => (
                        <div key={i} className="date-card-alt-item">{alt.message}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <AvailabilityPicker
                onSubmit={onSubmitAvailability}
                otherUserSlotCount={theirAvailability?.length || 0}
                otherUserName={matchName}
                existingSlots={myAvailability || []}
              />
            </>
          )}
        </>
      )}

      {/* ── SCHEDULED ── */}
      {status === 'scheduled' && datePlan.scheduled_at && (
        <div className="date-card-scheduled-section">
          <div className="date-card-scheduled-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Confirmed
          </div>
          <div className="date-card-scheduled-details">
            <div className="scheduled-day">{formatDayShort(datePlan.scheduled_at.split('T')[0])}</div>
            <div className="scheduled-time">
              {formatTimeRange(
                datePlan.scheduled_at.split('T')[1]?.substring(0, 5) || '18:00',
                String(Math.min(23, parseInt(datePlan.scheduled_at.split('T')[1]?.substring(0, 2) || '18') + 2)).padStart(2, '0') + ':00'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
