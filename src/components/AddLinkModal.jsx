import { useState } from 'react'
import { X, Link2, Loader2 } from 'lucide-react'
import './CreateClassroomModal.css'

export default function AddLinkModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return

    setLoading(true)
    setError('')
    try {
      await onSubmit(name.trim(), url.trim())
      setName('')
      setUrl('')
      onClose()
    } catch (err) {
      console.error('Failed to add link:', err)
      setError(err.response?.data?.error || 'Failed to add link')
    } finally {
      setLoading(false)
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay animate-fade-in" onClick={handleOverlayClick} id="add-link-modal">
      <div className="modal-content animate-scale-in" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Add External Link</h2>
          <button className="btn-icon btn-ghost" onClick={onClose} id="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="link-name-input">Resource Name</label>
            <input
              id="link-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YouTube Video - Recursion"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="link-url-input">URL (YouTube, Vimeo, etc.)</label>
            <input
              id="link-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || !url.trim() || loading}
              id="add-link-submit"
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
              {loading ? 'Adding...' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
