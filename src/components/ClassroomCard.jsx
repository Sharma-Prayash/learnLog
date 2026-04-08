import { Link } from 'react-router-dom'
import { Trash2, Users, Clock, ChevronRight } from 'lucide-react'
import ProgressBar from './ProgressBar'
import './ClassroomCard.css'

export default function ClassroomCard({ classroom, variant = 'teaching', onDelete, index = 0 }) {
  const isTeaching = variant === 'teaching'
  const isPending = variant === 'pending'
  const linkTo = isTeaching ? `/classroom/${classroom.id}/admin` : `/classroom/${classroom.id}`

  function handleDelete(e) {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(`Delete "${classroom.name}"? This will permanently remove the classroom and all its content.`)) {
      onDelete(classroom.id)
    }
  }

  // Pending cards are not navigable
  if (isPending) {
    return (
      <div
        className={`classroom-card card classroom-card-pending animate-fade-in-up delay-${Math.min(index + 1, 6)}`}
        id={`classroom-card-${classroom.id}`}
      >
        <div className="classroom-card-header">
          <div className="classroom-card-title-row">
            <h3 className="classroom-card-title">{classroom.name}</h3>
          </div>
          {classroom.description && (
            <p className="classroom-card-desc">{classroom.description}</p>
          )}
        </div>

        <div className="pending-card-status">
          <Clock size={14} className="pending-clock" />
          <span>Awaiting admin approval</span>
        </div>

        <div className="classroom-card-stats">
          <span className="card-stat">by {classroom.owner_name}</span>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={linkTo}
      className={`classroom-card card animate-fade-in-up delay-${Math.min(index + 1, 6)}`}
      id={`classroom-card-${classroom.id}`}
    >
      <div className="classroom-card-header">
        <div className="classroom-card-title-row">
          <h3 className="classroom-card-title">{classroom.name}</h3>
          {isTeaching && onDelete && (
            <button className="btn-icon btn-delete-card" onClick={handleDelete} title="Delete classroom">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {classroom.description && (
          <p className="classroom-card-desc">{classroom.description}</p>
        )}
      </div>

      {isTeaching ? (
        <div className="classroom-card-stats">
          <span className="card-stat">
            <Users size={14} />
            {classroom.student_count || 0} students
          </span>
          {(classroom.pending_count || 0) > 0 && (
            <span className="card-stat pending-badge">
              <Clock size={13} />
              {classroom.pending_count} pending
            </span>
          )}
          <span className="card-stat">
            {classroom.total_lessons || 0} lessons
          </span>
        </div>
      ) : (
        <div className="classroom-card-progress-section">
          <div className="card-meta-row">
            <span className="card-stat">by {classroom.owner_name}</span>
            <span className="card-stat">{classroom.completed_lessons || 0}/{classroom.total_lessons || 0}</span>
          </div>
          <ProgressBar progress={classroom.progress || 0} size="sm" />
        </div>
      )}

      <div className="classroom-card-action">
        <span className="card-action-text">{isTeaching ? 'Manage' : 'Continue'}</span>
        <ChevronRight size={14} />
      </div>
    </Link>
  )
}
