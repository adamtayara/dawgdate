import { getPersonalityMeta } from '../lib/ai'

export default function ProfileView({ user, matchCount, likeCount, onLogout, onEditDateStyle }) {
  const meta = user.date_personality ? getPersonalityMeta(user.date_personality) : null

  return (
    <div className="profile-view">
      <div className="profile-hero">
        <div className="profile-photo-container">
          <img className="profile-photo-large" src={user.photo_url || user.photo} alt={user.name} />
          <div className="profile-verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <div className="profile-name-large">{user.name}, {user.age}</div>
        <div className="profile-age-large">University of Georgia</div>
        {user.bio && <p className="profile-bio-large">{user.bio}</p>}

        {/* Date Personality Badge */}
        {meta && (
          <div
            className="profile-personality-badge"
            style={{ background: `${meta.color}15`, borderColor: `${meta.color}30` }}
          >
            <span style={{ fontSize: 18 }}>{meta.emoji}</span>
            <div className="profile-personality-info">
              <span className="profile-personality-label" style={{ color: meta.color }}>
                {user.date_personality}
              </span>
              <span className="profile-personality-desc">{meta.desc}</span>
            </div>
          </div>
        )}

        {/* Vibe Summary */}
        {user.date_vibe_summary && (
          <div className="profile-vibe-summary">
            <p>"{user.date_vibe_summary}"</p>
          </div>
        )}

        {/* Edit or add date style */}
        <button
          className="edit-date-style-btn"
          onClick={onEditDateStyle}
        >
          {user.date_personality ? '✏️ Update date style' : '💡 Add your date style'}
        </button>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{likeCount}</div>
          <div className="stat-label">Swiped</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matchCount}</div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{matchCount > 0 ? Math.round((matchCount / Math.max(likeCount, 1)) * 100) : 0}%</div>
          <div className="stat-label">Rate</div>
        </div>
      </div>

      <div className="profile-section">
        <button className="logout-btn" onClick={onLogout}>
          Sign Out & Reset
        </button>
      </div>
    </div>
  )
}
