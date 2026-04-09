import { useState, useEffect } from 'react'
import { getMe } from '../api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('learnlog_token'))
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('learnlog_token')))

  useEffect(() => {
    if (!token) return

    let cancelled = false
    getMe()
      .then((userData) => {
        if (!cancelled) setUser(userData)
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem('learnlog_token')
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token])

  function login(userData, newToken) {
    localStorage.setItem('learnlog_token', newToken)
    setToken(newToken)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('learnlog_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}
