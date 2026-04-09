import { useState, useEffect } from 'react'
import { Send, Trash2, MessageCircle, Loader2 } from 'lucide-react'
import { getComments, createComment, deleteComment } from '../api'
import './CommentsSection.css'

export default function CommentsSection({ nodeId }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!nodeId) return
    setLoading(true)
    getComments(nodeId)
      .then((data) => setComments(data))
      .catch((err) => console.error('Failed to load comments:', err))
      .finally(() => setLoading(false))
  }, [nodeId])

  async function handlePost(e) {
    e.preventDefault()
    if (!body.trim() || posting) return

    setPosting(true)
    try {
      const newComment = await createComment(nodeId, body.trim())
      setComments((prev) => [newComment, ...prev])
      setBody('')
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(commentId) {
    try {
      await deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="comments-section" id="comments-section">
      <div className="comments-header">
        <MessageCircle size={14} />
        <span>Discussion ({comments.length})</span>
      </div>

      {/* Post form */}
      <form className="comments-form" onSubmit={handlePost}>
        <input
          type="text"
          className="comments-input"
          placeholder="Ask a question or leave a note..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={posting}
        />
        <button
          type="submit"
          className="comments-send-btn"
          disabled={!body.trim() || posting}
          title="Post comment"
        >
          {posting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
        </button>
      </form>

      {/* Comments list */}
      <div className="comments-list">
        {loading ? (
          <div className="comments-loading">
            <Loader2 size={16} className="spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="comments-empty">No comments yet. Be the first to ask!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item animate-fade-in" id={`comment-${comment.id}`}>
              <div className="comment-header">
                <span className="comment-author">{comment.username}</span>
                <span className="comment-time">{formatDate(comment.created_at)}</span>
              </div>
              <p className="comment-body">{comment.body}</p>
              {comment.can_delete && (
                <button
                  className="comment-delete-btn"
                  onClick={() => handleDelete(comment.id)}
                  title="Delete comment"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
