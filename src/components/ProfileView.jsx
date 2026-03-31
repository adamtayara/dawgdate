export default function ProfileView({ user, matchCount, likeCount, onLogout }) {
  return (
    <div className="profile-view">
      <div className="profile-hero">
        <div className="profile-photo-container">
          <img className="profile-photo-large" src={user.photo} alt={user.name} />
          <div className="profile-verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <div className="profile-name-large">{user.name}, {user.age}</div>
        <div className="profile-age-large">University of Georgia</div>
        {user.bio && <p className="profile-bio-large">{user.bio}</p>}
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
