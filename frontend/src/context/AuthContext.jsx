import { createContext, useContext, useEffect, useState } from 'react'
import {
  apiGetMe,
  apiSignIn,
  apiSignUp,
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
} from '../lib/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setStoredUser(null)
      setLoading(false)
      return
    }

    apiGetMe()
      .then((userData) => {
        setUser(userData)
        setStoredUser(userData)
      })
      .catch(() => {
        setUser(null)
        setStoredToken(null)
        setStoredUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const login = async (email, password) => {
    const res = await apiSignIn(email, password)
    if (res.access_token) {
      setStoredToken(res.access_token)
      setUser(res.user)
      setStoredUser(res.user)
    }
    return res
  }

  const signup = async (email, password) => {
    const res = await apiSignUp(email, password)
    if (res.access_token) {
      setStoredToken(res.access_token)
      setUser(res.user)
      setStoredUser(res.user)
    }
    return res
  }

  const logout = () => {
    setStoredToken(null)
    setStoredUser(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)