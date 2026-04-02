export default function BottomNav({ activeTab, onTabChange, matchCount, hasNewMatch }) {
  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activeTab === 'swipe' ? 'active' : ''}`}
        onClick={() => onTabChange('swipe')}
      >
        <svg viewBox="0 0 24 24" fill={activeTab === 'swipe' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={activeTab === 'swipe' ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
          {activeTab === 'swipe' ? (
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          ) : (
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          )}
        </svg>
        <span>Discover</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'matches' ? 'active' : ''}`}
        onClick={() => onTabChange('matches')}
      >
        <svg viewBox="0 0 24 24" fill={activeTab === 'matches' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={activeTab === 'matches' ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {matchCount > 0 && (
          <span className="nav-badge" style={hasNewMatch ? { animation: 'pulse 0.6s ease 3' } : {}}>{matchCount}</span>
        )}
        <span>Matches</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onTabChange('profile')}
      >
        <svg viewBox="0 0 24 24" fill={activeTab === 'profile' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={activeTab === 'profile' ? '0' : '2'} strokeLinecap="round" strokeLinejoin="round">
          {activeTab === 'profile' ? (
            <>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </>
          ) : (
            <>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </>
          )}
        </svg>
        <span>Profile</span>
      </button>
    </nav>
  )
}
