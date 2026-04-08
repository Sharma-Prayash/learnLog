import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Calendar, FileText, FolderOpen, Flame, Trophy } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import FolderUpload from '../components/FolderUpload'
import FolderTree from '../components/FolderTree'
import { getCourse, getNodes, updateNode } from '../api'
import './CourseDetail.css'

export default function CourseDetail() {
  const { id } = useParams()
  const [course, setCourse] = useState(null)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [courseData, nodesData] = await Promise.all([
        getCourse(id),
        getNodes(id),
      ])
      setCourse(courseData)
      setNodes(nodesData)
    } catch (err) {
      console.error('Failed to load course data:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleToggleLesson(nodeId, completed) {
    // Optimistic update
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, completed } : n))
    )

    try {
      await updateNode(nodeId, completed)
      const updatedCourse = await getCourse(id)
      setCourse(updatedCourse)
    } catch (err) {
      console.error('Failed to update node:', err)
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, completed: !completed } : n))
      )
    }
  }

  function handleUploadComplete() {
    loadData()
  }

  if (loading) {
    return (
      <main className="page" id="course-detail-page">
        <div className="container">
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <p>Loading your course...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!course) {
    return (
      <main className="page" id="course-detail-page">
        <div className="container">
          <div className="empty-state">
            <h2>Course not found</h2>
            <p>The course you're looking for doesn't exist or was deleted.</p>
          </div>
        </div>
      </main>
    )
  }

  const formattedDate = new Date(course.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const progress = course.progress || 0
  const isComplete = progress === 100 && (course.total_lessons || 0) > 0

  function getProgressMessage() {
    if (isComplete) return "Course completed successfully."
    if (progress >= 75) return "Almost there. Just a few more lessons."
    if (progress >= 50) return "You have completed half the course."
    if (progress >= 25) return "Good progress. Keep going."
    if (progress > 0) return "Course started."
    return "Ready to begin?"
  }

  return (
    <main className="page" id="course-detail-page">
      <div className="container">
        {/* Course Header */}
        <div className="course-detail-header animate-fade-in-up">
          <div className="detail-title-row">
            {isComplete ? (
              <Trophy size={28} className="detail-title-icon icon-complete" />
            ) : (
              <Flame size={28} className="detail-title-icon" />
            )}
            <h1>{course.title}</h1>
          </div>

          <p className="detail-motivation">{getProgressMessage()}</p>

          <div className="course-detail-meta">
            <span className="meta-chip">
              <Calendar size={14} />
              {formattedDate}
            </span>
            <span className="meta-chip">
              <FileText size={14} />
              {course.total_lessons || 0} lessons
            </span>
            <span className="meta-chip meta-chip-accent">
              <FolderOpen size={14} />
              {course.completed_lessons || 0} completed
            </span>
          </div>

          <div className="course-detail-progress">
            <ProgressBar progress={progress} size="lg" />
          </div>
        </div>

        {/* Content area */}
        <div className="course-detail-content">
          {/* Upload section */}
          <section className="detail-section animate-fade-in-up delay-2" id="upload-section">
            <h2 className="section-title">Upload Course Content</h2>
            <p className="section-desc">
              Select a folder from your computer. The folder structure will be preserved.
            </p>
            <FolderUpload courseId={id} onUploadComplete={handleUploadComplete} />
          </section>

          {/* Tree section */}
          <section className="detail-section animate-fade-in-up delay-3" id="tree-section">
            <h2 className="section-title">Course Content</h2>
            <p className="section-desc">
              Click any lesson to open it — progress is tracked automatically.
            </p>
            <div className="tree-container card">
              <FolderTree nodes={nodes} onToggleLesson={handleToggleLesson} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
