import { Button, Card, CardBody, Input } from '@heroui/react'
import { ArrowRight, Eye, EyeOff, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import GoogleAuthButton from '../components/GoogleAuthButton'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      const data = err.response?.data

      setError(
        data?.detail ||
          Object.values(data || {}).flat().join(' ') ||
          'Login failed. Please check your details.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Soft background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl dark:bg-primary/10" />
        <div className="absolute -bottom-40 -right-28 h-[30rem] w-[30rem] rounded-full bg-secondary/10 blur-3xl dark:bg-secondary/10" />
      </div>

      {/* Full-page engineering grid — small squares + stronger guide lines */}
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

      {/* Major engineering guide lines every 5 cells */}
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

      {/* Keep content readable without hiding the grid */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_55%_48%,transparent_0%,transparent_38%,hsl(var(--heroui-background)/0.28)_78%,hsl(var(--heroui-background)/0.56)_100%)]
        "
      />

      <div className="relative z-10 p-4 sm:p-6">
        {/* Top bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="lg:hidden">
            <img
              src="/logo.svg"
              alt="Revnivo"
              className="brand-logo h-11 w-auto max-w-52 object-contain"
            />
          </div>

          <div className="ml-auto">
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
        </div>

        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl place-items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          {/* Left marketing side */}
          <div className="hidden max-w-xl lg:block">
            <img
              src="/logo.svg"
              alt="Revnivo"
              className="brand-logo mb-10 h-16 w-auto max-w-72 object-contain"
            />

            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur">
              <Sparkles size={14} />
              Income, made visible
            </div>

            <h1 className="mt-6 max-w-xl text-5xl font-black leading-[1.04] tracking-tight text-foreground xl:text-6xl">
              Your income has a clearer place to grow.
            </h1>

            <p className="mt-5 max-w-md text-sm leading-6 text-default-500 sm:text-[15px]">
              Track every platform, payment, and currency in one calm workspace built for your real progress.
            </p>

            <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-default-200/70 bg-content1/60 p-4 backdrop-blur-md">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-success/10 text-success">
                  <ShieldCheck size={17} />
                </div>

                <div className="text-sm font-semibold text-foreground">
                  Private by account
                </div>

                <p className="mt-1 text-[11px] leading-4 text-default-500">
                  Your workspace and income records stay tied to your account.
                </p>
              </div>

              <div className="rounded-2xl border border-default-200/70 bg-content1/60 p-4 backdrop-blur-md">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ArrowRight size={17} />
                </div>

                <div className="text-sm font-semibold text-foreground">
                  Built for momentum
                </div>

                <p className="mt-1 text-[11px] leading-4 text-default-500">
                  See your income clearly and keep moving without spreadsheet clutter.
                </p>
              </div>
            </div>
          </div>

          {/* Login card */}
          <div className="w-full max-w-md">
            <Card
              radius="lg"
              className="
                w-full
                overflow-hidden
                border
                border-default-200/70
                bg-content1/80
                text-foreground
                shadow-[0_24px_80px_rgba(15,23,42,0.10)]
                backdrop-blur-xl
                dark:border-white/8
                dark:bg-content1/85
                dark:shadow-[0_24px_80px_rgba(0,0,0,0.30)]
              "
            >
              <CardBody className="p-6 sm:p-8">
                <div className="mb-8 lg:hidden">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
                    <Sparkles size={14} />
                    Welcome back
                  </div>
                </div>

                <div className="mb-7">
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">
                    Welcome back
                  </h2>

                  <p className="mt-2 text-[13px] leading-5 text-default-500">
                    Sign in to continue to your income dashboard.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    isRequired
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    autoComplete="email"
                    value={form.email}
                    onValueChange={(email) =>
                      setForm({
                        ...form,
                        email,
                      })
                    }
                    classNames={{
                      inputWrapper:
                        'border-default-200 bg-background/60 transition-colors hover:border-default-300 group-data-[focus=true]:border-primary dark:bg-background/30',
                      label: 'text-default-500',
                    }}
                  />

                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    isRequired
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    autoComplete="current-password"
                    value={form.password}
                    onValueChange={(password) =>
                      setForm({
                        ...form,
                        password,
                      })
                    }
                    classNames={{
                      inputWrapper:
                        'border-default-200 bg-background/60 transition-colors hover:border-default-300 group-data-[focus=true]:border-primary dark:bg-background/30',
                      label: 'text-default-500',
                    }}
                    endContent={
                      <button
                        type="button"
                        className="text-default-400 transition-colors hover:text-foreground"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        aria-label={
                          showPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    }
                  />

                  <div className="flex items-center justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    color="primary"
                    type="submit"
                    radius="lg"
                    size="lg"
                    fullWidth
                    isLoading={loading}
                    endContent={!loading ? <ArrowRight size={17} /> : null}
                    className="font-semibold shadow-[0_10px_30px_rgba(0,111,238,0.24)]"
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </form>

                <div className="my-6 flex items-center gap-3 text-xs text-default-400">
                  <span className="h-px flex-1 bg-divider" />
                  <span>OR</span>
                  <span className="h-px flex-1 bg-divider" />
                </div>

                <div
                  className="
                    w-full
                    [&_button]:h-12
                    [&_button]:w-full
                    [&_button]:justify-center
                    [&_button]:rounded-xl
                    [&_button]:border
                    [&_button]:border-default-200
                    [&_button]:bg-background/60
                    [&_button]:px-4
                    [&_button]:text-sm
                    [&_button]:font-semibold
                    [&_button]:text-foreground
                    [&_button]:shadow-none
                    [&_button]:transition-all
                    [&_button]:duration-200
                    hover:[&_button]:border-default-300
                    hover:[&_button]:bg-default-100
                    active:[&_button]:scale-[0.995]
                    dark:[&_button]:border-white/10
                    dark:[&_button]:bg-background/30
                    dark:hover:[&_button]:bg-default-100
                    [&_[role=button]]:h-12
                    [&_[role=button]]:w-full
                    [&_[role=button]]:rounded-xl
                    [&_[role=button]]:border
                    [&_[role=button]]:border-default-200
                    [&_[role=button]]:bg-background/60
                    [&_[role=button]]:text-foreground
                    dark:[&_[role=button]]:border-white/10
                    dark:[&_[role=button]]:bg-background/30
                    [&_iframe]:w-full
                  "
                >
                  <GoogleAuthButton />
                </div>

                <p className="mt-7 text-center text-sm text-default-500">
                  New here?{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-primary hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </CardBody>
            </Card>

            <p className="mt-5 text-center text-xs text-default-400">
              Secure access to your Revnivo workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
