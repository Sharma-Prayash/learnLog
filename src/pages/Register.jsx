import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, Mail, Lock, User, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { registerUser } from '../api'
import './Auth.css'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { user, token } = await registerUser(username, email, password)
      login(user, token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-split-card animate-scale-in">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1>Join the Grind</h1>
            <p className="auth-subtitle">Create your account and start building.</p>

            <div className="auth-tabs">
              <Link to="/login" className="auth-tab">Login</Link>
              <div className="auth-tab active">Signup</div>
            </div>

            <div className="auth-form-container">
              <div className="auth-form-glow"></div>
              <form onSubmit={handleSubmit} className="auth-form">
                {error && <div className="auth-error">{error}</div>}

                <div className="form-group">
                  <label htmlFor="register-username">Username</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      id="register-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your_username"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="register-email">Email</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      id="register-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="register-password">Password</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      id="register-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading} id="register-submit">
                  {loading ? <Loader2 size={16} className="spin" /> : <Flame size={16} />}
                  {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
                </button>
              </form>
            </div>
          </div>
        </div>
        
        <div className="auth-right">
          <div className="auth-right-content">
            <div className="brand-logo-container">
              <Flame size={32} />
            </div>
            <h2>LearnLog</h2>
            <p>Track classroom progress, organize lessons, and keep learning focused.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
