import { Button, Card, CardBody, Input } from '@heroui/react'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.email, form.password); navigate('/') }
    catch (err) {
      const data = err.response?.data
      setError(data?.detail || Object.values(data || {}).flat().join(' ') || 'Login failed. Please check your details.')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-background p-4 text-foreground sm:p-6">
      <div className="mx-auto flex max-w-7xl justify-end"><Button isIconOnly variant="flat" radius="lg" onPress={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</Button></div>
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl place-items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="hidden max-w-xl lg:block">
          <img src="/logo.svg" alt="Revnivo" className="brand-logo mb-10 h-12 w-auto max-w-56 object-contain" />
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-primary">Income, made visible</p>
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-slate-950 dark:text-white xl:text-6xl">Your income has a clearer place to grow.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-500 dark:text-slate-400">Track every platform, payment, and currency in one calm workspace built for your real progress.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400"><span className="h-2 w-2 rounded-full bg-[#23C55E]"/> Private by account <span className="text-slate-300 dark:text-slate-700">/</span> Built for momentum</div>
        </div>
        <Card className="w-full max-w-md border-default-200 bg-content1/90 shadow-[0_24px_80px_rgb(15_23_42/0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-[#15161a]/95 dark:shadow-black/30" radius="lg">
          <CardBody className="p-6 sm:p-8">
            <div className="mb-8 lg:hidden"><img src="/logo.svg" alt="Revnivo" className="brand-logo h-9 w-auto max-w-44 object-contain" /></div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in to continue to your income dashboard.</p>
            {error && <div className="mt-5 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">{error}</div>}
            <form onSubmit={submit} className="mt-7 space-y-4">
              <Input label="Email" type="email" isRequired variant="bordered" radius="lg" autoComplete="email" value={form.email} onValueChange={(email) => setForm({ ...form, email })} />
              <Input label="Password" type={showPassword ? 'text' : 'password'} isRequired variant="bordered" radius="lg" autoComplete="current-password" value={form.password} onValueChange={(password) => setForm({ ...form, password })} endContent={<button type="button" className="text-slate-400 hover:text-slate-700 dark:hover:text-white" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>} />
              <Button color="primary" type="submit" radius="lg" size="lg" fullWidth isLoading={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            </form>
            <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/><span>OR</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/></div>
            <GoogleAuthButton />
            <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">New here? <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link></p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
