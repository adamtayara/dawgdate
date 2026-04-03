import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'
import { generateMatchDatePlan, getMatchDatePlan, getMyDatePrefs } from '../lib/ai'
import Auth from './Auth'
import Onboarding from './Onboarding'
import DateOnboarding from './DateOnboarding'
import SwipeDeck from './SwipeDeck'
import ChatList from './ChatList'
import ChatRoom from './ChatRoom'
import ProfileView from './ProfileView'
import MatchModal from './MatchModal'
import BottomNav from './BottomNav'
import FloatingBackground from './FloatingBackground'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [needsDateOnboarding, setNeedsDateOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)

  const [discoverProfiles, setDiscoverProfiles] = useState([])
  const [matches, setMatches] = useState([])
  const [messages, setMessages] = useState({})
  const [tab, setTab] = useState('swipe')
  const [chatWith, setChatWith] = useState(null)
  const [matchPopup, setMatchPopup] = useState(null)
  const [swipeCount, setSwipeCount] = useState(0)
  const [hasNewMatch, setHasNewMatch] = useState(false)

  // AI date feature state
  const [myDatePrefs, setMyDatePrefs] = useState(null) // { structured_prefs, date_personality }
  const [datePlans, setDatePlans] = useState({})        // { [matchId]: planText }
  const [datePlanLoading, setDatePlanLoading] = useState(false)

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
      // Check if date onboarding is needed (no personality yet)
      if (!p.date_personality) {
        setNeedsDateOnboarding(true)
      }
      loadData(userId)
      // Load user's own date prefs for compatibility scoring
      loadMyDatePrefs()
    } else {
      setNeedsProfile(true)
    }
    setLoading(false)
  }

  const loadMyDatePrefs = async () => {
    try {
      const prefs = await getMyDatePrefs()
      if (prefs) setMyDatePrefs(prefs)
    } catch {}
  }

  const loadData = async (userId) => {
    const [profiles, matchList] = await Promise.all([
      db.getDiscoverProfiles(userId),
      db.getMatches(userId),
    ])
    setDiscoverProfiles(profiles)
    setMatches(matchList)

    const msgMap = {}
    await Promise.all(
      matchList.map(async (m) => {
        msgMap[m.matchId] = await db.getMessages(m.matchId)
      })
    )
    setMessages(msgMap)

    // Load existing date plans for all matches
    await Promise.all(
      matchList.map(async (m) => {
        try {
          const plan = await getMatchDatePlan(m.matchId)
          if (plan?.plan_text) {
            setDatePlans(prev => ({ ...prev, [m.matchId]: plan.plan_text }))
          }
        } catch {}
      })
    )
  }

  const handleAuth = (user, isNewUser) => {
    if (isNewUser) {
      setNeedsProfile(true)
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) setSession(s)
      })
    } else {
      loadProfile(user.id)
    }
  }

  const handleProfileComplete = async (profileData) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const userId = (currentSession || session).user.id

    // Upload all photos (photoFiles is an array of File objects)
    const photoUrls = []
    if (profileData.photoFiles && profileData.photoFiles.length > 0) {
      for (let i = 0; i < profileData.photoFiles.length; i++) {
        const url = await db.uploadPhoto(userId, profileData.photoFiles[i], i)
        photoUrls.push(url)
      }
    } else if (profileData.photo) {
      photoUrls.push(profileData.photo)
    }

    const p = await db.upsertProfile(userId, {
      ...profileData,
      photo_url: photoUrls[0] || '',
      photos: photoUrls,
    })
    if (currentSession && !session) setSession(currentSession)
    setProfile(p)
    setNeedsProfile(false)
    // New users always go through date onboarding
    setNeedsDateOnboarding(true)
  }

  const handleDateOnboardingComplete = (result) => {
    // Update local profile with the new personality/summary
    setProfile(prev => prev ? {
      ...prev,
      date_personality: result.date_personality,
      date_vibe_summary: result.vibe_summary,
    } : prev)
    setNeedsDateOnboarding(false)
    loadData(session.user.id)
    loadMyDatePrefs()
  }

  const handleDateOnboardingSkip = () => {
    setNeedsDateOnboarding(false)
    loadData(session.user.id)
  }

  const handleSwipe = useCallback(async (swipeProfile, direction) => {
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

      // Generate date plan async — show loading state in modal
      setDatePlanLoading(true)
      try {
        const plan = await generateMatchDatePlan(
          match.id,
          session.user.id,
          swipeProfile.id
        )
        if (plan) {
          setDatePlans(prev => ({ ...prev, [match.id]: plan }))
        }
      } catch {}
      setDatePlanLoading(false)
    }
  }, [session])

  const handleSendMessage = useCallback(async (matchId, text) => {
    const msg = await db.sendMessage(matchId, session.user.id, text)
    setMessages(prev => ({
      ...prev,
      [matchId]: [...(prev[matchId] || []), msg],
    }))
  }, [session])

  // Send date idea as a message in the current chat
  const handleSendDateIdea = useCallback(async (text) => {
    if (!chatWith) return
    await handleSendMessage(chatWith.matchId, text)
  }, [chatWith, handleSendMessage])

  // Real-time message subscription
  useEffect(() => {
    if (!chatWith) return
    const unsub = db.subscribeToMessages(chatWith.matchId, (newMsg) => {
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
    setMyDatePrefs(null)
    setDatePlans({})
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

  if (!session) {
    return (
      <div className="app">
        <Auth onAuth={handleAuth} />
      </div>
    )
  }

  if (needsProfile || !profile) {
    return (
      <div className="app">
        <Onboarding onComplete={handleProfileComplete} isSupabase />
      </div>
    )
  }

  if (needsDateOnboarding) {
    return (
      <div className="app">
        <DateOnboarding
          onComplete={handleDateOnboardingComplete}
          onSkip={handleDateOnboardingSkip}
        />
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
    photo_url: profile.photo_url,
    date_personality: profile.date_personality,
    date_vibe_summary: profile.date_vibe_summary,
  }

  return (
    <div className="app">
      <FloatingBackground />
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
          <SwipeDeck
            profiles={discoverProfiles}
            onSwipe={handleSwipe}
            myVector={profile.date_vibe_vector || myDatePrefs?.structured_prefs}
          />
        )}
        {tab === 'matches' && !chatWith && (
          <ChatList
            matches={matches}
            messages={messages}
            datePlans={datePlans}
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
            datePlan={datePlans[chatWith.matchId]}
            matchId={chatWith.matchId}
            onSendDateIdea={handleSendDateIdea}
          />
        )}
        {tab === 'profile' && (
          <ProfileView
            user={userForUI}
            matchCount={matches.length}
            likeCount={swipeCount}
            onLogout={handleLogout}
            onEditDateStyle={() => setNeedsDateOnboarding(true)}
          />
        )}
      </div>

      {!(tab === 'matches' && chatWith) && (
        <BottomNav
          activeTab={tab}
          onTabChange={(t) => { setTab(t); setChatWith(null); if (t === 'matches') setHasNewMatch(false) }}
          matchCount={matches.length}
          hasNewMatch={hasNewMatch}
        />
      )}

      {matchPopup && (
        <MatchModal
          user={userForUI}
          match={matchPopup.profile}
          onChat={() => { const m = matchPopup; setMatchPopup(null); openChat(m) }}
          onClose={() => setMatchPopup(null)}
          datePlan={datePlans[matchPopup.matchId]}
          datePlanLoading={datePlanLoading}
          matchId={matchPopup.matchId}
          onSendDateIdea={async (text) => {
            const m = matchPopup
            setMatchPopup(null)
            openChat(m)
            await handleSendMessage(m.matchId, text)
          }}
        />
      )}
    </div>
  )
}
