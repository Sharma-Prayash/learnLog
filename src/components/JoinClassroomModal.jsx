import { useState } from 'react'
import { X, KeyRound, Loader2 } from 'lucide-react'
import './CreateClassroomModal.css'

export default function JoinClassroomModal({ isOpen, onClose, onSubmit }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await onSubmit(code.trim().toUpperCase())
      setMessage(result.message || 'Join request submitted!')
      setCode('')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join classroom')
    } finally {
      setLoading(false)
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) { onClose(); setMessage(''); setError('') }
  }

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleOverlayClick} id="join-classroom-modal">
      <div className="modal-content animate-scale-in" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Join Classroom</h2>
          <button className="btn-icon btn-ghost" onClick={() => { onClose(); setMessage(''); setError('') }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="join-success">{message}</div>}
          <div className="form-group">
            <label htmlFor="invite-code-input">Invite Code</label>
            <div className="input-with-icon">
              <KeyRound size={16} className="input-icon" />
              <input
                id="invite-code-input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. XJ92LF"
                autoFocus
                required
                maxLength={12}
                style={{ paddingLeft: '40px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { onClose(); setMessage(''); setError('') }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!code.trim() || loading} id="join-classroom-submit">
              {loading ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
              {loading ? 'Joining...' : 'Request to Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
