import { supabase } from './supabase'

// ============ COMPATIBILITY SCORING ============
// Computed client-side from the public vibe_vector on profiles.
// vibe_vector has 6 safe fields: setting, formality, energy, mood, time_of_day, budget.
// Keeps raw preferences private while still enabling meaningful scoring.

const COMPAT_WEIGHTS = {
  setting:    { outdoor: {outdoor:1.0, both:0.8, indoor:0.2}, indoor: {indoor:1.0, both:0.8, outdoor:0.2}, both: {both:1.0, outdoor:0.8, indoor:0.8} },
  formality:  { casual: {casual:1.0, moderate:0.6, fancy:0.1}, moderate: {moderate:1.0, casual:0.6, fancy:0.6}, fancy: {fancy:1.0, moderate:0.6, casual:0.1} },
  energy:     { low: {low:1.0, medium:0.5, high:0.1}, medium: {medium:1.0, low:0.5, high:0.5}, high: {high:1.0, medium:0.5, low:0.1} },
  mood:       {
    romantic:     {romantic:1.0, chill:0.7, playful:0.5, adventurous:0.5, intellectual:0.6},
    chill:        {chill:1.0, romantic:0.7, playful:0.6, adventurous:0.4, intellectual:0.7},
    playful:      {playful:1.0, chill:0.6, romantic:0.5, adventurous:0.8, intellectual:0.4},
    adventurous:  {adventurous:1.0, playful:0.8, chill:0.4, romantic:0.5, intellectual:0.5},
    intellectual: {intellectual:1.0, chill:0.7, romantic:0.6, playful:0.4, adventurous:0.5},
  },
  time_of_day: { daytime: {daytime:1.0, flexible:0.8, evening:0.4, night:0.2}, evening: {evening:1.0, flexible:0.8, night:0.6, daytime:0.4}, night: {night:1.0, flexible:0.7, evening:0.6, daytime:0.2}, flexible: {flexible:1.0, evening:0.8, daytime:0.8, night:0.7} },
  budget:      { free: {free:1.0, cheap:0.7, moderate:0.3, splurge:0.0}, cheap: {cheap:1.0, free:0.7, moderate:0.5, splurge:0.2}, moderate: {moderate:1.0, cheap:0.5, splurge:0.5, free:0.3}, splurge: {splurge:1.0, moderate:0.5, cheap:0.2, free:0.0} },
}

const FIELD_IMPORTANCE = { energy: 2.0, mood: 2.0, formality: 1.5, budget: 1.5, setting: 1.2, time_of_day: 1.0 }

export function computeCompatibility(myVector, theirVector) {
  if (!myVector || !theirVector) return null

  let score = 0
  let totalWeight = 0

  for (const [field, importance] of Object.entries(FIELD_IMPORTANCE)) {
    const v1 = myVector[field]
    const v2 = theirVector[field]
    if (!v1 || !v2) continue
    const fieldScore = COMPAT_WEIGHTS[field]?.[v1]?.[v2] ?? (v1 === v2 ? 1.0 : 0.4)
    score += fieldScore * importance
    totalWeight += importance
  }

  if (totalWeight === 0) return null

  const base = Math.round((score / totalWeight) * 100)
  // Small deterministic jitter based on field values so it feels natural, not random
  const jitter = ((myVector.setting || '').length + (theirVector.mood || '').length) % 9 - 4
  return Math.min(98, Math.max(52, base + jitter))
}

// ============ VIBE TEASER ============
// Returns a short human-readable preview of what the date could look like.
// Used on swipe cards to create curiosity before matching.

const TEASERS = [
  { match: v => v.setting === 'outdoor' && v.energy === 'high',  text: 'exploring somewhere neither of you has been' },
  { match: v => v.setting === 'outdoor' && v.formality === 'casual' && v.energy !== 'high', text: 'slow walk somewhere scenic' },
  { match: v => v.setting === 'outdoor' && v.time_of_day === 'evening', text: 'golden hour walk and finding a good spot' },
  { match: v => v.setting === 'indoor' && v.formality === 'fancy',  text: 'candlelit dinner and real conversation' },
  { match: v => v.setting === 'indoor' && v.formality === 'casual' && v.time_of_day === 'daytime', text: 'low-key coffee with nowhere to be' },
  { match: v => v.setting === 'indoor' && v.formality === 'casual' && v.time_of_day === 'evening', text: 'cozy bar and no agenda' },
  { match: v => v.setting === 'both' && v.mood === 'romantic', text: 'dinner followed by a walk somewhere quiet' },
  { match: v => v.setting === 'both' && v.energy === 'medium', text: 'food, then wherever the night goes' },
  { match: v => v.mood === 'playful' && v.energy === 'high', text: 'something unexpected and a bit spontaneous' },
  { match: v => v.mood === 'intellectual', text: 'the kind of date you talk about for weeks' },
  { match: v => v.budget === 'splurge' && v.formality === 'fancy', text: 'rooftop drinks and getting dressed up' },
  { match: v => v.budget === 'free' || v.budget === 'cheap', text: 'good vibes, not expensive ones' },
  { match: v => v.planning_style === 'spontaneous', text: 'making it up as you go' },
]

export function getVibeTeaser(myVector, theirVector) {
  if (!myVector || !theirVector) return null

  // Blend the two vectors into a combined vibe
  const blended = {}
  for (const field of Object.keys(FIELD_IMPORTANCE)) {
    blended[field] = myVector[field] === theirVector[field]
      ? myVector[field]
      : myVector[field] || theirVector[field]
  }
  blended.planning_style = myVector.planning_style || theirVector.planning_style

  for (const { match, text } of TEASERS) {
    if (match(blended)) return text
  }
  return 'a date that could actually be something'
}

// ============ DATE PREFERENCE QUERIES ============

export async function getMyDatePrefs() {
  const { data } = await supabase
    .from('first_date_preferences')
    .select('structured_prefs, date_personality, vibe_summary, input_method')
    .maybeSingle()
  return data
}

export async function submitDateDescription(rawInput, inputMethod = 'text') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await supabase.functions.invoke('process-first-date', {
    body: { rawInput, inputMethod },
  })

  if (res.error) throw new Error(res.error.message || 'Processing failed')
  return res.data // { date_personality, vibe_summary }
}

// ============ DATE PLAN GENERATION & MANAGEMENT ============

export async function generateMatchDatePlan(matchId, user1Id, user2Id, suggestion = null, previousPlan = null) {
  const body = { matchId, user1Id, user2Id }
  if (suggestion) body.suggestion = suggestion
  if (previousPlan) body.previousPlan = previousPlan

  const res = await supabase.functions.invoke('generate-match-date', { body })

  if (res.error) throw new Error(res.error.message || 'Generation failed')
  return res.data // { plan, datePlan }
}

export async function getMatchDatePlan(matchId) {
  const { data } = await supabase
    .from('match_date_plans')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle()
  return data
}

export async function submitDatePlanFeedback(matchId, feedback) {
  const { error } = await supabase
    .from('match_date_plans')
    .update({ feedback })
    .eq('match_id', matchId)
  if (error) throw error
}

// ============ COLLABORATIVE DATE PLAN ACTIONS ============

/**
 * Approve the current version of a date plan.
 * If both users approve the same version, status becomes 'agreed'.
 */
export async function approveDatePlan(matchId, userId) {
  // Fetch current plan to determine user1/user2 and version
  const { data: plan } = await supabase
    .from('match_date_plans')
    .select('*')
    .eq('match_id', matchId)
    .single()

  if (!plan) throw new Error('No plan found')

  const isUser1 = userId === plan.user1_id
  const approvalField = isUser1 ? 'user1_approved_version' : 'user2_approved_version'
  const otherApprovalField = isUser1 ? 'user2_approved_version' : 'user1_approved_version'

  const updates = {
    [approvalField]: plan.current_version,
    updated_at: new Date().toISOString(),
  }

  // Check if the other user already approved this version
  const otherApproved = plan[otherApprovalField] === plan.current_version
  if (otherApproved) {
    // Both approved — mark as agreed!
    updates.status = 'agreed'
    updates.agreed_at = new Date().toISOString()
    updates.agreed_version = plan.current_version
  } else {
    updates.status = 'waiting_approval'
  }

  const { data, error } = await supabase
    .from('match_date_plans')
    .update(updates)
    .eq('match_id', matchId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

/**
 * Request a change to the date plan.
 * Sets status to 'editing', then calls the edge function to regenerate.
 */
export async function requestDatePlanChange(matchId, userId, suggestion, user1Id, user2Id, previousPlan) {
  // Set editing state immediately
  await supabase
    .from('match_date_plans')
    .update({
      status: 'editing',
      change_suggestion: suggestion,
      change_requested_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)

  // Call edge function to regenerate
  const result = await generateMatchDatePlan(matchId, user1Id, user2Id, suggestion, previousPlan)
  return result // { plan, datePlan }
}

/**
 * Submit availability slots for scheduling.
 */
export async function submitAvailability(matchId, userId, slots) {
  const { data: plan } = await supabase
    .from('match_date_plans')
    .select('user1_id, user2_id')
    .eq('match_id', matchId)
    .single()

  if (!plan) throw new Error('No plan found')

  const isUser1 = userId === plan.user1_id
  const field = isUser1 ? 'user1_availability' : 'user2_availability'

  const { data, error } = await supabase
    .from('match_date_plans')
    .update({
      [field]: slots,
      status: 'collecting_availability',
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

/**
 * Confirm a scheduled date time.
 */
export async function scheduleDatePlan(matchId, scheduledAt, location = null) {
  const { data, error } = await supabase
    .from('match_date_plans')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt,
      scheduled_location: location,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

/**
 * Subscribe to Realtime changes on match_date_plans.
 * Returns an unsubscribe function.
 */
export function subscribeToDatePlans(callback) {
  const channel = supabase
    .channel('date-plans-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'match_date_plans',
      },
      (payload) => callback(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// ============ DATE PERSONALITY DISPLAY ============

const PERSONALITY_META = {
  'Spontaneous Explorer':   { emoji: '🗺️', color: '#F59E0B', desc: 'Always down for the unexpected' },
  'Chill Minimalist':       { emoji: '☕', color: '#6B7280', desc: 'Low-key, high-quality' },
  'Cozy Romantic':          { emoji: '🕯️', color: '#EC4899', desc: 'Makes dates feel like movies' },
  'Playful Adventurer':     { emoji: '⚡', color: '#10B981', desc: 'Fun first, always' },
  'Luxury Planner':         { emoji: '✨', color: '#8B5CF6', desc: 'Detail-obsessed, worth it' },
  'Artsy Connector':        { emoji: '🎨', color: '#3B82F6', desc: 'Finds beauty in everything' },
  'Social Butterfly':       { emoji: '🦋', color: '#F97316', desc: 'Energy that fills any room' },
  'Intimate Intellectual':  { emoji: '📖', color: '#0EA5E9', desc: 'Deep conversations, real connection' },
  // Additional personalities from test data
  'Adventure Seeker':       { emoji: '🧗', color: '#F59E0B', desc: 'Always chasing the next thrill' },
  'Chill Romantic':         { emoji: '🌅', color: '#EC4899', desc: 'Sunset walks and deep talks' },
  'Creative Explorer':      { emoji: '📸', color: '#3B82F6', desc: 'Finds magic in the overlooked' },
  'Nature Lover':           { emoji: '🌿', color: '#10B981', desc: 'Happiest under open sky' },
}

export function getPersonalityMeta(label) {
  return PERSONALITY_META[label] || { emoji: '💫', color: '#BA0C2F', desc: 'One of a kind' }
}
