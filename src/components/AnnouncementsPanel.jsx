import { useState, useEffect } from 'react'
import { Megaphone, Plus, Trash2, Loader2, X, Send } from 'lucide-react'
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '../api'
import './AnnouncementsPanel.css'

export default function AnnouncementsPanel({ classroomId, isAdmin = false }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!classroomId) return
    let cancelled = false

    async function loadAnnouncements() {
      try {
        const data = await getAnnouncements(classroomId)
        if (!cancelled) setAnnouncements(data)
      } catch (err) {
        console.error('Failed to load announcements:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAnnouncements()
    return () => { cancelled = true }
  }, [classroomId])

  async function handlePost(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || posting) return

    setPosting(true)
    try {
      const newItem = await createAnnouncement(classroomId, title.trim(), body.trim())
      setAnnouncements((prev) => [newItem, ...prev])
      setTitle('')
      setBody('')
      setShowForm(false)
    } catch (err) {
      console.error('Failed to post announcement:', err)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this announcement?')) return
    try {
      await deleteAnnouncement(id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error('Failed to delete announcement:', err)
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  return (
    <div className="announcements-panel" id="announcements-panel">
      <div className="announcements-header">
        <div className="announcements-title">
          <Megaphone size={16} className="announcements-icon" />
          <h3>Announcements</h3>
          {announcements.length > 0 && (
            <span className="announcements-count">{announcements.length}</span>
          )}
        </div>

        {isAdmin && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? <X size={13} /> : <Plus size={13} />}
            {showForm ? 'Cancel' : 'New'}
          </button>
        )}
      </div>

      {/* Create form (admin only) */}
      {isAdmin && showForm && (
        <form className="announcement-form animate-fade-in" onSubmit={handlePost}>
          <input
            type="text"
            placeholder="Announcement title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="announcement-form-title"
            disabled={posting}
          />
          <textarea
            placeholder="Write your announcement..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="announcement-form-body"
            rows={3}
            disabled={posting}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!title.trim() || !body.trim() || posting}
          >
            {posting ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
            Post
          </button>
        </form>
      )}

      {/* Announcements list */}
      <div className="announcements-list">
        {loading ? (
          <div className="announcements-loading">
            <Loader2 size={16} className="spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="announcements-empty">
            <Megaphone size={22} />
            <p>No announcements yet.</p>
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="announcement-item animate-fade-in" id={`announcement-${a.id}`}>
              <div className="announcement-item-header">
                <h4 className="announcement-item-title">{a.title}</h4>
                {isAdmin && (
                  <button
                    className="announcement-delete-btn"
                    onClick={() => handleDelete(a.id)}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <p className="announcement-item-body">{a.body}</p>
              <div className="announcement-item-meta">
                <span>{a.author_name}</span>
                <span>·</span>
                <span>{formatDate(a.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
