import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Resize image to max 900px and return { blob, base64, mediaType }
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
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target.result
          const base64 = dataUrl.split(',')[1]
          resolve({ blob, base64, mediaType: 'image/jpeg', dataUrl })
        }
        reader.readAsDataURL(blob)
      }, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

// Photo validation states
const PHOTO_STATE = {
  NONE: 'none',
  CHECKING: 'checking',
  VALID: 'valid',
  INVALID: 'invalid',
}

export default function Onboarding({ onComplete, isSupabase }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [bio, setBio] = useState('')
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [photo, setPhoto] = useState(null)       // data URL for preview
  const [photoBlob, setPhotoBlob] = useState(null)
  const [photoState, setPhotoState] = useState(PHOTO_STATE.NONE)
  const [photoError, setPhotoError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const validatePhoto = useCallback(async (base64, mediaType) => {
    setPhotoState(PHOTO_STATE.CHECKING)
    setPhotoError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('validate-photo', {
        body: { imageBase64: base64, mediaType },
      })
      if (res.error) throw new Error(res.error.message)
      const { valid, reason } = res.data
      if (valid) {
        setPhotoState(PHOTO_STATE.VALID)
      } else {
        setPhotoState(PHOTO_STATE.INVALID)
        setPhotoError(reason || 'Please upload a clear photo of yourself.')
        setPhoto(null)
        setPhotoBlob(null)
      }
    } catch {
      // Network or function error — fail open so users aren't blocked
      setPhotoState(PHOTO_STATE.VALID)
    }
  }, [])

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setPhotoState(PHOTO_STATE.CHECKING)
    setPhotoError('')

    try {
      const { blob, base64, mediaType, dataUrl } = await prepareImage(file)
      setPhoto(dataUrl)
      setPhotoBlob(blob)
      await validatePhoto(base64, mediaType)
    } catch {
      setPhotoState(PHOTO_STATE.NONE)
      setPhotoError('Could not read that file. Try a different photo.')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    try {
      await onComplete({
        name: name.trim(),
        age: parseInt(age),
        bio: bio.trim(),
        major: major.trim(),
        gender,
        looking_for: lookingFor || 'everyone',
        photo: null,
        photoFile: photoBlob ? new File([photoBlob], 'photo.jpg', { type: 'image/jpeg' }) : null,
      })
    } catch {
      setLoading(false)
    }
  }

  const isValid = name.trim() && age >= 18 && gender && photoState === PHOTO_STATE.VALID

  const photoStatus = {
    [PHOTO_STATE.NONE]: null,
    [PHOTO_STATE.CHECKING]: {
      text: 'Checking your photo...',
      color: 'var(--gray-500)',
      icon: '⏳',
    },
    [PHOTO_STATE.VALID]: {
      text: 'Photo looks great ✓',
      color: '#16A34A',
      icon: null,
    },
    [PHOTO_STATE.INVALID]: {
      text: photoError || 'Please upload a real photo of yourself.',
      color: '#DC2626',
      icon: '✕',
    },
  }[photoState]

  return (
    <div className="onboarding">
      <div className="onboarding-header">
        <div className="onboarding-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="onboarding-logo">DawgDate</div>
        <p className="onboarding-tagline">Set up your profile</p>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit}>

        {/* Photo upload — required */}
        <div className="form-group">
          <label className="form-label">
            Profile Photo <span style={{ color: 'var(--uga-red)' }}>*</span>
          </label>

          <div
            className={`photo-upload ${dragOver ? 'drag-over' : ''} ${photo ? 'has-photo' : ''} ${photoState === PHOTO_STATE.INVALID ? 'photo-invalid' : ''} ${photoState === PHOTO_STATE.VALID ? 'photo-valid' : ''}`}
            onClick={() => photoState !== PHOTO_STATE.CHECKING && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ cursor: photoState === PHOTO_STATE.CHECKING ? 'wait' : 'pointer' }}
          >
            {photo && photoState !== PHOTO_STATE.INVALID ? (
              <>
                <img src={photo} alt="Your photo" />
                {photoState === PHOTO_STATE.CHECKING && (
                  <div className="photo-checking-overlay">
                    <div className="photo-checking-spinner" />
                    <span>Verifying...</span>
                  </div>
                )}
                {photoState === PHOTO_STATE.VALID && (
                  <div className="photo-valid-badge">✓</div>
                )}
              </>
            ) : (
              <div className="photo-upload-empty">
                {photoState === PHOTO_STATE.CHECKING ? (
                  <>
                    <div className="photo-checking-spinner large" />
                    <span>Checking photo...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>Tap to add photo</span>
                    <span className="photo-upload-sub">Must be a real photo of your face</span>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {photoStatus && (
            <div className="photo-status-row" style={{ color: photoStatus.color }}>
              {photoStatus.text}
              {photoState === PHOTO_STATE.INVALID && (
                <button
                  type="button"
                  className="photo-retry-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {photoState === PHOTO_STATE.NONE && (
            <p className="photo-upload-hint">
              A clear photo of your face is required. No logos, cartoons, or group photos.
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">First Name</label>
          <input
            className="form-input"
            type="text"
            placeholder="What should we call you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Age</label>
            <input
              className="form-input"
              type="number"
              placeholder="18+"
              min="18"
              max="30"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Major</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Biology"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              maxLength={50}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">I am a</label>
          <div className="gender-selector">
            <button type="button" className={`gender-btn ${gender === 'male' ? 'active' : ''}`} onClick={() => setGender('male')}>Male</button>
            <button type="button" className={`gender-btn ${gender === 'female' ? 'active' : ''}`} onClick={() => setGender('female')}>Female</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Show me</label>
          <div className="gender-selector">
            <button type="button" className={`gender-btn ${lookingFor === 'male' ? 'active' : ''}`} onClick={() => setLookingFor('male')}>Men</button>
            <button type="button" className={`gender-btn ${lookingFor === 'female' ? 'active' : ''}`} onClick={() => setLookingFor('female')}>Women</button>
            <button type="button" className={`gender-btn ${lookingFor === 'everyone' || lookingFor === '' ? 'active' : ''}`} onClick={() => setLookingFor('everyone')}>Everyone</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">About You</label>
          <textarea
            className="form-textarea"
            placeholder="What makes you a true Dawg? 🐾"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
          />
        </div>

        <button
          className="submit-btn"
          type="submit"
          disabled={!isValid || loading}
        >
          {loading ? 'Setting up...' : photoState === PHOTO_STATE.CHECKING ? 'Verifying photo...' : 'Start Swiping'}
        </button>

        {!photo && (
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--gray-400)', marginTop: 4 }}>
            A photo is required to continue
          </p>
        )}
      </form>
    </div>
  )
}
