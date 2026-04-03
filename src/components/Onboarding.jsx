import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

const PHOTO_STATE = { NONE: 'none', CHECKING: 'checking', VALID: 'valid', INVALID: 'invalid' }

export default function Onboarding({ onComplete, isSupabase }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [bio, setBio] = useState('')
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState('')
  const [lookingFor, setLookingFor] = useState('')

  // Up to 4 photos. Index 0 = main (required, AI validated). 1-3 optional.
  const [photos, setPhotos] = useState([null, null, null, null])   // data URLs
  const [photoBlobs, setPhotoBlobs] = useState([null, null, null, null])
  const [mainPhotoState, setMainPhotoState] = useState(PHOTO_STATE.NONE)
  const [mainPhotoError, setMainPhotoError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)

  const fileRefs = [useRef(), useRef(), useRef(), useRef()]

  const validateMainPhoto = useCallback(async (base64, mediaType) => {
    setMainPhotoState(PHOTO_STATE.CHECKING)
    setMainPhotoError('')
    try {
      const res = await supabase.functions.invoke('validate-photo', {
        body: { imageBase64: base64, mediaType },
      })
      if (res.error) throw new Error(res.error.message)
      const { valid, reason } = res.data
      if (valid) {
        setMainPhotoState(PHOTO_STATE.VALID)
      } else {
        setMainPhotoState(PHOTO_STATE.INVALID)
        setMainPhotoError(reason || 'Please upload a clear photo of yourself.')
        setPhotos(prev => { const n = [...prev]; n[0] = null; return n })
        setPhotoBlobs(prev => { const n = [...prev]; n[0] = null; return n })
      }
    } catch {
      setMainPhotoState(PHOTO_STATE.VALID) // fail open
    }
  }, [])

  const handleFile = async (file, slotIndex) => {
    if (!file || !file.type.startsWith('image/')) return
    if (slotIndex === 0) setMainPhotoState(PHOTO_STATE.CHECKING)
    try {
      const { blob, base64, mediaType, dataUrl } = await prepareImage(file)
      setPhotos(prev => { const n = [...prev]; n[slotIndex] = dataUrl; return n })
      setPhotoBlobs(prev => { const n = [...prev]; n[slotIndex] = blob; return n })
      if (slotIndex === 0) await validateMainPhoto(base64, mediaType)
    } catch {
      if (slotIndex === 0) {
        setMainPhotoState(PHOTO_STATE.NONE)
        setMainPhotoError('Could not read that file. Try another photo.')
      }
    }
  }

  const removePhoto = (slotIndex) => {
    if (slotIndex === 0) { setMainPhotoState(PHOTO_STATE.NONE); setMainPhotoError('') }
    setPhotos(prev => { const n = [...prev]; n[slotIndex] = null; return n })
    setPhotoBlobs(prev => { const n = [...prev]; n[slotIndex] = null; return n })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    try {
      const validBlobs = photoBlobs.filter(Boolean)
      const photoFiles = validBlobs.map((b, i) => new File([b], `photo_${i}.jpg`, { type: 'image/jpeg' }))
      await onComplete({
        name: name.trim(),
        age: parseInt(age),
        bio: bio.trim(),
        major: major.trim(),
        gender,
        looking_for: lookingFor || 'everyone',
        photo: null,
        photoFiles: isSupabase ? photoFiles : [],
      })
    } catch {
      setLoading(false)
    }
  }

  const isValid = name.trim() && age >= 18 && gender && mainPhotoState === PHOTO_STATE.VALID

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

        {/* ── Photo grid ── */}
        <div className="form-group">
          <label className="form-label">
            Photos <span style={{ color: 'var(--uga-red)' }}>*</span>
            <span style={{ color: 'var(--gray-400)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>
              up to 4
            </span>
          </label>

          <div className="photo-grid">
            {/* Main photo — large, required, AI-validated */}
            <div className="photo-grid-main">
              <div
                className={`photo-slot main-slot ${photos[0] ? 'has-photo' : ''} ${mainPhotoState === PHOTO_STATE.VALID ? 'slot-valid' : ''} ${mainPhotoState === PHOTO_STATE.INVALID ? 'slot-invalid' : ''}`}
                onClick={() => mainPhotoState !== PHOTO_STATE.CHECKING && fileRefs[0].current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0], 0) }}
                style={{ cursor: mainPhotoState === PHOTO_STATE.CHECKING ? 'wait' : 'pointer' }}
              >
                {photos[0] ? (
                  <>
                    <img src={photos[0]} alt="Main photo" />
                    {mainPhotoState === PHOTO_STATE.CHECKING && (
                      <div className="photo-checking-overlay">
                        <div className="photo-checking-spinner" />
                        <span>Checking...</span>
                      </div>
                    )}
                    {mainPhotoState === PHOTO_STATE.VALID && (
                      <div className="photo-valid-badge">✓</div>
                    )}
                    {mainPhotoState !== PHOTO_STATE.CHECKING && (
                      <button type="button" className="photo-remove-btn" onClick={(e) => { e.stopPropagation(); removePhoto(0) }}>✕</button>
                    )}
                  </>
                ) : (
                  <div className="photo-slot-empty">
                    {mainPhotoState === PHOTO_STATE.CHECKING ? (
                      <><div className="photo-checking-spinner large" /><span>Checking...</span></>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>Main Photo</span>
                        <span style={{ fontSize: 10, color: 'var(--uga-red)', fontWeight: 700 }}>Required</span>
                      </>
                    )}
                  </div>
                )}
                <input ref={fileRefs[0]} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0], 0)} />
              </div>

              {/* Status below main photo */}
              {mainPhotoState === PHOTO_STATE.INVALID && (
                <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600, marginTop: 6, lineHeight: 1.4, textAlign: 'center' }}>
                  {mainPhotoError}
                  <button type="button" style={{ display: 'block', margin: '4px auto 0', color: 'var(--uga-red)', fontWeight: 700, textDecoration: 'underline', fontSize: 12 }} onClick={() => fileRefs[0].current?.click()}>
                    Try again
                  </button>
                </div>
              )}
              {mainPhotoState === PHOTO_STATE.VALID && (
                <div style={{ color: '#16A34A', fontSize: 12, fontWeight: 600, marginTop: 6, textAlign: 'center' }}>Photo verified ✓</div>
              )}
              {mainPhotoState === PHOTO_STATE.NONE && (
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6, textAlign: 'center', lineHeight: 1.4 }}>
                  Must be a real photo of your face
                </p>
              )}
            </div>

            {/* Extra photo slots 1-3 */}
            <div className="photo-grid-extras">
              {[1, 2, 3].map((slotIndex) => (
                <div
                  key={slotIndex}
                  className={`photo-slot extra-slot ${photos[slotIndex] ? 'has-photo' : ''}`}
                  onClick={() => fileRefs[slotIndex].current?.click()}
                >
                  {photos[slotIndex] ? (
                    <>
                      <img src={photos[slotIndex]} alt={`Photo ${slotIndex + 1}`} />
                      <button type="button" className="photo-remove-btn" onClick={(e) => { e.stopPropagation(); removePhoto(slotIndex) }}>✕</button>
                    </>
                  ) : (
                    <div className="photo-slot-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span style={{ fontSize: 9, color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.2 }}>Any photo</span>
                    </div>
                  )}
                  <input ref={fileRefs[slotIndex]} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0], slotIndex)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Rest of form ── */}
        <div className="form-group">
          <label className="form-label">First Name</label>
          <input className="form-input" type="text" placeholder="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Age</label>
            <input className="form-input" type="number" placeholder="18+" min="18" max="30" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Major</label>
            <input className="form-input" type="text" placeholder="e.g. Biology" value={major} onChange={(e) => setMajor(e.target.value)} maxLength={50} />
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
          <textarea className="form-textarea" placeholder="What makes you a true Dawg? 🐾" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
        </div>

        <button className="submit-btn" type="submit" disabled={!isValid || loading}>
          {loading ? 'Setting up...' : mainPhotoState === PHOTO_STATE.CHECKING ? 'Verifying photo...' : 'Start Swiping'}
        </button>

        {mainPhotoState !== PHOTO_STATE.VALID && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
            A verified face photo is required to continue
          </p>
        )}
      </form>
    </div>
  )
}
