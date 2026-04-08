import { useNavigate } from 'react-router-dom'
import { Trash2, Users, FileText, ChevronRight, Clock, ShieldCheck, Hourglass } from 'lucide-react'
import ProgressBar from './ProgressBar'
import './ClassroomCard.css'

export default function ClassroomCard({ classroom, variant = 'learning', onDelete, index }) {
  const navigate = useNavigate()
  const isAdmin = variant === 'teaching'
  const isPending = variant === 'pending'

  const handleClick = () => {
    if (isPending) return
    navigate(`/classroom/${classroom.id}${isAdmin ? '/admin' : ''}`)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to delete "${classroom.name}"?`)) {
      onDelete(classroom.id)
    }
  }

  return (
    <article
      className={`classroom-card card animate-fade-in-up delay-${(index % 6) + 1} ${isPending ? 'pending' : ''}`}
      onClick={handleClick}
    >
      <div className="card-header">
        <div className={`card-icon ${isPending ? 'icon-pending' : isAdmin ? 'icon-admin' : 'icon-student'}`}>
          {isPending ? <Hourglass size={20} /> : isAdmin ? <ShieldCheck size={20} /> : <BookOpenIcon size={20} />}
        </div>
        <div className="card-title-group">
          <h3>{classroom.name}</h3>
          <p>{classroom.description || 'No description provided.'}</p>
        </div>
      </div>

      <div className="card-body">
        <div className="card-stats">
          <div className="stat-item" title="Students">
            <Users size={14} />
            <span>{classroom.student_count || 0}</span>
          </div>
          <div className="stat-item" title="Lessons">
            <FileText size={14} />
            <span>{classroom.total_lessons || 0}</span>
          </div>
          {isPending && (
            <div className="stat-item status-badge">
              <Clock size={14} />
              <span>Pending Approval</span>
            </div>
          )}
        </div>

        {!isPending && (classroom.total_lessons || 0) > 0 && (
          <div className="card-progress">
            <div className="progress-info">
              <span>{classroom.progress || 0}% Complete</span>
              <span>{classroom.completed_lessons || 0}/{classroom.total_lessons}</span>
            </div>
            <ProgressBar progress={classroom.progress || 0} size="xs" />
          </div>
        )}
      </div>

      <div className="card-footer">
        {isAdmin && onDelete && (
          <button className="btn-icon btn-delete" onClick={handleDelete} title="Delete Classroom">
            <Trash2 size={16} />
          </button>
        )}
        {!isPending && (
          <div className="card-action">
            <span>{isAdmin ? 'Manage' : 'Continue'}</span>
            <ChevronRight size={16} />
          </div>
        )}
      </div>
    </article>
  )
}

function BookOpenIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
