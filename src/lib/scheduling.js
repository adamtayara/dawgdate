// ============ SCHEDULING LOGIC ============
// Pure functions for finding availability overlaps and ranking date times.
// No Supabase calls — works entirely on slot arrays.

/**
 * Find overlapping time windows between two users' availability.
 * Each slot: { date: "2026-04-05", start: "17:00", end: "21:00" }
 * Returns array of overlap objects sorted by date then start time.
 */
export function findOverlaps(slotsA, slotsB) {
  if (!slotsA?.length || !slotsB?.length) return []

  const overlaps = []

  for (const a of slotsA) {
    for (const b of slotsB) {
      if (a.date !== b.date) continue

      // Find intersection
      const start = a.start > b.start ? a.start : b.start
      const end = a.end < b.end ? a.end : b.end

      if (start < end) {
        overlaps.push({
          date: a.date,
          start,
          end,
          dayOfWeek: new Date(a.date + 'T12:00:00').getDay(),
        })
      }
    }
  }

  // Sort by date, then start time
  return overlaps.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.start.localeCompare(b.start)
  })
}

/**
 * Rank overlap windows by first-date suitability.
 * Returns sorted array with scores (higher = better).
 */
export function rankOverlaps(overlaps) {
  if (!overlaps?.length) return []

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  return overlaps
    .map(slot => {
      let score = 0
      const startHour = parseInt(slot.start.split(':')[0])
      const endHour = parseInt(slot.end.split(':')[0])
      const duration = endHour - startHour

      // Time-of-day scoring (evening is ideal for dates)
      if (startHour >= 17 && startHour < 21) score += 30      // Evening start — ideal
      else if (startHour >= 12 && startHour < 17) score += 20  // Afternoon — solid
      else if (startHour >= 21) score += 15                     // Late night — okay
      else score += 5                                           // Morning — unusual for dates

      // Weekend bonus (Fri=5, Sat=6, Sun=0)
      const day = slot.dayOfWeek
      if (day === 5 || day === 6) score += 15     // Friday/Saturday
      else if (day === 0) score += 10              // Sunday
      // Weekdays get no bonus

      // Duration bonus (longer windows = more flexibility, capped)
      score += Math.min(12, duration * 3)

      // Sooner bonus (within 3 days gets a boost)
      const daysAway = Math.floor((new Date(slot.date) - now) / (1000 * 60 * 60 * 24))
      if (daysAway <= 3) score += 10
      else if (daysAway <= 5) score += 5

      return { ...slot, score }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * When no overlap exists, suggest alternatives.
 * Returns top suggestions with messages explaining what to try.
 */
export function suggestAlternatives(slotsA, slotsB) {
  if (!slotsA?.length && !slotsB?.length) {
    return [{ message: 'Neither of you has added availability yet. Pick some times!' }]
  }
  if (!slotsA?.length || !slotsB?.length) {
    return [{ message: 'Waiting for both of you to add your available times.' }]
  }

  const suggestions = []

  // Find days where only one person is available
  const daysA = new Set(slotsA.map(s => s.date))
  const daysB = new Set(slotsB.map(s => s.date))

  // Days only user A has
  for (const day of daysA) {
    if (!daysB.has(day)) {
      const dayName = formatDayShort(day)
      suggestions.push({
        type: 'missing_day',
        date: day,
        message: `Are you free ${dayName}?`,
        targetUser: 'B',
      })
    }
  }

  // Days only user B has
  for (const day of daysB) {
    if (!daysA.has(day)) {
      const dayName = formatDayShort(day)
      suggestions.push({
        type: 'missing_day',
        date: day,
        message: `Are you free ${dayName}?`,
        targetUser: 'A',
      })
    }
  }

  // If both have same days but different times, suggest expanding times
  for (const day of daysA) {
    if (daysB.has(day)) {
      const dayName = formatDayShort(day)
      suggestions.push({
        type: 'expand_time',
        date: day,
        message: `You're both free ${dayName} but at different times. Can either of you flex?`,
        targetUser: 'both',
      })
    }
  }

  // Limit to top 3
  return suggestions.slice(0, 3)
}

/**
 * Format a date string to a short readable form.
 * "2026-04-05" → "Sat Apr 5"
 */
export function formatDayShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

/**
 * Format a time range for display.
 * ("17:00", "21:00") → "5:00 PM – 9:00 PM"
 */
export function formatTimeRange(start, end) {
  const fmt = (t) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

/**
 * Generate next 7 days starting from today.
 * Returns array of { date, dayName, dayNum, monthName, isWeekend }
 */
export function getNext7Days() {
  const days = []
  const now = new Date()

  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dow = d.getDay()

    days.push({
      date: d.toISOString().split('T')[0],
      dayName: dayNames[dow],
      dayNum: d.getDate(),
      monthName: monthNames[d.getMonth()],
      isWeekend: dow === 0 || dow === 5 || dow === 6,
      isToday: i === 0,
    })
  }

  return days
}
