import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    if (!clientId) return undefined

    const initializeGoogle = () => {
      if (!window.google) return
      window.google.accounts.id.initialize({
        client_id: clientId,
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

  const signIn = () => {
    if (!window.google || !clientId) return
    setError('')
    window.google.accounts.id.prompt()
  }

  return <div className="mt-5">
    <Button ref={buttonRef} type="button" variant="bordered" radius="lg" size="lg" fullWidth isDisabled={!clientId} isLoading={loading} onPress={signIn} className="border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-white/25 dark:hover:bg-white/10" startContent={!loading && <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-sm font-black shadow-sm"><span className="bg-[conic-gradient(#4285f4_0_25%,#34a853_25%_50%,#fbbc05_50%_75%,#ea4335_75%)] bg-clip-text text-transparent text-lg">G</span></span>}>Continue with Google</Button>
    {!clientId && <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Google sign-in is unavailable until <code>VITE_GOOGLE_CLIENT_ID</code> is configured.</p>}
    {error && <p className="mt-2 text-center text-sm text-rose-600 dark:text-rose-300">{error}</p>}
  </div>
}
// v1.1 branch