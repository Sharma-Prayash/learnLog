import { ExternalLink, Check, Circle } from 'lucide-react'
import { getContentType, isPreviewable, getFileTypeIcon } from '../utils/contentTypes'
import './LessonItem.css'

export default function LessonItem({ node, onToggle, onPreview, isAdmin = false }) {
  const contentType = getContentType(node.resource_url)
  const canPreview = isPreviewable(node.resource_url)
  const typeIcon = getFileTypeIcon(node.resource_url)

  function handleAdminToggle() {
    if (!isAdmin) return
    onToggle(node.id, !node.completed)
  }

  function handleClick(e) {
    e.stopPropagation()

    if (canPreview && onPreview) {
      // Open in-app preview
      onPreview(node)
      if (!node.completed && contentType !== 'video') {
        // Auto-mark non-video files as completed on open (videos use 70% threshold)
        onToggle(node.id, true)
      }
    } else if (node.resource_url) {
      // External — open in new tab
      window.open(node.resource_url, '_blank', 'noopener,noreferrer')
      if (!node.completed) {
        onToggle(node.id, true)
      }
    }
  }

  return (
    <div className={`lesson-item ${node.completed ? 'lesson-completed' : ''}`} id={`lesson-${node.id}`}>
      {/* Admin: clickable checkbox | Student: read-only indicator */}
      {isAdmin ? (
        <button
          className={`lesson-checkbox ${node.completed ? 'checked' : ''}`}
          onClick={handleAdminToggle}
          title={node.completed ? 'Mark as incomplete' : 'Mark as complete'}
          id={`lesson-toggle-${node.id}`}
        >
          {node.completed && <Check size={12} strokeWidth={3} />}
        </button>
      ) : (
        <span className={`lesson-status ${node.completed ? 'lesson-status-done' : ''}`}>
          {node.completed ? <Check size={12} strokeWidth={3} /> : <Circle size={12} />}
        </span>
      )}

      {node.resource_url ? (
        <button
          className={`lesson-name lesson-name-link lesson-name-btn`}
          onClick={handleClick}
        >
          <span className={`lesson-type-icon type-${contentType}`}>{typeIcon}</span>
          {node.name}
        </button>
      ) : (
        <span className="lesson-name">
          <span className="lesson-type-icon type-unknown">📎</span>
          {node.name}
        </span>
      )}

      {node.resource_url && (
        <a
          href={node.resource_url}
          target="_blank"
          rel="noopener noreferrer"
          className="lesson-link"
          title="Open in new tab"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}
