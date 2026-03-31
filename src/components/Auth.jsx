import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
        // Auto sign-in after signup (Supabase does this by default)
        if (data.user) {
          onAuth(data.user, true) // true = needs profile setup
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        if (data.user) {
          onAuth(data.user, false)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-header">
        <div className="onboarding-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="onboarding-logo">DawgDate</div>
        <p className="onboarding-tagline">
          {mode === 'signin' ? 'Welcome back, Dawg!' : 'Join the pack'}
        </p>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            placeholder="your@uga.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder={mode === 'signup' ? 'Create a password (6+ chars)' : 'Your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: '#FEE2E2',
            color: '#991B1B',
            fontSize: '14px',
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <button
          className="submit-btn"
          type="submit"
          disabled={loading || !email || !password}
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
          style={{
            textAlign: 'center',
            color: 'var(--uga-red)',
            fontSize: '15px',
            fontWeight: 600,
            padding: '8px',
          }}
        >
          {mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
        </button>
      </form>
    </div>
  )
}
