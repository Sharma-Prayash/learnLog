import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Copy, Check, Users, FileText, Share2, UserCheck, UserX, Megaphone, HelpCircle, RotateCcw } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import FolderUpload from '../components/FolderUpload'
import FolderTree from '../components/FolderTree'
import AnnouncementsPanel from '../components/AnnouncementsPanel'
import DoubtsPanel from '../components/DoubtsPanel'
import { getClassroom, getNodes, getClassroomStudents, getClassroomPending, approveRequest, rejectRequest, updateProgress, deleteNode, renameNode, uploadFolder, resetStudentProgress } from '../api'
import './AdminWorkspace.css'

export default function AdminWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState(null)
  const [nodes, setNodes] = useState([])
  const [students, setStudents] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('content')
  const [copied, setCopied] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [classroomData, nodesData, studentsData, pendingData] = await Promise.all([
        getClassroom(id),
        getNodes(id),
        getClassroomStudents(id),
        getClassroomPending(id),
      ])

      if (!classroomData.is_owner) {
        navigate(`/classroom/${id}`)
        return
      }

      setClassroom(classroomData)
      setNodes(nodesData)
      setStudents(studentsData)
      setPending(pendingData)
    } catch (err) {
      console.error('Failed to load admin workspace:', err)
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggle(nodeId, completed) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, completed } : n)))
    try {
      await updateProgress(nodeId, completed)
    } catch {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, completed: !completed } : n)))
    }
  }

  async function handleDeleteNode(nodeId) {
    try {
      await deleteNode(nodeId)
      await loadData()
    } catch (err) {
      console.error('Failed to delete node:', err)
    }
  }

  async function handleRenameNode(nodeId, name) {
    try {
      await renameNode(nodeId, name)
      await loadData()
    } catch (err) {
      console.error('Failed to rename node:', err)
    }
  }

  async function handleUploadToFolder(classroomId, files, paths, parentId) {
    try {
      await uploadFolder(classroomId, files, paths, parentId)
      await loadData()
    } catch (err) {
      console.error('Failed to upload to folder:', err)
    }
  }

  async function handleApprove(membershipId) {
    try {
      await approveRequest(membershipId)
      await loadData()
    } catch (err) {
      console.error('Failed to approve:', err)
    }
  }

  async function handleReject(membershipId) {
    try {
      await rejectRequest(membershipId)
      await loadData()
    } catch (err) {
      console.error('Failed to reject:', err)
    }
  }

  async function handleResetProgress(userId, username) {
    if (!window.confirm(`Are you sure you want to reset all progress for ${username}? This cannot be undone.`)) return
    try {
      await resetStudentProgress(id, userId)
      await loadData()
    } catch (err) {
      console.error('Failed to reset progress:', err)
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(classroom.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <main className="page"><div className="container">
        <div className="dashboard-loading"><Loader2 size={32} className="spin" /><p>Loading workspace...</p></div>
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

  return (
    <main className="page" id="admin-workspace">
      <div className="container">
        {/* Header */}
        <div className="admin-header animate-fade-in-up">
          <h1>{classroom.name}</h1>
          {classroom.description && <p className="admin-desc">{classroom.description}</p>}
          <div className="admin-stats">
            <span className="meta-chip"><Users size={14} /> {classroom.student_count} students</span>
            <span className="meta-chip"><FileText size={14} /> {classroom.total_lessons} lessons</span>
            {classroom.pending_count > 0 && (
              <span className="meta-chip meta-chip-accent">{classroom.pending_count} pending</span>
            )}
          </div>
          {(classroom.total_lessons || 0) > 0 && (
            <div className="admin-my-progress">
              <span className="admin-progress-label">Your Progress</span>
              <ProgressBar progress={classroom.progress || 0} size="sm" />
              <span className="admin-progress-pct">{classroom.completed_lessons || 0}/{classroom.total_lessons}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="admin-tabs animate-fade-in-up delay-1">
          <button className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
            <FileText size={15} /> Content
          </button>
          <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
            <Users size={15} /> Students
            {students.length > 0 && <span className="tab-count">{students.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'invite' ? 'active' : ''}`} onClick={() => setActiveTab('invite')}>
            <Share2 size={15} /> Invite
            {pending.length > 0 && <span className="tab-count tab-count-accent">{pending.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>
            <Megaphone size={15} /> Announcements
          </button>
          <button className={`tab-btn ${activeTab === 'doubts' ? 'active' : ''}`} onClick={() => setActiveTab('doubts')}>
            <HelpCircle size={15} /> Doubts
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content animate-fade-in">
          {activeTab === 'content' && (
            <div className="content-tab">
              <section className="detail-section">
                <h2 className="section-title">Upload Content</h2>
                <FolderUpload classroomId={id} onUploadComplete={loadData} />
              </section>
              <section className="detail-section">
                <h2 className="section-title">Course Tree</h2>
                <div className="tree-container card">
                  <FolderTree
                    nodes={nodes}
                    onToggleLesson={handleToggle}
                    isAdmin={true}
                    onDeleteNode={handleDeleteNode}
                    onRenameNode={handleRenameNode}
                    onUploadToFolder={handleUploadToFolder}
                    classroomId={id}
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="students-tab">
              <h2 className="section-title">Gradebook</h2>
              {students.length === 0 ? (
                <div className="empty-state"><p>No students enrolled yet.</p></div>
              ) : (
                <div className="gradebook card">
                  <table className="gradebook-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Progress</th>
                        <th>Completed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td className="student-name">{s.username}</td>
                          <td className="student-email">{s.email}</td>
                          <td className="student-progress"><ProgressBar progress={s.progress} size="sm" showLabel={false} /></td>
                          <td className="student-pct">{s.progress}%</td>
                          <td>
                            <button 
                              className="btn btn-icon btn-danger-soft" 
                              onClick={() => handleResetProgress(s.id, s.username)}
                              title="Reset Progress"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invite' && (
            <div className="invite-tab">
              {/* Invite Code */}
              <div className="invite-code-section card">
                <h3>Invite Code</h3>
                <p className="invite-desc">Share this code with students to let them join your classroom.</p>
                <div className="invite-code-display">
                  <span className="invite-code">{classroom.invite_code}</span>
                  <button className="btn btn-secondary btn-sm" onClick={copyInviteCode}>
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Pending Requests */}
              <div className="pending-section">
                <h3 className="section-title">Pending Requests</h3>
                {pending.length === 0 ? (
                  <p className="no-pending">No pending requests.</p>
                ) : (
                  <div className="pending-list">
                    {pending.map((p) => (
                      <div key={p.membership_id} className="pending-card card">
                        <div className="pending-info">
                          <span className="pending-name">{p.username}</span>
                          <span className="pending-email">{p.email}</span>
                        </div>
                        <div className="pending-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(p.membership_id)}>
                            <UserCheck size={14} /> Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleReject(p.membership_id)}>
                            <UserX size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'announcements' && (
            <div className="announcements-tab">
              <AnnouncementsPanel classroomId={id} isAdmin={true} />
            </div>
          )}
          {activeTab === 'doubts' && (
            <div className="doubts-tab">
              <DoubtsPanel classroomId={id} isAdmin={true} />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
