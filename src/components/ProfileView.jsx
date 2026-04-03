import { useState, useRef } from 'react'
import { getPersonalityMeta } from '../lib/ai'

async function prepareImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 900
      const scale = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

export default function ProfileView({ user, profile, matchCount, onLogout, onEditDateStyle, onUpdatePhotos, onUpdateProfile }) {
  const meta = user.date_personality ? getPersonalityMeta(user.date_personality) : null

  // Photos
  const currentPhotos = Array.isArray(user.photos) && user.photos.length > 0
    ? user.photos
    : (user.photo_url || user.photo ? [user.photo_url || user.photo] : [])

  // Screen state: 'view' | 'settings' | 'editProfile' | 'editPhotos'
  const [screen, setScreen] = useState('view')

  // Photo edit state
  const [slots, setSlots] = useState([...currentPhotos, null, null, null, null].slice(0, 4))
  const [saving, setSaving] = useState(false)
  const [viewingIndex, setViewingIndex] = useState(0)
  const fileRefs = [useRef(), useRef(), useRef(), useRef()]

  // Edit profile form state
  const [editForm, setEditForm] = useState({
    name: profile?.name || '',
    age: profile?.age || '',
    bio: profile?.bio || '',
    major: profile?.major || '',
    gender: profile?.gender || '',
    looking_for: profile?.looking_for || 'everyone',
  })
  const [editSaving, setEditSaving] = useState(false)

  // ── Photo edit handlers ──
  const handlePickFile = async (file, slotIndex) => {
    if (!file || !file.type.startsWith('image/')) return
    const resized = await prepareImage(file)
    const preview = URL.createObjectURL(resized)
    setSlots(prev => {
      const next = [...prev]
      next[slotIndex] = { file: resized, preview }
      return next
    })
  }

  const removeSlot = (slotIndex) => {
    setSlots(prev => {
      const next = [...prev]
      next[slotIndex] = null
      const filled = next.filter(Boolean)
      return [...filled, null, null, null, null].slice(0, 4)
    })
  }

  const handlePhotoSave = async () => {
    const filled = slots.filter(Boolean)
    if (filled.length === 0) return
    setSaving(true)
    try {
      await onUpdatePhotos(slots)
      setScreen('view')
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const handlePhotoCancel = () => {
    setSlots([...currentPhotos, null, null, null, null].slice(0, 4))
    setScreen('view')
  }

  const getPreview = (slot) => {
    if (!slot) return null
    if (typeof slot === 'string') return slot
    return slot.preview
  }

  const filledSlots = slots.filter(Boolean)

  // ── Edit profile handlers ──
  const handleEditSave = async () => {
    if (!editForm.name.trim()) return
    setEditSaving(true)
    try {
      await onUpdateProfile({
        name: editForm.name.trim(),
        age: parseInt(editForm.age) || profile?.age,
        bio: editForm.bio.trim(),
        major: editForm.major.trim(),
        gender: editForm.gender,
        looking_for: editForm.looking_for,
      })
      setScreen('view')
    } catch (e) {
      console.error(e)
    }
    setEditSaving(false)
  }

  const openEditProfile = () => {
    setEditForm({
      name: profile?.name || '',
      age: profile?.age || '',
      bio: profile?.bio || '',
      major: profile?.major || '',
      gender: profile?.gender || '',
      looking_for: profile?.looking_for || 'everyone',
    })
    setScreen('editProfile')
  }

  // ═══════════════════════════════════════════
  // EDIT PHOTOS SCREEN
  // ═══════════════════════════════════════════
  if (screen === 'editPhotos') {
    return (
      <div className="profile-view">
        <div className="profile-edit-header">
          <button className="profile-edit-cancel" onClick={handlePhotoCancel}>Cancel</button>
          <span className="profile-edit-title">Edit Photos</span>
          <button
            className="profile-edit-save"
            onClick={handlePhotoSave}
            disabled={saving || filledSlots.length === 0}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="profile-edit-body">
          <p className="profile-edit-hint">
            Tap a photo to replace it.<br />First photo is your main profile photo.
          </p>

          <div className="profile-photo-edit-grid">
            {[0, 1, 2, 3].map((i) => {
              const slot = slots[i]
              const preview = getPreview(slot)
              const isFirst = i === 0
              return (
                <div key={i} className={`profile-edit-slot ${preview ? 'has-photo' : ''} ${isFirst ? 'main-edit-slot' : ''}`}
                  onClick={() => fileRefs[i].current?.click()}>
                  {preview ? (
                    <>
                      <img src={preview} alt={`Photo ${i + 1}`} />
                      {isFirst && <div className="edit-slot-main-label">Main</div>}
                      <button
                        type="button"
                        className="photo-remove-btn"
                        onClick={(e) => { e.stopPropagation(); removeSlot(i) }}
                        disabled={isFirst && filledSlots.length === 1}
                      >✕</button>
                    </>
                  ) : (
                    <div className="photo-slot-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{isFirst ? 'Required' : 'Add photo'}</span>
                    </div>
                  )}
                  <input ref={fileRefs[i]} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => handlePickFile(e.target.files[0], i)} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // EDIT PROFILE SCREEN
  // ═══════════════════════════════════════════
  if (screen === 'editProfile') {
    return (
      <div className="profile-view">
        <div className="profile-edit-header">
          <button className="profile-edit-cancel" onClick={() => setScreen('view')}>Cancel</button>
          <span className="profile-edit-title">Edit Profile</span>
          <button
            className="profile-edit-save"
            onClick={handleEditSave}
            disabled={editSaving || !editForm.name.trim()}
          >
            {editSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="edit-profile-form">
          <div className="edit-field">
            <label className="edit-field-label">Name</label>
            <input
              className="edit-field-input"
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>

          <div className="edit-field">
            <label className="edit-field-label">Age</label>
            <input
              className="edit-field-input"
              type="number"
              min="18"
              max="99"
              value={editForm.age}
              onChange={(e) => setEditForm(f => ({ ...f, age: e.target.value }))}
            />
          </div>

          <div className="edit-field">
            <label className="edit-field-label">Major</label>
            <input
              className="edit-field-input"
              type="text"
              value={editForm.major}
              onChange={(e) => setEditForm(f => ({ ...f, major: e.target.value }))}
              placeholder="e.g., Computer Science"
            />
          </div>

          <div className="edit-field">
            <label className="edit-field-label">Bio</label>
            <textarea
              className="edit-field-textarea"
              value={editForm.bio}
              onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Tell people about yourself..."
              rows={3}
              maxLength={300}
            />
            <span className="edit-field-count">{editForm.bio.length}/300</span>
          </div>

          <div className="edit-field">
            <label className="edit-field-label">Gender</label>
            <div className="edit-gender-row">
              {['male', 'female'].map(g => (
                <button
                  key={g}
                  className={`edit-gender-btn ${editForm.gender === g ? 'active' : ''}`}
                  onClick={() => setEditForm(f => ({ ...f, gender: g }))}
                >
                  {g === 'male' ? 'Male' : 'Female'}
                </button>
              ))}
            </div>
          </div>

          <div className="edit-field">
            <label className="edit-field-label">Interested In</label>
            <div className="edit-gender-row">
              {[{ v: 'male', l: 'Men' }, { v: 'female', l: 'Women' }, { v: 'everyone', l: 'Everyone' }].map(({ v, l }) => (
                <button
                  key={v}
                  className={`edit-gender-btn ${editForm.looking_for === v ? 'active' : ''}`}
                  onClick={() => setEditForm(f => ({ ...f, looking_for: v }))}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // SETTINGS SCREEN
  // ═══════════════════════════════════════════
  if (screen === 'settings') {
    return (
      <div className="profile-view">
        <div className="settings-header">
          <button className="settings-back" onClick={() => setScreen('view')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="settings-title">Settings</span>
          <div style={{ width: 20 }} />
        </div>

        <div className="settings-list">
          <div className="settings-section-label">Account</div>

          <button className="settings-row" onClick={openEditProfile}>
            <span className="settings-row-icon">👤</span>
            <span className="settings-row-label">Edit Profile</span>
            <svg className="settings-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <button className="settings-row" onClick={() => { setScreen('view'); onEditDateStyle() }}>
            <span className="settings-row-icon">💡</span>
            <span className="settings-row-label">Edit Date Style</span>
            <svg className="settings-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <button className="settings-row" onClick={() => { setSlots([...currentPhotos, null, null, null, null].slice(0, 4)); setScreen('editPhotos') }}>
            <span className="settings-row-icon">📸</span>
            <span className="settings-row-label">Edit Photos</span>
            <svg className="settings-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div className="settings-section-label" style={{ marginTop: 8 }}>Coming Soon</div>

          <div className="settings-row disabled">
            <span className="settings-row-icon">🔔</span>
            <span className="settings-row-label">Notifications</span>
          </div>

          <div className="settings-row disabled">
            <span className="settings-row-icon">🔒</span>
            <span className="settings-row-label">Privacy</span>
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-signout" onClick={onLogout}>Sign Out</button>
          <div className="settings-version">DawgDate v1.0</div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // MAIN PROFILE VIEW
  // ═══════════════════════════════════════════
  return (
    <div className="profile-view">
      {/* Photo section */}
      <div className="profile-photos-section">
        <div className="profile-main-photo-wrap">
          <img
            className="profile-main-photo"
            src={currentPhotos[viewingIndex] || currentPhotos[0]}
            alt={user.name}
          />
          {currentPhotos.length > 1 && (
            <div className="profile-photo-dots">
              {currentPhotos.map((_, i) => (
                <button
                  key={i}
                  className={`profile-photo-dot ${i === viewingIndex ? 'active' : ''}`}
                  onClick={() => setViewingIndex(i)}
                />
              ))}
            </div>
          )}
          <button className="profile-edit-photos-btn" onClick={() => { setSlots([...currentPhotos, null, null, null, null].slice(0, 4)); setScreen('editPhotos') }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        </div>

        {currentPhotos.length > 1 && (
          <div className="profile-thumb-strip">
            {currentPhotos.map((url, i) => (
              <button
                key={i}
                className={`profile-thumb ${i === viewingIndex ? 'active' : ''}`}
                onClick={() => setViewingIndex(i)}
              >
                <img src={url} alt={`Photo ${i + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Identity section */}
      <div className="profile-hero">
        <div className="profile-name-large">{user.name}, {user.age}</div>
        {profile?.major && (
          <div className="profile-info-row">
            <span className="profile-info-icon">🎓</span>
            <span>{profile.major} · University of Georgia</span>
          </div>
        )}
        {!profile?.major && (
          <div className="profile-age-large">University of Georgia</div>
        )}
        {user.bio && <p className="profile-bio-large">{user.bio}</p>}

        <button className="profile-edit-btn" onClick={openEditProfile}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Profile
        </button>
      </div>

      {/* Date personality section */}
      {(meta || user.date_vibe_summary) && (
        <div className="profile-date-section">
          {meta && (
            <div className="profile-personality-badge" style={{ background: `${meta.color}12`, borderColor: `${meta.color}25` }}>
              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
              <div className="profile-personality-info">
                <span className="profile-personality-label" style={{ color: meta.color }}>{user.date_personality}</span>
                <span className="profile-personality-desc">{meta.desc}</span>
              </div>
            </div>
          )}

          {user.date_vibe_summary && (
            <div className="profile-vibe-summary">
              <p>"{user.date_vibe_summary}"</p>
            </div>
          )}

          <button className="edit-date-style-btn" onClick={onEditDateStyle}>
            {user.date_personality ? '✏️ Update date style' : '💡 Add your date style'}
          </button>
        </div>
      )}

      {/* Stats — 2 cards only */}
      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{matchCount}</div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.round(profile?.elo_rating || 1000)}</div>
          <div className="stat-label">Rating</div>
        </div>
      </div>

      {/* Settings link */}
      <div className="profile-section">
        <button className="profile-settings-link" onClick={() => setScreen('settings')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
          <svg className="settings-link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
