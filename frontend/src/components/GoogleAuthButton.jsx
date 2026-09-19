import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef(null)
  const [error, setError] = useState('')
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    if (!clientId) return undefined

    const renderButton = () => {
      if (!window.google || !buttonRef.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setError('')
          try {
            await loginWithGoogle(credential)
            navigate('/')
          } catch (err) {
            setError(err.response?.data?.detail || 'Google sign-in failed.')
          }
        },
      })
      buttonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
        size: 'large',
        width: 360,
      })
    }

    if (window.google) {
      renderButton()
      return undefined
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderButton
    document.head.appendChild(script)
    return () => { script.onload = null }
  }, [clientId, loginWithGoogle, navigate])

  return <div className="mt-5">
    {clientId ? <div ref={buttonRef} className="flex min-h-10 justify-center"/> : <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500 dark:border-slate-700">Google sign-in is unavailable until <code>VITE_GOOGLE_CLIENT_ID</code> is configured.</div>}
    {error && <p className="mt-2 text-center text-sm text-rose-600 dark:text-rose-300">{error}</p>}
  </div>
}
