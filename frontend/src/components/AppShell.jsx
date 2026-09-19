import { BarChart3, CircleDollarSign, FileText, LogOut, Menu, Moon, PanelsTopLeft, Settings as SettingsIcon, Sun, WalletCards, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: BarChart3 },
  { to: '/platforms', label: 'Platforms', icon: PanelsTopLeft },
  { to: '/earnings', label: 'Earnings', icon: WalletCards },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const Sidebar = () => (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-[#fffdf5] p-4 dark:border-[#45484d] dark:bg-[#333538]">
      <div className="mb-8 flex items-center gap-3 px-2 py-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#23C55E] text-white"><CircleDollarSign size={22}/></div>
        <div><div className="font-extrabold tracking-tight text-slate-900 dark:text-white">IncomeFlow</div><div className="text-xs text-slate-500">Earnings dashboard</div></div>
      </div>
      <nav className="space-y-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#e8f8ed] text-[#16843d] dark:bg-[#23462e] dark:text-[#7bea9d]' : 'text-slate-600 hover:bg-[#fffbea] dark:text-slate-300 dark:hover:bg-[#3b3e42]'}`}>
            <Icon size={18}/>{label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="mb-3 px-2">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</div>
          <div className="truncate text-xs text-slate-500">{user?.email}</div>
        </div>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"><LogOut size={18}/>Logout</button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-[#fffdf5] text-slate-900 dark:bg-[#292b2e] dark:text-slate-100">
      <div className="fixed inset-y-0 left-0 hidden lg:block"><Sidebar/></div>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMobileOpen(false)}><div className="h-full" onClick={(e) => e.stopPropagation()}><Sidebar/></div></div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-[#fffdf5]/90 px-4 backdrop-blur md:px-6 dark:border-[#45484d] dark:bg-[#333538]/90">
          <button className="rounded-xl p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-900" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleTheme} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-[#fffbea] dark:border-[#555960] dark:bg-[#333538] dark:text-slate-200 dark:hover:bg-[#3b3e42]" title="Toggle theme">
              {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>} 
            </button>
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8"><Outlet/></main>
      </div>
    </div>
  )
}
