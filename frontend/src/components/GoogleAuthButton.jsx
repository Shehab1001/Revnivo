import { Button, Spinner } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const GOOGLE_SCRIPT_ID = 'google-identity-services'
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.703-1.568 2.684-3.878 2.684-6.614Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.91-2.258c-.805.54-1.835.859-3.046.859-2.344 0-4.328-1.585-5.037-3.714H.957v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.42 5.42 0 0 1 3.682 9c0-.592.102-1.167.28-1.706V4.962H.958A9 9 0 0 0 0 9c0 1.45.347 2.824.957 4.038l3.006-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.322 0 2.508.455 3.442 1.346l2.582-2.582C13.464.892 11.427 0 9 0A9 9 0 0 0 .957 4.962l3.006 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
      />
    </svg>
  )
}

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()

  const googleButtonRef = useRef(null)
  const resizeObserverRef = useRef(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    if (!clientId) return undefined

    let cancelled = false

    const handleCredential = async ({ credential }) => {
      if (!credential) {
        setError('Google did not return a valid credential.')
        return
      }

      setError('')
      setLoading(true)

      try {
        await loginWithGoogle(credential)
        navigate('/dashboard')
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            'Google sign-in failed. Please try again.'
        )
      } finally {
        setLoading(false)
      }
    }

    const renderGoogleButton = () => {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !googleButtonRef.current
      ) {
        return
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: handleCredential,
      })

      const containerWidth = googleButtonRef.current.clientWidth || 400
      const buttonWidth = Math.max(220, Math.min(400, containerWidth))

      googleButtonRef.current.replaceChildren()

      window.google.accounts.id.renderButton(
        googleButtonRef.current,
        {
          type: 'standard',
          theme: theme === 'dark' ? 'outline_dark' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: buttonWidth,
          logo_alignment: 'left',
        }
      )

      setGoogleReady(true)
    }

    const setupResizeObserver = () => {
      if (!googleButtonRef.current || !window.ResizeObserver) return

      resizeObserverRef.current?.disconnect()

      let lastWidth = 0

      resizeObserverRef.current = new ResizeObserver((entries) => {
        const width = Math.round(entries[0]?.contentRect?.width || 0)

        if (width && Math.abs(width - lastWidth) > 8) {
          lastWidth = width
          renderGoogleButton()
        }
      })

      resizeObserverRef.current.observe(googleButtonRef.current)
    }

    const initialize = () => {
      if (cancelled) return

      renderGoogleButton()
      setupResizeObserver()
    }

    if (window.google?.accounts?.id) {
      initialize()
    } else {
      let script = document.getElementById(GOOGLE_SCRIPT_ID)

      if (!script) {
        script = document.createElement('script')
        script.id = GOOGLE_SCRIPT_ID
        script.src = GOOGLE_SCRIPT_SRC
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }

      script.addEventListener('load', initialize)

      return () => {
        cancelled = true
        script?.removeEventListener('load', initialize)
        resizeObserverRef.current?.disconnect()
      }
    }

    return () => {
      cancelled = true
      resizeObserverRef.current?.disconnect()
    }
  }, [clientId, loginWithGoogle, navigate, theme])

  return (
    <div className="w-full">
      {clientId ? (
        <div className="relative w-full">
          <div
            className="
              relative
              flex
              min-h-11
              w-full
              items-center
              justify-center
              overflow-hidden
              rounded-full
              transition-all
              duration-200
              [&>div]:!w-full
              [&_iframe]:!w-full
            "
          >
            <div
              ref={googleButtonRef}
              className={`
                flex
                min-h-11
                w-full
                items-center
                justify-center
                transition-opacity
                duration-200
                ${loading ? 'pointer-events-none opacity-40' : 'opacity-100'}
              `}
              aria-label="Continue with Google"
            />

            {!googleReady && !loading && (
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-0
                  flex
                  items-center
                  justify-center
                  gap-3
                  rounded-full
                  border
                  border-default-200
                  bg-background/70
                  px-4
                  text-sm
                  font-semibold
                  text-foreground
                  backdrop-blur
                  dark:border-white/10
                  dark:bg-background/40
                "
              >
                <GoogleIcon />
                Continue with Google
              </div>
            )}

            {loading && (
              <div
                className="
                  absolute
                  inset-0
                  flex
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-default-200
                  bg-content1/90
                  text-sm
                  font-semibold
                  text-foreground
                  backdrop-blur-md
                  dark:border-white/10
                  dark:bg-content1/90
                "
              >
                <Spinner size="sm" color="primary" />
                Signing in...
              </div>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="bordered"
          radius="full"
          size="lg"
          fullWidth
          isDisabled
          startContent={<GoogleIcon />}
          className="
            h-11
            border-default-200
            bg-background/60
            font-semibold
            text-foreground
            dark:border-white/10
            dark:bg-background/30
          "
        >
          Continue with Google
        </Button>
      )}

      {!clientId && (
        <p className="mt-2 text-center text-[11px] leading-4 text-default-400">
          Google sign-in is unavailable until{' '}
          <code className="rounded bg-default-100 px-1 py-0.5 text-default-600">
            VITE_GOOGLE_CLIENT_ID
          </code>{' '}
          is configured.
        </p>
      )}

      {error && (
        <p className="mt-2 text-center text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
