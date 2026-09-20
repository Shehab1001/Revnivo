import { createContext, useContext, useMemo, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('revnivo_user') || localStorage.getItem('incomeflow_user')) } catch { return null }
  })

  const saveSession = (data) => {
    localStorage.setItem('revnivo_token', data.token)
    localStorage.setItem('revnivo_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    saveSession(data)
    return data
  }

  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/auth/google/', { credential })
    saveSession(data)
    return data
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register/', { name, email, password })
    saveSession(data)
    return data
  }

  const updateProfile = async (form) => {
    const { data } = await api.patch('/auth/profile/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    localStorage.setItem('revnivo_user', JSON.stringify(data))
    setUser(data)
    return data
  }

  const logout = () => {
    localStorage.removeItem('revnivo_token')
    localStorage.removeItem('revnivo_user')
    localStorage.removeItem('incomeflow_token')
    localStorage.removeItem('incomeflow_user')
    setUser(null)
  }

  const value = useMemo(() => ({ user, login, loginWithGoogle, register, updateProfile, logout, isAuthenticated: !!user }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
