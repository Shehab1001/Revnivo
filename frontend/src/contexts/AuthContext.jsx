import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  const saveUser = (data) => {
    setUser(data.user)
    return data
  }

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', {
      email,
      password,
    })
    return saveUser(data)
  }

  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/auth/google/', {
      credential,
    })
    return saveUser(data)
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register/', {
      name,
      email,
      password,
    })
    return saveUser(data)
  }

  const updateProfile = async (form) => {
    const { data } = await api.patch(
      '/auth/profile/',
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    setUser(data)
    return data
  }

  const logout = async () => {
    await api
      .post('/chat-presence/', { offline: true })
      .catch(() => {})

    await api.post('/auth/logout/').catch(() => {})

    // Remove legacy credentials left by older Revnivo versions.
    localStorage.removeItem('revnivo_token')
    localStorage.removeItem('revnivo_user')
    localStorage.removeItem('incomeflow_token')
    localStorage.removeItem('incomeflow_user')

    setUser(null)
  }

  useEffect(() => {
    // Remove old bearer tokens from localStorage. New sessions live only in
    // HttpOnly cookies that JavaScript cannot read.
    localStorage.removeItem('revnivo_token')
    localStorage.removeItem('incomeflow_token')
    localStorage.removeItem('revnivo_user')
    localStorage.removeItem('incomeflow_user')

    api
      .get('/auth/me/')
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setSessionChecked(true))
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      loginWithGoogle,
      register,
      updateProfile,
      logout,
      isAuthenticated: !!user,
      sessionChecked,
    }),
    [user, sessionChecked]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
