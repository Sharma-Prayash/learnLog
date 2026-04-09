import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, Mail, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { loginUser } from '../api'
import './Auth.css'

export default function Login() {
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
      const { user, token } = await loginUser(email, password)
      login(user, token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-split-card animate-scale-in">
        <div className="auth-left">
          <div className="auth-left-content">
            <h1>Welcome Back</h1>
            <p className="auth-subtitle">Continue your learning journey.</p>
            
            <div className="auth-tabs">
              <div className="auth-tab active">Login</div>
              <Link to="/register" className="auth-tab">Signup</Link>
            </div>

            <div className="auth-form-container">
              <div className="auth-form-glow"></div>
              <form onSubmit={handleSubmit} className="auth-form">
                {error && <div className="auth-error">{error}</div>}

                <div className="form-group">
                  <label htmlFor="login-email">Email</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="login-password">Password</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading} id="login-submit">
                  {loading ? <Loader2 size={16} className="spin" /> : <Lock size={16} />}
                  {loading ? 'Logging in...' : 'Log In'}
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
