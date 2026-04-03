import { useRef, useState, useCallback } from 'react'
import { computeCompatibility, getVibeTeaser, getPersonalityMeta } from '../lib/ai'

const SWIPE_THRESHOLD = 100
const ROTATION_FACTOR = 0.1
const TAP_THRESHOLD = 8 // px — below this = tap, above = drag/swipe

function CompatibilityBadge({ myVector, theirVector, theirPersonality }) {
  const score = computeCompatibility(myVector, theirVector)
  const teaser = getVibeTeaser(myVector, theirVector)
  const meta = theirPersonality ? getPersonalityMeta(theirPersonality) : null
  if (!score && !meta) return null
  return (
    <div className="card-compat-row">
      {meta && (
        <span className="card-personality-chip" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.emoji} {theirPersonality}
        </span>
      )}
      {score && <span className="card-compat-score">{score}% match</span>}
      {teaser && !score && <span className="card-compat-teaser">✨ {teaser}</span>}
    </div>
  )
}

function SwipeCardInner({ profile, isTop, onSwipe, triggerRef, myVector }) {
  const cardRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [exiting, setExiting] = useState(null)
  const [photoIndex, setPhotoIndex] = useState(0)

  // All photos for this profile — use photos array if available, fallback to photo_url
  const allPhotos = (() => {
    const arr = profile.photos
    if (Array.isArray(arr) && arr.length > 0) return arr
    const url = profile.photo_url || profile.photo
    return url ? [url] : []
  })()

  const animateExit = useCallback((direction) => {
    setExiting(direction)
    setTimeout(() => onSwipe(profile, direction), 350)
  }, [onSwipe, profile])

  if (isTop && triggerRef) triggerRef.current = animateExit

  const handlePointerDown = (e) => {
    if (!isTop || exiting) return
    startPos.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y })
  }

  const handlePointerUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)

    const dx = offset.x
    const dy = offset.y
    const isTap = Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD

    if (isTap && isTop && allPhotos.length > 1) {
      // Tap → navigate photos
      const rect = cardRef.current?.getBoundingClientRect()
      const tapX = (startPos.current.x - (rect?.left || 0)) / (rect?.width || 300)
      if (tapX < 0.4) {
        setPhotoIndex(i => Math.max(0, i - 1))
      } else {
        setPhotoIndex(i => Math.min(allPhotos.length - 1, i + 1))
      }
      setOffset({ x: 0, y: 0 })
    } else if (Math.abs(dx) > SWIPE_THRESHOLD) {
      animateExit(dx > 0 ? 'right' : 'left')
    } else {
      setOffset({ x: 0, y: 0 })
    }
  }

  const likeOpacity = Math.min(Math.max(offset.x / SWIPE_THRESHOLD, 0), 1)
  const nopeOpacity = Math.min(Math.max(-offset.x / SWIPE_THRESHOLD, 0), 1)

  let transform
  if (exiting === 'right')      transform = 'translateX(150%) rotate(30deg)'
  else if (exiting === 'left')  transform = 'translateX(-150%) rotate(-30deg)'
  else if (isTop)               transform = `translateX(${offset.x}px) translateY(${offset.y * 0.3}px) rotate(${offset.x * ROTATION_FACTOR}deg)`
  else                          transform = 'scale(0.94) translateY(14px)'

  const currentPhoto = allPhotos[photoIndex] || allPhotos[0]

  return (
    <div
      ref={cardRef}
      className="swipe-card"
      style={{
        transform,
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
        zIndex: isTop ? 2 : 1,
        opacity: !isTop ? 0.5 : exiting ? 0.8 : 1,
        filter: !isTop ? 'brightness(0.9)' : 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Photo */}
      <img
        src={currentPhoto}
        alt={profile.name}
        draggable={false}
        style={{ transition: 'opacity 0.2s ease' }}
      />

      {/* Photo progress bars — only if multiple photos */}
      {isTop && allPhotos.length > 1 && (
        <div className="card-photo-bars">
          {allPhotos.map((_, i) => (
            <div key={i} className={`card-photo-bar ${i === photoIndex ? 'active' : i < photoIndex ? 'past' : ''}`} />
          ))}
        </div>
      )}

      {/* Tap zones — invisible, for accessibility / visual hint */}
      {isTop && allPhotos.length > 1 && (
        <>
          <div className="card-tap-left" />
          <div className="card-tap-right" />
        </>
      )}

      {/* Card info overlay */}
      <div className="card-overlay">
        <div className="card-name">
          {profile.name} <span className="card-age">{profile.age}</span>
        </div>
        {profile.bio && <div className="card-bio">{profile.bio}</div>}
        <div className="card-footer-row">
          {profile.major && (
            <div className="card-major">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              {profile.major}
            </div>
          )}
        </div>
        {isTop && (profile.date_vibe_vector || profile.date_personality) && (
          <CompatibilityBadge myVector={myVector} theirVector={profile.date_vibe_vector} theirPersonality={profile.date_personality} />
        )}
      </div>

      <div className="stamp stamp-like" style={{ opacity: likeOpacity }}>LIKE</div>
      <div className="stamp stamp-nope" style={{ opacity: nopeOpacity }}>NOPE</div>
    </div>
  )
}

export default function SwipeDeck({ profiles, onSwipe, myVector }) {
  const triggerRef = useRef(null)
  const visible = profiles.slice(0, 2)

  if (profiles.length === 0) {
    return (
      <div className="swipe-container">
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3>You've seen everyone!</h3>
          <p>Check back later for new<br />Dawgs on campus</p>
        </div>
      </div>
    )
  }

  return (
    <div className="swipe-container">
      <div className="card-stack">
        {[...visible].reverse().map((profile, i) => (
          <SwipeCardInner
            key={profile.id}
            profile={profile}
            isTop={i === visible.length - 1}
            onSwipe={onSwipe}
            triggerRef={i === visible.length - 1 ? triggerRef : null}
            myVector={myVector}
          />
        ))}
      </div>

      <div className="action-buttons">
        <button className="action-btn pass" onClick={() => triggerRef.current?.('left')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button className="action-btn superlike" onClick={() => triggerRef.current?.('right')}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        <button className="action-btn like" onClick={() => triggerRef.current?.('right')}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
