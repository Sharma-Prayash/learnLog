import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, KeyRound, Loader2, Clock3, Flame, Rocket } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import ClassroomCard from '../components/ClassroomCard'
import CreateClassroomModal from '../components/CreateClassroomModal'
import JoinClassroomModal from '../components/JoinClassroomModal'
import { getClassrooms, createClassroom, deleteClassroom, joinClassroom } from '../api'
import './Dashboard.css'

const QUOTES = [
  "The grind doesn't stop. Neither do you.",
  'Discipline is choosing between what you want now and what you want most.',
  'Every lesson completed is a brick in your empire.',
  "Hard work beats talent when talent doesn't work hard.",
  'Success is built one lesson at a time.',
]

export default function Dashboard() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [teaching, setTeaching] = useState([])
  const [learning, setLearning] = useState([])
  const [pendingClassrooms, setPendingClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const view = searchParams.get('view') || 'all'
  const quote = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length]

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const data = await getClassrooms()
      setTeaching(data.teaching || [])
      setLearning(data.learning || [])
      setPendingClassrooms(data.pending || [])
    } catch (err) {
      console.error('Failed to load classrooms:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(name, description) {
    await createClassroom(name, description)
    await loadData()
  }

  async function handleJoin(code) {
    const result = await joinClassroom(code)
    await loadData()
    return result
  }

  async function handleDelete(id) {
    try {
      await deleteClassroom(id)
      setTeaching((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  if (loading) {
    return (
      <main className="page" id="dashboard-page">
        <div className="container">
          <div className="dashboard-loading">
            <Loader2 size={32} className="spin" />
            <p>Loading your world...</p>
          </div>
        </div>
      </main>
    )
  }

  const isEmpty = teaching.length === 0 && learning.length === 0 && pendingClassrooms.length === 0
  const showDashboardHeader = view === 'all'
  const showTeaching = view === 'all' || view === 'teaching'
  const showLearning = view === 'all' || view === 'learning'
  
  const recentWatches = [...learning]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4)

  return (
    <main className="page" id="dashboard-page">
      <div className="container">
        {showDashboardHeader && (
          <div className="dashboard-header animate-fade-in-up">
            <div className="dashboard-header-text">
              <h1 className="dashboard-title">
                <Flame size={30} className="title-flame" />
                Welcome back, {user?.username || 'User'}
              </h1>
              <p className="dashboard-quote">"{quote}"</p>
            </div>

            <div className="dashboard-actions">
              <button className="btn btn-primary" onClick={() => setCreateOpen(true)} id="create-classroom-btn">
                <Plus size={16} /> Create
              </button>
              <button className="btn btn-secondary" onClick={() => setJoinOpen(true)} id="join-classroom-btn">
                <KeyRound size={16} /> Join
              </button>
            </div>
          </div>
        )}

        {showDashboardHeader && recentWatches.length > 0 && (
          <section className="dashboard-section recent-watch-section animate-fade-in-up delay-1">
            <h2 className="section-heading">Recent Watches</h2>
            <div className="recent-watch-row">
              {recentWatches.map((item) => (
                <article key={item.id} className="recent-watch-card card">
                  <div className="recent-watch-top">
                    <h3>{item.name}</h3>
                    <span>{item.progress || 0}%</span>
                  </div>
                  <div className="recent-watch-track">
                    <span style={{ width: `${item.progress || 0}%` }} />
                  </div>
                  <p><Clock3 size={12} /> {item.completed_lessons || 0}/{item.total_lessons || 0} lessons</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {isEmpty ? (
          <div className="empty-state animate-fade-in-up delay-2">
            <div className="empty-hero">
              <div className="empty-icon-ring"><Rocket size={36} /></div>
              <h2>Your learning journey starts here</h2>
              <p>Create a classroom to teach, or join one to learn.</p>
            </div>
            <div className="getting-started">
              <div className="getting-started-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Create a Classroom</h4>
                  <p>Set up your first course.</p>
                </div>
              </div>
              <div className="getting-started-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Upload Content</h4>
                  <p>Add folders of lessons.</p>
                </div>
              </div>
            </div>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> Create Classroom
              </button>
              <button className="btn btn-secondary" onClick={() => setJoinOpen(true)}>
                <KeyRound size={16} /> Join Classroom
              </button>
            </div>
          </div>
        ) : (
          <>
            {showTeaching && teaching.length > 0 && (
              <section className="dashboard-section animate-fade-in-up delay-1" id="teaching-section">
                <h2 className="section-heading">Teaching</h2>
                <div className="classroom-grid">
                  {teaching.map((c, i) => (
                    <ClassroomCard key={c.id} classroom={c} variant="teaching" onDelete={handleDelete} index={i} />
                  ))}
                </div>
              </section>
            )}

            {showLearning && pendingClassrooms.length > 0 && (
              <section className="dashboard-section animate-fade-in-up delay-2" id="pending-section">
                <h2 className="section-heading">Pending Approval</h2>
                <div className="classroom-grid">
                  {pendingClassrooms.map((c, i) => (
                    <ClassroomCard key={c.id} classroom={c} variant="pending" index={i} />
                  ))}
                </div>
              </section>
            )}

            {showLearning && learning.length > 0 && (
              <section className="dashboard-section animate-fade-in-up delay-3" id="learning-section">
                <h2 className="section-heading">Learning</h2>
                <div className="classroom-grid">
                  {learning.map((c, i) => (
                    <ClassroomCard key={c.id} classroom={c} variant="learning" index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <CreateClassroomModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
        <JoinClassroomModal isOpen={joinOpen} onClose={() => setJoinOpen(false)} onSubmit={handleJoin} />
      </div>
    </main>
  )
}
