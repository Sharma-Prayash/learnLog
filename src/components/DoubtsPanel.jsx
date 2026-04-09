import { useState, useEffect } from 'react'
import { HelpCircle, Plus, Trash2, Loader2, X, Send, MessageSquare, CheckCircle2, Circle } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getDoubts, createDoubt, deleteDoubt, updateDoubtStatus, getDoubtDetail, createDoubtReply } from '../api'
import './DoubtsPanel.css'

export default function DoubtsPanel({ classroomId, isAdmin = false }) {
  const { user } = useAuth()
  const [doubts, setDoubts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedDoubt, setSelectedDoubt] = useState(null)
  
  // New Doubt Form
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  // Reply Form
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    if (!classroomId) return
    let cancelled = false

    async function loadDoubts() {
      try {
        const data = await getDoubts(classroomId)
        if (!cancelled) setDoubts(data)
      } catch (err) {
        console.error('Failed to load doubts:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDoubts()
    return () => { cancelled = true }
  }, [classroomId])

  async function handlePost(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || posting) return

    setPosting(true)
    try {
      const newItem = await createDoubt(classroomId, title.trim(), body.trim())
      setDoubts((prev) => [newItem, ...prev])
      setTitle('')
      setBody('')
      setShowForm(false)
    } catch (err) {
      console.error('Failed to post doubt:', err)
    } finally {
      setPosting(false)
    }
  }

  async function handleViewDoubt(id) {
    try {
      const detail = await getDoubtDetail(id)
      setSelectedDoubt(detail)
    } catch (err) {
      console.error('Failed to load doubt detail:', err)
    }
  }

  async function handleReply(e) {
    e.preventDefault()
    if (!replyBody.trim() || replying || !selectedDoubt) return

    setReplying(true)
    try {
      const newReply = await createDoubtReply(selectedDoubt.id, replyBody.trim())
      setSelectedDoubt((prev) => ({
        ...prev,
        replies: [...(prev.replies || []), newReply],
        reply_count: (prev.reply_count || 0) + 1
      }))
      setDoubts((prev) => prev.map(d => d.id === selectedDoubt.id ? { ...d, reply_count: d.reply_count + 1 } : d))
      setReplyBody('')
    } catch (err) {
      console.error('Failed to post reply:', err)
    } finally {
      setReplying(false)
    }
  }

  async function handleDelete(id, e) {
    if (e) e.stopPropagation()
    if (!window.confirm('Delete this doubt?')) return
    try {
      await deleteDoubt(id)
      setDoubts((prev) => prev.filter((d) => d.id !== id))
      if (selectedDoubt?.id === id) setSelectedDoubt(null)
    } catch (err) {
      console.error('Failed to delete doubt:', err)
    }
  }

  async function handleToggleStatus(id, currentStatus, e) {
    if (e) e.stopPropagation()
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open'
    try {
      await updateDoubtStatus(id, newStatus)
      setDoubts((prev) => prev.map(d => d.id === id ? { ...d, status: newStatus } : d))
      if (selectedDoubt?.id === id) setSelectedDoubt(prev => ({ ...prev, status: newStatus }))
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  if (selectedDoubt) {
    return (
      <div className="doubts-panel" id="doubts-panel">
        <div className="doubts-header">
          <button className="btn-back" onClick={() => setSelectedDoubt(null)}>
            <X size={16} /> Back to list
          </button>
          <div className="doubt-status-actions">
             <button 
              className={`status-badge ${selectedDoubt.status}`}
              onClick={(e) => handleToggleStatus(selectedDoubt.id, selectedDoubt.status, e)}
              title="Click to toggle status"
            >
              {selectedDoubt.status === 'resolved' ? <CheckCircle2 size={12} /> : <Circle size={12} />}
              {selectedDoubt.status}
            </button>
          </div>
        </div>

        <div className="doubt-detail animate-fade-in">
          <div className="doubt-main-post">
            <h3 className="doubt-detail-title">{selectedDoubt.title}</h3>
            <div className="doubt-item-meta">
              <span>{selectedDoubt.username}</span>
              <span>·</span>
              <span>{formatDate(selectedDoubt.created_at)}</span>
            </div>
            <p className="doubt-detail-body">{selectedDoubt.body}</p>
          </div>

          <div className="replies-section">
            <h4>Replies ({selectedDoubt.replies?.length || 0})</h4>
            <div className="replies-list">
              {selectedDoubt.replies?.map(r => (
                <div key={r.id} className="reply-item">
                   <div className="reply-meta">
                    <strong>{r.username}</strong>
                    <span>{formatDate(r.created_at)}</span>
                  </div>
                  <p className="reply-body">{r.body}</p>
                </div>
              ))}
              {(!selectedDoubt.replies || selectedDoubt.replies.length === 0) && (
                <p className="no-replies">No replies yet. Be the first to help!</p>
              )}
            </div>

            <form className="reply-form" onSubmit={handleReply}>
              <textarea 
                placeholder="Write a reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={3}
                disabled={replying}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-sm"
                disabled={!replyBody.trim() || replying}
              >
                {replying ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                Reply
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="doubts-panel" id="doubts-panel">
      <div className="doubts-header">
        <div className="doubts-title">
          <HelpCircle size={16} className="doubts-icon" />
          <h3>Doubts & Discussions</h3>
          {doubts.length > 0 && (
            <span className="doubts-count">{doubts.length}</span>
          )}
        </div>

        <button
          className="btn btn-sm btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancel' : 'Ask a Doubt'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form className="doubt-form animate-fade-in" onSubmit={handlePost}>
          <input
            type="text"
            placeholder="Doubt title (e.g., Problem with Lesson 2)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="doubt-form-title"
            disabled={posting}
          />
          <textarea
            placeholder="Explain your doubt in detail..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="doubt-form-body"
            rows={4}
            disabled={posting}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!title.trim() || !body.trim() || posting}
          >
            {posting ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
            Post Doubt
          </button>
        </form>
      )}

      {/* Doubts list */}
      <div className="doubts-list">
        {loading ? (
          <div className="doubts-loading">
            <Loader2 size={16} className="spin" />
          </div>
        ) : doubts.length === 0 ? (
          <div className="doubts-empty">
            <HelpCircle size={22} />
            <p>No doubts yet. If you're stuck, ask here!</p>
          </div>
        ) : (
          doubts.map((d) => (
            <div 
              key={d.id} 
              className={`doubt-item animate-fade-in ${d.status === 'resolved' ? 'resolved' : ''}`}
              onClick={() => handleViewDoubt(d.id)}
            >
              <div className="doubt-item-main">
                <div className="doubt-item-header">
                  <h4 className="doubt-item-title">
                    {d.status === 'resolved' && <CheckCircle2 size={14} className="resolved-icon" />}
                    {d.title}
                  </h4>
                  <div className="doubt-actions">
                    <button 
                      className={`status-indicator ${d.status}`}
                      onClick={(e) => handleToggleStatus(d.id, d.status, e)}
                      title={d.status === 'open' ? 'Mark as resolved' : 'Reopen'}
                    >
                      {d.status === 'resolved' ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    </button>
                    {(isAdmin || d.user_id === user?.id) && (
                      <button
                        className="doubt-delete-btn"
                        onClick={(e) => handleDelete(d.id, e)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="doubt-item-preview">{d.body.substring(0, 120)}{d.body.length > 120 ? '...' : ''}</p>
                <div className="doubt-item-footer">
                  <div className="doubt-item-meta">
                    <span>{d.username}</span>
                    <span>·</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                  <div className="doubt-replies-count">
                    <MessageSquare size={12} />
                    <span>{d.reply_count || 0} replies</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
