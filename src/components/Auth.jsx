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

    // .edu email validation on signup
    if (mode === 'signup') {
      if (!email.toLowerCase().endsWith('.edu')) {
        setError('Please use a valid .edu email address to sign up.')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) {
          // Supabase returns generic error for duplicate emails
          if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
            throw new Error('An account with this email already exists. Try signing in instead.')
          }
          throw signUpError
        }
        // Check if user was actually created vs duplicate
        // Supabase may return a user object even for duplicates with email confirmation disabled
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('An account with this email already exists. Try signing in instead.')
        }
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
        <p className="onboarding-tagline">Find your Dawg</p>
      </div>

      {/* Mode toggle tabs */}
      <div style={{
        display: 'flex',
        background: 'var(--gray-100)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
        marginBottom: '24px',
        gap: '4px',
      }}>
        <button
          type="button"
          onClick={() => { setMode('signin'); setError('') }}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            fontSize: '15px',
            fontWeight: 700,
            transition: 'all 0.2s',
            background: mode === 'signin' ? 'var(--uga-red)' : 'transparent',
            color: mode === 'signin' ? 'white' : 'var(--gray-500)',
            boxShadow: mode === 'signin' ? '0 2px 8px rgba(186,12,47,0.3)' : 'none',
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError('') }}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 'calc(var(--radius-md) - 2px)',
            fontSize: '15px',
            fontWeight: 700,
            transition: 'all 0.2s',
            background: mode === 'signup' ? 'var(--uga-red)' : 'transparent',
            color: mode === 'signup' ? 'white' : 'var(--gray-500)',
            boxShadow: mode === 'signup' ? '0 2px 8px rgba(186,12,47,0.3)' : 'none',
          }}
        >
          Sign Up
        </button>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit} style={{ paddingTop: 0 }}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            className="form-input"
            type="email"
            placeholder={mode === 'signup' ? 'your@university.edu' : 'your@email.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode === 'signup' && (
            <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '2px' }}>
              Must be a .edu email address
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            className="form-input"
            type="password"
            placeholder={mode === 'signup' ? 'Create a password (6+ chars)' : 'Your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'signup' ? 6 : undefined}
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
      </form>
    </div>
  )
}
