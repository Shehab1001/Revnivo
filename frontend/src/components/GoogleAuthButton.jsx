import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const googleButtonRef = useRef(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    if (!clientId) return undefined

    const initializeGoogle = () => {
      if (!window.google) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async ({ credential }) => {
          setError('')
          setLoading(true)
          try {
            await loginWithGoogle(credential)
            navigate('/')
          } catch (err) {
            setError(err.response?.data?.detail || 'Google sign-in failed.')
          } finally {
            setLoading(false)
          }
        },
      })
      if (googleButtonRef.current) {
        googleButtonRef.current.replaceChildren()
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 400,
          logo_alignment: 'left',
        })
      }
    }

    if (window.google) {
      initializeGoogle()
      return undefined
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initializeGoogle
    document.head.appendChild(script)
    return () => { script.onload = null }
  }, [clientId, loginWithGoogle, navigate])

  return <div className="mt-5">
    {clientId ? <div ref={googleButtonRef} className="flex min-h-10 justify-center overflow-hidden" aria-label="Continue with Google" /> : <Button type="button" variant="bordered" radius="lg" size="lg" fullWidth isDisabled>Continue with Google</Button>}
    {loading && <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Signing in with Google...</p>}
    {!clientId && <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Google sign-in is unavailable until <code>VITE_GOOGLE_CLIENT_ID</code> is configured.</p>}
    {error && <p className="mt-2 text-center text-sm text-rose-600 dark:text-rose-300">{error}</p>}
  </div>
}
// v1.1 branch