import { CircleDollarSign, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function Register() {
  const { register } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await register(form.name, form.email, form.password); navigate('/') }
    catch (err) {
      const data = err.response?.data
      setError(data?.detail || Object.values(data || {}).flat().join(' ') || 'Registration failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#fffdf5] p-4 dark:bg-[#292b2e]">
      <div className="mx-auto flex max-w-6xl justify-end"><button onClick={toggleTheme} className="btn-secondary p-2.5">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></div>
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl place-items-center lg:grid-cols-2 lg:gap-16">
        <div className="hidden lg:block">
          <div className="mb-6 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#23C55E] text-white"><CircleDollarSign/></div><span className="text-2xl font-black text-slate-900 dark:text-white">Revnivo</span></div>
          <h1 className="max-w-lg text-5xl font-black leading-tight tracking-tight text-slate-950 dark:text-white">Turn scattered payments into a clear income history.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-500 dark:text-slate-400">Add platforms, upload their logos, record earnings, and watch your progress across months and years.</p>
        </div>
        <div className="card w-full max-w-md p-7 md:p-8">
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Your data is separated by account.</p>
          {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div><label className="label">Name</label><input className="input" required value={form.name} onChange={(e) => setForm({...form, name:e.target.value})}/></div>
            <div><label className="label">Email</label><input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})}/></div>
            <div><label className="label">Password</label><input className="input" type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})}/><p className="mt-1 text-xs text-slate-400">Minimum 8 characters.</p></div>
            <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/><span>OR</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700"/></div>
          <GoogleAuthButton />
          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-[#16843d] hover:text-[#23C55E]">Sign in</Link></p>
        </div>
      </div>
    </div>
  )
}
