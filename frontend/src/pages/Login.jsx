import { Moon, Sun } from 'lucide-react'
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
    <div className="min-h-screen bg-[#fffdf5] p-4 dark:bg-[#292b2e]">
      <div className="mx-auto flex max-w-6xl justify-end"><button onClick={toggleTheme} className="btn-secondary p-2.5">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-16">
        <div className="hidden lg:block">
          <div className="mb-6 flex items-center gap-3"><img src="/logo.svg" alt="Revnivo" className="h-12 w-auto max-w-56 object-contain" /></div>
          <h1 className="max-w-lg text-5xl font-black leading-tight tracking-tight text-slate-950 dark:text-white">See every platform, every payment, every year.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-500 dark:text-slate-400">A clean private dashboard for tracking freelance and platform income without mixing currencies.</p>
        </div>
        <div className="card w-full max-w-md p-7 md:p-8">
          <div className="mb-7 lg:hidden"><img src="/logo.svg" alt="Revnivo" className="h-9 w-auto max-w-44 object-contain" /></div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your income dashboard.</p>
          {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})}/></div>
            <div><label className="label">Password</label><input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})}/></div>
            <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/><span>OR</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/></div>
          <GoogleAuthButton />
          <p className="mt-6 text-center text-sm text-slate-500">New here? <Link to="/register" className="font-semibold text-[#16843d] hover:text-[#23C55E]">Create an account</Link></p>
        </div>
      </div>
    </div>
  )
}
