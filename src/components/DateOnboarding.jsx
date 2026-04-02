import { useState, useRef, useEffect } from 'react'
import { submitDateDescription, getPersonalityMeta } from '../lib/ai'

const PROMPT_EXAMPLES = [
  "Evening walk through downtown, then stumbling into a wine bar we've never been to. Nothing rushed. Good conversation, maybe getting food if we're still having fun.",
  "Saturday morning coffee at a low-key local place, then a farmers market or some kind of outdoor thing. Nothing fancy — just easy, like we've known each other.",
  "Something a little spontaneous. Maybe a rooftop at sunset, then see where we end up. I want it to feel like an adventure, not a scheduled event.",
  "A real dinner, somewhere with dim lighting and a menu we have to think about. Start slow, order dessert, stay too long.",
]

const QUALITY_LEVELS = [
  { min: 0,   max: 30,  label: 'Keep going...',       color: '#9CA3AF' },
  { min: 30,  max: 80,  label: 'Getting interesting',  color: '#F59E0B' },
  { min: 80,  max: 150, label: 'Solid details',        color: '#10B981' },
  { min: 150, max: Infinity, label: 'Vivid! ✨',       color: '#BA0C2F' },
]

function getQuality(len) {
  return QUALITY_LEVELS.find(q => len >= q.min && len < q.max) || QUALITY_LEVELS[0]
}

export default function DateOnboarding({ onComplete, onSkip }) {
  const [text, setText] = useState('')
  const [inputMethod, setInputMethod] = useState('text')
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [showExamples, setShowExamples] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { date_personality, vibe_summary }

  const recognitionRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(!!SR)
  }, [])

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = text ? text + ' ' : ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += t + ' '
        } else {
          interim = t
        }
      }
      setText(finalTranscript + interim)
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
      setText(finalTranscript.trim())
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
    setInputMethod('voice')
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

  const handleSubmit = async () => {
    if (text.trim().length < 20) {
      setError('Give us a bit more to work with — describe the vibe, the setting, what would make it feel right.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await submitDateDescription(text.trim(), inputMethod)
      setResult(data)
    } catch (err) {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  const quality = getQuality(text.length)
  const meta = result ? getPersonalityMeta(result.date_personality) : null

  // ── Personality reveal screen ──
  if (result && meta) {
    return (
      <div className="date-onboarding">
        <div className="date-reveal">
          <div className="reveal-sparkle">✨</div>
          <p className="reveal-label">Your Date Personality</p>
          <div
            className="personality-badge-large"
            style={{ background: `${meta.color}18`, borderColor: `${meta.color}40` }}
          >
            <span className="personality-emoji">{meta.emoji}</span>
            <span className="personality-name" style={{ color: meta.color }}>
              {result.date_personality}
            </span>
          </div>
          <p className="reveal-desc">{meta.desc}</p>
          {result.vibe_summary && (
            <div className="reveal-summary">
              <p className="reveal-summary-label">What others will see on your profile:</p>
              <p className="reveal-summary-text">"{result.vibe_summary}"</p>
            </div>
          )}
          <button className="submit-btn" onClick={() => onComplete(result)} style={{ marginTop: 32 }}>
            Let's Find My Match
          </button>
        </div>
      </div>
    )
  }

  // ── Main input screen ──
  return (
    <div className="date-onboarding">
      <div className="date-onboarding-header">
        <div className="onboarding-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="onboarding-logo">One last thing</div>
        <p className="onboarding-tagline">Tell us about your ideal first date</p>
      </div>

      <div className="date-privacy-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Your words stay private — we only use them to find better matches and generate date ideas
      </div>

      <div className="date-onboarding-form">
        <p className="date-prompt">
          Describe your ideal first date in detail. Think about the vibe, setting, energy, time of day, and what would make it feel memorable.
        </p>

        <button
          className="examples-toggle"
          type="button"
          onClick={() => setShowExamples(!showExamples)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {showExamples ? 'Hide examples' : 'See example answers'}
        </button>

        {showExamples && (
          <div className="examples-list">
            {PROMPT_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                className="example-item"
                type="button"
                onClick={() => { setText(ex); setShowExamples(false); textareaRef.current?.focus() }}
              >
                "{ex}"
              </button>
            ))}
          </div>
        )}

        <div className="date-textarea-wrap">
          <textarea
            ref={textareaRef}
            className="date-textarea"
            placeholder="Evening walk through downtown, stumbling into a bar we've never tried, good conversation with nowhere to be..."
            value={text}
            onChange={e => setText(e.target.value)}
            rows={5}
            maxLength={800}
          />
          <div className="textarea-footer">
            <span className="quality-indicator" style={{ color: quality.color }}>
              {text.length > 0 ? quality.label : ''}
            </span>
            <span className="char-count" style={{ color: text.length > 600 ? '#F59E0B' : 'var(--gray-400)' }}>
              {text.length}/800
            </span>
          </div>
        </div>

        {voiceSupported && (
          <button
            type="button"
            className={`voice-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <>
                <span className="voice-dot" />
                Stop recording
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                Speak instead
              </>
            )}
          </button>
        )}

        {error && (
          <div className="date-error">{error}</div>
        )}

        <button
          className="submit-btn"
          type="button"
          onClick={handleSubmit}
          disabled={loading || text.trim().length < 20}
        >
          {loading ? (
            <span className="loading-text">
              <span className="loading-dot" />
              Finding your Date Personality...
            </span>
          ) : 'Reveal My Date Personality →'}
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            textAlign: 'center',
            color: 'var(--gray-400)',
            fontSize: '14px',
            padding: '8px',
            marginTop: 4,
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
