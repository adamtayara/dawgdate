import { useState, useRef } from 'react'

export default function Onboarding({ onComplete, isSupabase }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [bio, setBio] = useState('')
  const [major, setMajor] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setPhoto(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !age) return
    setLoading(true)
    try {
      await onComplete({
        name: name.trim(),
        age: parseInt(age),
        bio: bio.trim(),
        major: major.trim(),
        photo: photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=400&background=BA0C2F&color=fff&bold=true`,
        photoFile: isSupabase ? photoFile : null,
      })
    } catch {
      setLoading(false)
    }
  }

  const isValid = name.trim() && age >= 18

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
        <div
          className={`photo-upload ${dragOver ? 'drag-over' : ''} ${photo ? 'has-photo' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {photo ? (
            <img src={photo} alt="Your photo" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Add Photo</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
        <p className="photo-upload-hint">Tap to upload your best pic</p>

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
          <label className="form-label">About You</label>
          <textarea
            className="form-textarea"
            placeholder="What makes you a true Dawg? 🐾"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
          />
        </div>

        <button className="submit-btn" type="submit" disabled={!isValid || loading}>
          {loading ? 'Setting up...' : 'Start Swiping'}
        </button>
      </form>
    </div>
  )
}
