import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/useAuth'
import { ThemeProvider } from './context/ThemeContext'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminWorkspace from './pages/AdminWorkspace'
import StudentWorkspace from './pages/StudentWorkspace'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 size={28} className="spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

function App() {
  const { isAuthenticated } = useAuth()

  const protectedRoutes = (
    <Routes>
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/classroom/:id/admin" element={<ProtectedRoute><AdminWorkspace /></ProtectedRoute>} />
      <Route path="/classroom/:id" element={<ProtectedRoute><StudentWorkspace /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <div className="app-shell">
                <Navbar />
                <div className="app-shell-content">{protectedRoutes}</div>
              </div>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </ThemeProvider>
  )
}

export default App
