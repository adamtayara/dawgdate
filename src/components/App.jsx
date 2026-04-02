import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'
import Auth from './Auth'
import Onboarding from './Onboarding'
import SwipeDeck from './SwipeDeck'
import ChatList from './ChatList'
import ChatRoom from './ChatRoom'
import ProfileView from './ProfileView'
import MatchModal from './MatchModal'
import BottomNav from './BottomNav'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [loading, setLoading] = useState(true)

  const [discoverProfiles, setDiscoverProfiles] = useState([])
  const [matches, setMatches] = useState([])
  const [messages, setMessages] = useState({})
  const [tab, setTab] = useState('swipe')
  const [chatWith, setChatWith] = useState(null) // { matchId, profile }
  const [matchPopup, setMatchPopup] = useState(null)
  const [swipeCount, setSwipeCount] = useState(0)
  const [hasNewMatch, setHasNewMatch] = useState(false)

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user) loadProfile(s.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    const p = await db.getProfile(userId)
    if (p) {
      setProfile(p)
      setNeedsProfile(false)
      loadData(userId)
    } else {
      setNeedsProfile(true)
    }
    setLoading(false)
  }

  const loadData = async (userId) => {
    const [profiles, matchList] = await Promise.all([
      db.getDiscoverProfiles(userId),
      db.getMatches(userId),
    ])
    setDiscoverProfiles(profiles)
    setMatches(matchList)

    // Load last messages for each match
    const msgMap = {}
    await Promise.all(
      matchList.map(async (m) => {
        msgMap[m.matchId] = await db.getMessages(m.matchId)
      })
    )
    setMessages(msgMap)
  }

  const handleAuth = (user, isNewUser) => {
    if (isNewUser) {
      setNeedsProfile(true)
      // Supabase auto-signs in after signup — sync session state
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) setSession(s)
      })
    } else {
      loadProfile(user.id)
    }
  }

  const handleProfileComplete = async (profileData) => {
    // Re-fetch session in case it refreshed since signup
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const userId = (currentSession || session).user.id
    let photoUrl = ''

    if (profileData.photoFile) {
      photoUrl = await db.uploadPhoto(userId, profileData.photoFile)
    } else if (profileData.photo) {
      photoUrl = profileData.photo // data URL fallback
    }

    const p = await db.upsertProfile(userId, {
      ...profileData,
      photo_url: photoUrl,
    })
    if (currentSession && !session) setSession(currentSession)
    setProfile(p)
    setNeedsProfile(false)
    loadData(userId)
  }

  const handleSwipe = useCallback(async (swipeProfile, direction) => {
    // Rate limit check
    const allowed = await db.canSwipe(session.user.id)
    if (!allowed) {
      alert('You\'ve reached your daily swipe limit! Come back tomorrow.')
      return
    }

    setDiscoverProfiles(prev => prev.filter(p => p.id !== swipeProfile.id))
    setSwipeCount(c => c + 1)

    const match = await db.recordSwipe(session.user.id, swipeProfile.id, direction)
    if (match) {
      const matchEntry = {
        matchId: match.id,
        profile: swipeProfile,
        createdAt: match.created_at,
      }
      setMatches(prev => [matchEntry, ...prev])
      setMatchPopup(matchEntry)
      setHasNewMatch(true)
      setTimeout(() => setHasNewMatch(false), 2000)
    }
  }, [session])

  const handleSendMessage = useCallback(async (matchId, text) => {
    const msg = await db.sendMessage(matchId, session.user.id, text)
    setMessages(prev => ({
      ...prev,
      [matchId]: [...(prev[matchId] || []), msg],
    }))
  }, [session])

  // Real-time message subscription
  useEffect(() => {
    if (!chatWith) return
    const unsub = db.subscribeToMessages(chatWith.matchId, (newMsg) => {
      // Only add if not from us (we already added it optimistically)
      if (newMsg.sender_id !== session?.user?.id) {
        setMessages(prev => ({
          ...prev,
          [chatWith.matchId]: [...(prev[chatWith.matchId] || []), newMsg],
        }))
      }
    })
    return unsub
  }, [chatWith, session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setMatches([])
    setMessages({})
    setDiscoverProfiles([])
    setTab('swipe')
    setChatWith(null)
    setSwipeCount(0)
  }

  // Loading screen
  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="onboarding-icon" style={{ margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 36, height: 36, color: 'white' }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--uga-red)' }}>
            DawgDate
          </div>
        </div>
      </div>
    )
  }

  // Auth screen
  if (!session) {
    return (
      <div className="app">
        <Auth onAuth={handleAuth} />
      </div>
    )
  }

  // Profile setup screen
  if (needsProfile || !profile) {
    return (
      <div className="app">
        <Onboarding onComplete={handleProfileComplete} isSupabase />
      </div>
    )
  }

  const openChat = (matchEntry) => {
    setChatWith(matchEntry)
    setTab('matches')
  }

  const userForUI = {
    name: profile.name,
    age: profile.age,
    bio: profile.bio,
    photo: profile.photo_url,
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <div className="header-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <span className="header-title">DawgDate</span>
        </div>
      </header>

      <div className="main-content">
        {tab === 'swipe' && (
          <SwipeDeck profiles={discoverProfiles} onSwipe={handleSwipe} />
        )}
        {tab === 'matches' && !chatWith && (
          <ChatList
            matches={matches}
            messages={messages}
            onOpenChat={openChat}
          />
        )}
        {tab === 'matches' && chatWith && (
          <ChatRoom
            match={chatWith.profile}
            messages={messages[chatWith.matchId] || []}
            currentUserId={session.user.id}
            onSend={(text) => handleSendMessage(chatWith.matchId, text)}
            onBack={() => setChatWith(null)}
          />
        )}
        {tab === 'profile' && (
          <ProfileView
            user={userForUI}
            matchCount={matches.length}
            likeCount={swipeCount}
            onLogout={handleLogout}
          />
        )}
      </div>

      {!(tab === 'matches' && chatWith) && (
        <BottomNav
          activeTab={tab}
          onTabChange={(t) => { setTab(t); setChatWith(null); if (t === 'matches') setHasNewMatch(false); }}
          matchCount={matches.length}
          hasNewMatch={hasNewMatch}
        />
      )}

      {matchPopup && (
        <MatchModal
          user={userForUI}
          match={matchPopup.profile}
          onChat={() => { const m = matchPopup; setMatchPopup(null); openChat(m); }}
          onClose={() => setMatchPopup(null)}
        />
      )}
    </div>
  )
}
