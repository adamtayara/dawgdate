import { supabase } from './supabase'

// ============ PROFILES ============

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function upsertProfile(userId, profile) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: profile.name,
      age: profile.age,
      bio: profile.bio || '',
      photo_url: profile.photo_url || '',
      major: profile.major || '',
      gender: profile.gender || '',
      looking_for: profile.looking_for || 'everyone',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadPhoto(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('photos')
    .getPublicUrl(path)

  return data.publicUrl
}

// ============ DISCOVERY ============

export async function getDiscoverProfiles(userId) {
  // Get current user's preference
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('looking_for')
    .eq('id', userId)
    .single()

  // Get IDs the user already swiped on
  const { data: swipes } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', userId)

  const swipedIds = (swipes || []).map(s => s.swiped_id)
  const excludeIds = [userId, ...swipedIds]

  let query = supabase
    .from('profiles')
    .select('*')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(20)

  // Filter by gender preference
  const pref = currentUser?.looking_for
  if (pref && pref !== 'everyone' && pref !== '') {
    query = query.eq('gender', pref)
  }

  const { data: profiles } = await query

  return profiles || []
}

// ============ SWIPES & MATCHES ============

export async function recordSwipe(swiperId, swipedId, direction) {
  const { error } = await supabase
    .from('swipes')
    .insert({ swiper_id: swiperId, swiped_id: swipedId, direction })
  if (error) throw error

  // Check if a match was created (the DB trigger handles this)
  if (direction === 'right') {
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .or(
        `and(user1_id.eq.${swiperId},user2_id.eq.${swipedId}),and(user1_id.eq.${swipedId},user2_id.eq.${swiperId})`
      )
      .single()
    return match // null if no match yet
  }
  return null
}

export async function getMatches(userId) {
  const { data } = await supabase
    .from('matches')
    .select(`
      id,
      created_at,
      user1:profiles!matches_user1_id_fkey(*),
      user2:profiles!matches_user2_id_fkey(*)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  // Return the match with the "other" person's profile attached
  return (data || []).map(m => ({
    matchId: m.id,
    profile: m.user1.id === userId ? m.user2 : m.user1,
    createdAt: m.created_at,
  }))
}

// ============ MESSAGES ============

export async function getMessages(matchId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function sendMessage(matchId, senderId, text) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, text })
    .select()
    .single()
  if (error) throw error
  return data
}

export function subscribeToMessages(matchId, callback) {
  const channel = supabase
    .channel(`messages:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
