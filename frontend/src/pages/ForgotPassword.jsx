import { Button, Card, CardBody, Input } from '@heroui/react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'

const FORGOT_PASSWORD_ENDPOINT = '/auth/forgot-password/'

function maskEmail(email) {
  const [name, domain] = email.split('@')

  if (!name || !domain) return email

  const visible =
    name.length <= 2
      ? name.slice(0, 1)
      : name.slice(0, 2)

  return `${visible}${'*'.repeat(
    Math.max(2, name.length - visible.length)
  )}@${domain}`
}

export default function ForgotPassword() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [resetComplete, setResetComplete] = useState(false)

  const submit = async (event) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) return

    setError('')
    setLoading(true)

    try {
      await api.post(FORGOT_PASSWORD_ENDPOINT, {
        email: normalizedEmail,
      })

      setEmail(normalizedEmail)
      setSent(true)
    } catch (err) {
      const data = err.response?.data

      setError(
        data?.detail ||
          Object.values(data || {})
            .flat()
            .join(' ') ||
          'Could not send the verification code. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setError('')
    setLoading(true)

    try {
      await api.post(FORGOT_PASSWORD_ENDPOINT, {
        email,
      })
    } catch (err) {
      const data = err.response?.data

      setError(
        data?.detail ||
          Object.values(data || {})
            .flat()
            .join(' ') ||
          'Could not resend the verification code.'
      )
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/reset-password/', { email, code, password })
      setResetComplete(true)
    } catch (err) {
      const data = err.response?.data
      setError(data?.detail || 'Could not reset your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Soft glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-28 h-[30rem] w-[30rem] rounded-full bg-secondary/10 blur-3xl" />
      </div>

      {/* Small engineering grid across the full page */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          opacity-100
          [background-image:linear-gradient(to_right,rgba(15,23,42,0.070)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.070)_1px,transparent_1px)]
          [background-size:24px_24px]
          dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.055)_1px,transparent_1px)]
        "
      />

      {/* Major guide lines every five grid cells */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          opacity-70
          [background-image:linear-gradient(to_right,rgba(15,23,42,0.065)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.065)_1px,transparent_1px)]
          [background-size:120px_120px]
          dark:opacity-60
          dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)]
        "
      />

      {/* Readability fade without hiding the grid */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_center,transparent_0%,transparent_38%,hsl(var(--heroui-background)/0.28)_78%,hsl(var(--heroui-background)/0.56)_100%)]
        "
      />

      <div className="relative z-10 min-h-screen p-4 sm:p-6">
        {/* Top bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-default-500 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to sign in
          </Link>

          <Button
            isIconOnly
            variant="flat"
            radius="lg"
            onPress={toggleTheme}
            aria-label="Toggle theme"
            className="border border-default-200/70 bg-content1/70 text-foreground shadow-sm backdrop-blur-md"
          >
            {theme === 'dark' ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </Button>
        </div>

        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl place-items-center py-8">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <img
                src="/logo.svg"
                alt="Revnivo"
                className="brand-logo h-14 w-auto max-w-64 object-contain"
              />
            </div>

            <Card
              radius="lg"
              className="
                w-full
                overflow-hidden
                border
                border-default-200/70
                bg-content1/82
                text-foreground
                shadow-[0_24px_80px_rgba(15,23,42,0.10)]
                backdrop-blur-xl
                dark:border-white/8
                dark:bg-content1/85
                dark:shadow-[0_24px_80px_rgba(0,0,0,0.30)]
              "
            >
              <CardBody className="p-6 sm:p-8">
                {!sent ? (
                  <>
                    <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <KeyRound size={22} />
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                      Forgot password?
                    </h1>

                    <p className="mt-2 max-w-sm text-[13px] leading-5 text-default-500">
                      Enter the email address linked to your account and we'll send you a one-time verification code.
                    </p>

                    {error && (
                      <div className="mt-5 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
                        {error}
                      </div>
                    )}

                    <form
                      onSubmit={submit}
                      className="mt-7 space-y-4"
                    >
                      <Input
                        label="Email"
                        type="email"
                        isRequired
                        variant="bordered"
                        radius="lg"
                        size="lg"
                        autoComplete="email"
                        value={email}
                        onValueChange={setEmail}
                        startContent={
                          <Mail
                            size={17}
                            className="text-default-400"
                          />
                        }
                        classNames={{
                          inputWrapper:
                            'border-default-200 bg-background/60 transition-colors hover:border-default-300 group-data-[focus=true]:border-primary dark:bg-background/30',
                          label: 'text-default-500',
                        }}
                      />

                      <Button
                        color="primary"
                        type="submit"
                        radius="lg"
                        size="lg"
                        fullWidth
                        isLoading={loading}
                        endContent={
                          !loading ? (
                            <ArrowRight size={17} />
                          ) : null
                        }
                        className="font-semibold shadow-[0_10px_30px_rgba(0,111,238,0.24)]"
                      >
                        {loading
                          ? 'Sending code...'
                          : 'Send verification code'}
                      </Button>
                    </form>

                    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-default-200/70 bg-default-100/50 p-4">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                        <ShieldCheck size={15} />
                      </div>

                      <p className="text-[11px] leading-5 text-default-500">
                        For your security, the code should expire after a short period and can only be used to reset your password.
                      </p>
                    </div>
                  </>
                ) : resetComplete ? (
                  <>
                    <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success">
                      <CheckCircle2 size={23} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Password updated</h1>
                    <p className="mt-2 text-[13px] leading-5 text-default-500">Your password has been reset. You can now sign in with your new password.</p>
                    <Button color="primary" radius="lg" size="lg" fullWidth className="mt-7 font-semibold" onPress={() => navigate('/login')}>Back to sign in</Button>
                  </>
                ) : (
                  <>
                    <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success">
                      <CheckCircle2 size={23} />
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                      Check your email
                    </h1>

                    <p className="mt-2 text-[13px] leading-5 text-default-500">
                      We sent a verification code to{' '}
                      <span className="font-semibold text-foreground">
                        {maskEmail(email)}
                      </span>
                      .
                    </p>

                    <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Mail size={17} />
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            Verification code sent
                          </div>

                          <p className="mt-1 text-xs leading-5 text-default-500">
                            Enter the OTP from your email on the next screen to continue resetting your password.
                          </p>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-5 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
                        {error}
                      </div>
                    )}

                    <form onSubmit={resetPassword} className="mt-7 space-y-4">
                      <Input
                        label="Verification code"
                        placeholder="000000"
                        isRequired
                        inputMode="numeric"
                        maxLength={6}
                        value={code}
                        onValueChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                        classNames={{ input: 'text-center text-xl font-semibold tracking-[0.45em]', inputWrapper: 'border-default-200 bg-background/60 dark:bg-background/30' }}
                      />
                      <Input
                        label="New password"
                        type="password"
                        isRequired
                        minLength={10}
                        autoComplete="new-password"
                        value={password}
                        onValueChange={setPassword}
                        classNames={{ inputWrapper: 'border-default-200 bg-background/60 dark:bg-background/30' }}
                      />
                      <Button color="primary" type="submit" radius="lg" size="lg" fullWidth isLoading={loading} className="font-semibold shadow-[0_10px_30px_rgba(0,111,238,0.24)]">
                        {loading ? 'Resetting password...' : 'Reset password'}
                      </Button>
                    </form>

                    <div className="mt-3 space-y-3">

                      <Button
                        variant="flat"
                        radius="lg"
                        size="lg"
                        fullWidth
                        isLoading={loading}
                        onPress={resend}
                        className="font-semibold"
                      >
                        {loading
                          ? 'Resending...'
                          : 'Resend code'}
                      </Button>

                      <Button
                        variant="light"
                        radius="lg"
                        fullWidth
                        onPress={() => {
                          setSent(false)
                          setError('')
                          setCode('')
                          setPassword('')
                        }}
                        className="text-default-500"
                      >
                        Use a different email
                      </Button>
                    </div>
                  </>
                )}
              </CardBody>
            </Card>

            <p className="mt-5 text-center text-xs text-default-400">
              Secure password recovery for your Revnivo account
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
