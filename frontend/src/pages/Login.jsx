import { Button, Card, CardBody, Input } from '@heroui/react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react'
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
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-300 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      {/* Soft background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute -bottom-40 -right-28 h-[26rem] w-[26rem] rounded-full bg-secondary/10 blur-3xl sm:h-[30rem] sm:w-[30rem]" />
      </div>

      {/* Full-page engineering grid */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          [background-image:linear-gradient(to_right,rgba(15,23,42,0.070)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.070)_1px,transparent_1px)]
          [background-size:24px_24px]
          dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.055)_1px,transparent_1px)]
        "
      />

      {/* Major guide lines */}
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

      {/* Readability fade */}
      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_55%_48%,transparent_0%,transparent_38%,hsl(var(--heroui-background)/0.24)_78%,hsl(var(--heroui-background)/0.52)_100%)]
        "
      />

      <div className="relative z-10 flex min-h-screen flex-col p-4 sm:p-5 lg:h-screen lg:min-h-0 lg:p-5">
        {/* Top bar */}
        <div className="mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between">
          <div className="lg:hidden">
            <img
              src="/logo.svg"
              alt="Revnivo"
              className="brand-logo h-9 w-auto max-w-44 object-contain"
            />
          </div>

          <div className="ml-auto">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              radius="lg"
              onPress={toggleTheme}
              aria-label="Toggle theme"
              className="h-9 w-9 min-w-9 border border-default-200/70 bg-content1/70 text-foreground shadow-sm backdrop-blur-md"
            >
              {theme === 'dark' ? (
                <Sun size={16} />
              ) : (
                <Moon size={16} />
              )}
            </Button>
          </div>
        </div>

        {/* Main content fills only the available viewport height */}
        <div
          className="
            mx-auto
            grid
            w-full
            max-w-7xl
            flex-1
            min-h-0
            place-items-center
            gap-8
            py-4
            lg:grid-cols-[1.08fr_0.92fr]
            lg:gap-14
            lg:py-2
            xl:gap-20
          "
        >
          {/* Left marketing side */}
          <div className="hidden max-w-xl self-center lg:block">
            <img
              src="/logo.svg"
              alt="Revnivo"
              className="brand-logo mb-4 h-16 w-auto max-w-64 object-contain xl:h-20"
            />

            <h1 className="mt-4 max-w-xl text-4xl font-extralight leading-[1.04] tracking-tight text-foreground xl:text-[44px]">
              Your income has a clearer place to grow.
            </h1>

            <p className="mt-4 max-w-md text-[13px] leading-5 text-default-500 xl:text-sm xl:leading-6">
              Track every platform, payment, and currency in one calm workspace built for your real progress.
            </p>

            <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-default-200/70 bg-content1/60 p-3.5 backdrop-blur-md">
                <div className="mb-2.5 grid h-8 w-8 place-items-center rounded-xl bg-success/10 text-success">
                  <ShieldCheck size={16} />
                </div>

                <div className="text-[13px] font-semibold text-foreground">
                  Private by account
                </div>

                <p className="mt-1 text-[10px] leading-4 text-default-500">
                  Your workspace and income records stay tied to your account.
                </p>
              </div>

              <div className="rounded-2xl border border-default-200/70 bg-content1/60 p-3.5 backdrop-blur-md">
                <div className="mb-2.5 grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ArrowRight size={16} />
                </div>

                <div className="text-[13px] font-semibold text-foreground">
                  Built for momentum
                </div>

                <p className="mt-1 text-[10px] leading-4 text-default-500">
                  See your income clearly and keep moving without spreadsheet clutter.
                </p>
              </div>
            </div>
          </div>

          {/* Login card */}
          <div className="w-full max-w-[400px] self-center">
            <Card
              radius="lg"
              className="
                w-full
                overflow-hidden
                border
                border-black/16
                bg-content1/80
                text-foreground
                shadow-[0_20px_60px_rgba(15,23,42,0.09)]
                backdrop-blur-xl
                dark:border-white/8
                dark:bg-content1/85
                dark:shadow-[0_20px_60px_rgba(0,0,0,0.28)]
              "
            >
              <CardBody className="p-8 sm:p-6">
                <div className="mb-5 lg:hidden">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
                    <Sparkles size={13} />
                    Welcome back
                  </div>
                </div>

                <div className="mb-5">
                  <h2 className="text-[26px] font-bold tracking-tight text-foreground">
                    Welcome back
                  </h2>

                  <p className="mt-1.5 text-xs leading-5 text-default-500">
                    Sign in to continue to your income dashboard.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
                    {error}
                  </div>
                )}

                <form onSubmit={submit} className="space-y-3">
                  <Input
                    label="Email"
                    placeholder="john@example.com"
                    type="email"
                    isRequired
                    labelPlacement="outside"
                    variant="flat"
                    radius="lg"
                    size="md"
                    autoComplete="email"
                    value={form.email}
                    onValueChange={(email) =>
                      setForm({
                        ...form,
                        email,
                      })
                    }
                    classNames={{
                      base: 'gap-1.5',
                      label:
                        'text-[13px] font-semibold text-foreground',
                      inputWrapper:
                        'h-10 min-h-10 mb-4 border border-transparent bg-default-100 px-3.5 shadow-none transition-all duration-200 data-[hover=true]:bg-default-200 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:bg-default-100 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/10 dark:bg-[#1b1b1f] dark:data-[hover=true]:bg-[#222226] dark:group-data-[focus=true]:bg-[#1b1b1f]',
                      input:
                        'text-sm text-foreground placeholder:text-default-400',
                    }}
                  />

                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    type={showPassword ? 'text' : 'password'}
                    isRequired
                    labelPlacement="outside"
                    variant="flat"
                    radius="lg"
                    size="md"
                    autoComplete="current-password"
                    value={form.password}
                    onValueChange={(password) =>
                      setForm({
                        ...form,
                        password,
                      })
                    }
                    classNames={{
                      base: 'gap-1.5',
                      label:
                        'text-[13px] font-semibold text-foreground',
                      inputWrapper:
                        'h-10 min-h-10 border border-transparent bg-default-100 px-3.5 shadow-none transition-all duration-200 data-[hover=true]:bg-default-200 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:bg-default-100 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/10 dark:bg-[#1b1b1f] dark:data-[hover=true]:bg-[#222226] dark:group-data-[focus=true]:bg-[#1b1b1f]',
                      input:
                        'text-sm text-foreground placeholder:text-default-400',
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
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    }
                  />

                  <div className="-mt-0.5 flex items-center justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    color="primary"
                    type="submit"
                    radius="lg"
                    size="md"
                    fullWidth
                    isLoading={loading}
                    endContent={
                      !loading ? <ArrowRight size={15} /> : null
                    }
                    className="h-10 min-h-10 text-sm font-semibold shadow-[0_8px_24px_rgba(0,111,238,0.20)]"
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </form>

                <div className="my-4 flex items-center gap-3 text-[10px] text-default-400">
                  <span className="h-px flex-1 bg-divider" />
                  <span>OR</span>
                  <span className="h-px flex-1 bg-divider" />
                </div>

                <div
                  className="
                    w-full
                    [&_button]:h-10
                    [&_button]:min-h-10
                    [&_button]:w-full
                    [&_button]:justify-center
                    [&_button]:rounded-xl
                    [&_button]:border
                    [&_button]:border-default-200
                    [&_button]:bg-background/60
                    [&_button]:px-3
                    [&_button]:text-xs
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
                    [&_[role=button]]:h-10
                    [&_[role=button]]:min-h-10
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

                <p className="mt-5 text-center text-xs text-default-500">
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

            <p className="mt-3 text-center text-[10px] text-default-400">
              Secure access to your Revnivo workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
