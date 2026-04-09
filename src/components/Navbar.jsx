import { Link, useLocation } from 'react-router-dom'
import { Flame, LogOut, User, LayoutGrid, BookOpen, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
import './Navbar.css'

export default function Navbar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  
  const isDashboard = location.pathname === '/'
  const currentView = new URLSearchParams(location.search).get('view') || 'all'
  const isAdminPage = location.pathname.includes('/admin')

  return (
    <>
      <nav className="navbar" id="main-navbar">
        <div className="navbar-inner container">
          <div className="navbar-left">
            <Link to="/" className="navbar-brand" id="navbar-logo">
              <div className="navbar-logo-icon">
                <Flame size={18} strokeWidth={2.3} />
              </div>
              <div className="navbar-brand-text">
                <span className="navbar-logo-text">LearnLog</span>
              </div>
            </Link>
          </div>

          <div className="navbar-right">
            <button className="btn btn-ghost btn-icon theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="navbar-profile">
              <span className="navbar-profile-dot">
                <User size={14} />
              </span>
              <span className="navbar-signedin">Signed in as {user?.username || 'user'}</span>
            </div>
          </div>
        </div>
      </nav>

      <aside className="app-rail" id="app-nav-rail">
        <Link to="/?view=all" className={`app-rail-link ${isDashboard && currentView === 'all' ? 'active' : ''}`} title="Dashboard">
          <LayoutGrid size={18} />
          <span>Home</span>
        </Link>
        <Link to="/?view=teaching" className={`app-rail-link ${isDashboard && currentView === 'teaching' ? 'active' : isAdminPage ? 'active' : ''}`} title="Teaching">
          <BookOpen size={18} />
          <span>Teaching</span>
        </Link>
        <Link to="/?view=learning" className={`app-rail-link ${isDashboard && currentView === 'learning' ? 'active' : !isAdminPage && !isDashboard ? 'active' : ''}`} title="Learning">
          <BookOpen size={18} />
          <span>Learning</span>
        </Link>
        <div className="app-rail-spacer" />
        <button className="app-rail-signout" onClick={logout} id="navbar-logout-btn" title="Sign out">
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </aside>
    </>
  )
}
