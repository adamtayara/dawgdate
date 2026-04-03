import { useState } from 'react'
import { getNext7Days } from '../lib/scheduling'

const TIME_SLOTS = [
  { id: 'afternoon', label: 'Afternoon', sub: '12 – 5 PM', start: '12:00', end: '17:00', icon: '☀️' },
  { id: 'evening',   label: 'Evening',   sub: '5 – 9 PM',  start: '17:00', end: '21:00', icon: '🌆' },
  { id: 'night',     label: 'Late Night', sub: '9 – 11:30 PM', start: '21:00', end: '23:30', icon: '🌙' },
]

export default function AvailabilityPicker({ onSubmit, otherUserSlotCount, otherUserName, existingSlots }) {
  const [selectedDay, setSelectedDay] = useState(null)
  const [slots, setSlots] = useState(existingSlots || [])
  const [submitting, setSubmitting] = useState(false)

  const days = getNext7Days()

  const toggleSlot = (date, start, end) => {
    setSlots(prev => {
      const exists = prev.find(s => s.date === date && s.start === start)
      if (exists) {
        return prev.filter(s => !(s.date === date && s.start === start))
      }
      return [...prev, { date, start, end }]
    })
  }

  const isSelected = (date, start) => {
    return slots.some(s => s.date === date && s.start === start)
  }

  const slotsForDay = (date) => slots.filter(s => s.date === date).length

  const handleSubmit = async () => {
    if (slots.length === 0 || submitting) return
    setSubmitting(true)
    await onSubmit(slots)
    setSubmitting(false)
  }

  return (
    <div className="avail-picker">
      <div className="avail-header">
        <span className="avail-icon">📅</span>
        <div>
          <div className="avail-title">When are you free?</div>
          <div className="avail-subtitle">Pick days and times for your date</div>
        </div>
      </div>

      {/* Day pills */}
      <div className="avail-days-scroll">
        <div className="avail-days">
          {days.map(d => (
            <button
              key={d.date}
              className={`avail-day-pill ${selectedDay === d.date ? 'active' : ''} ${d.isWeekend ? 'weekend' : ''} ${slotsForDay(d.date) > 0 ? 'has-slots' : ''}`}
              onClick={() => setSelectedDay(selectedDay === d.date ? null : d.date)}
            >
              <span className="avail-day-name">{d.isToday ? 'Today' : d.dayName}</span>
              <span className="avail-day-num">{d.dayNum}</span>
              {slotsForDay(d.date) > 0 && (
                <span className="avail-day-badge">{slotsForDay(d.date)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Time slots for selected day */}
      {selectedDay && (
        <div className="avail-time-slots">
          {TIME_SLOTS.map(ts => (
            <button
              key={ts.id}
              className={`avail-slot ${isSelected(selectedDay, ts.start) ? 'selected' : ''}`}
              onClick={() => toggleSlot(selectedDay, ts.start, ts.end)}
            >
              <span className="avail-slot-icon">{ts.icon}</span>
              <div className="avail-slot-info">
                <span className="avail-slot-label">{ts.label}</span>
                <span className="avail-slot-sub">{ts.sub}</span>
              </div>
              <div className={`avail-slot-check ${isSelected(selectedDay, ts.start) ? 'checked' : ''}`}>
                {isSelected(selectedDay, ts.start) ? '✓' : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="avail-footer">
        {otherUserSlotCount > 0 && (
          <div className="avail-other-status">
            {otherUserName} picked {otherUserSlotCount} time{otherUserSlotCount !== 1 ? 's' : ''}
          </div>
        )}
        <div className="avail-submit-row">
          <span className="avail-count">{slots.length} slot{slots.length !== 1 ? 's' : ''} selected</span>
          <button
            className="avail-submit-btn"
            onClick={handleSubmit}
            disabled={slots.length === 0 || submitting}
          >
            {submitting ? 'Saving...' : slots.length === 0 ? 'Pick times' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
