import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Flame, Trophy, Calendar, FileText, FolderOpen } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import FolderTree from '../components/FolderTree'
import ContentViewer from '../components/ContentViewer'
import AnnouncementsPanel from '../components/AnnouncementsPanel'
import DoubtsPanel from '../components/DoubtsPanel'
import { getClassroom, getNodes, updateProgress } from '../api'
import './StudentWorkspace.css'

export default function StudentWorkspace() {
  const { id } = useParams()
  const [classroom, setClassroom] = useState(null)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [milestone, setMilestone] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const [classroomData, nodesData] = await Promise.all([
        getClassroom(id),
        getNodes(id),
      ])
      setClassroom(classroomData)
      setNodes(nodesData)
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggle(nodeId, completed) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, completed } : n)))
    // Update selected node too
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, completed } : prev)

    try {
      await updateProgress(nodeId, completed)
      const updatedClassroom = await getClassroom(id)
      setClassroom(updatedClassroom)

      // Check for milestones
      if (completed) {
        const progress = updatedClassroom.progress
        const milestones = [25, 50, 75, 100]
        const hit = milestones.find((m) => progress >= m)
        if (hit && hit > (classroom?.progress || 0)) {
          showMilestone(hit)
        }
      }
    } catch {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, completed: !completed } : n)))
      setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, completed: !completed } : prev)
    }
  }

  function handlePreview(node) {
    setSelectedNode(node)
  }

  function handleAutoComplete(nodeId) {
    handleToggle(nodeId, true)
  }

  function showMilestone(pct) {
    const messages = {
      25: "25% completed — Good progress!",
      50: "50% completed — You're halfway there.",
      75: "75% completed — Almost finished.",
      100: "100% completed — Course finished!",
    }
    setMilestone(messages[pct] || null)
    setTimeout(() => setMilestone(null), 4000)
  }

  if (loading) {
    return (
      <main className="page"><div className="container">
        <div className="dashboard-loading"><Loader2 size={32} className="spin" /><p>Loading content...</p></div>
      </div></main>
    )
  }

  if (!classroom) {
    return (
      <main className="page"><div className="container">
        <div className="empty-state"><h2>Classroom not found</h2></div>
      </div></main>
    )
  }

  const progress = classroom.progress || 0
  const isComplete = progress === 100 && (classroom.total_lessons || 0) > 0

  const formattedDate = new Date(classroom.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  function getProgressMessage() {
    if (isComplete) return "Course completed successfully."
    if (progress >= 75) return "Almost there. Just a few more lessons."
    if (progress >= 50) return "You have completed half the course."
    if (progress >= 25) return "Good progress. Keep going."
    if (progress > 0) return "Course started."
    return "Ready to begin?"
  }

  return (
    <main className="page" id="student-workspace">
      <div className="container">
        {/* Milestone notification */}
        {milestone && (
          <div className="milestone-notification animate-scale-in" key={milestone}>
            {milestone}
          </div>
        )}

        {/* Header */}
        <div className="student-header animate-fade-in-up">
          <div className="student-title-row">
            {isComplete ? (
              <Trophy size={26} className="student-icon icon-complete" />
            ) : (
              <Flame size={26} className="student-icon" />
            )}
            <h1>{classroom.name}</h1>
          </div>

          {classroom.description && <p className="student-desc">{classroom.description}</p>}
          <p className="student-motivation">{getProgressMessage()}</p>

          <div className="student-meta">
            <span className="meta-chip"><Calendar size={14} /> {formattedDate}</span>
            <span className="meta-chip"><FileText size={14} /> {classroom.total_lessons || 0} lessons</span>
            <span className="meta-chip meta-chip-accent">
              <FolderOpen size={14} /> {classroom.completed_lessons || 0} completed
            </span>
          </div>

          <div className="student-progress-bar">
            <ProgressBar progress={progress} size="lg" />
          </div>
        </div>

        {/* Activity */}
        <section className="student-activity animate-fade-in-up delay-1">
          <div className="activity-grid">
            <AnnouncementsPanel classroomId={id} />
            <DoubtsPanel classroomId={id} />
          </div>
        </section>

        {/* Content — Split Layout */}
        <section className="student-content animate-fade-in-up delay-2">
          <div className={`student-workspace-grid ${selectedNode ? 'has-viewer' : ''}`}>
            {/* Sidebar — Folder Tree */}
            <div className="student-sidebar">
              <h2 className="section-title">Course Content</h2>
              <p className="section-desc">Click any lesson to preview it — progress is tracked automatically.</p>
              <div className="tree-container card">
                <FolderTree nodes={nodes} onToggleLesson={handleToggle} onPreview={handlePreview} />
              </div>
            </div>

            {/* Main — Content Viewer */}
            {selectedNode && (
              <div className="student-viewer animate-fade-in">
                <ContentViewer
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  onAutoComplete={handleAutoComplete}
                  classroomId={id}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
