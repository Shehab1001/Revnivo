import { Bell, BarChart3, CircleDollarSign, ChevronDown, ChevronLeft, ChevronRight, DollarSign, FileText, LogOut, Menu, MessageCircle, Moon, PanelsTopLeft, Settings as SettingsIcon, Sun, Users, WalletCards } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'

const baseNav = [
  { to: '/platforms', label: 'Platforms', icon: PanelsTopLeft },
  { to: '/earnings', label: 'Earnings', icon: WalletCards },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/support-chat', label: 'Chat', icon: MessageCircle },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [noticeOpen, setNoticeOpen] = useState(false)
  const noticeRef = useRef(null)

  useEffect(() => {
    const loadNotifications = () => api.get('/notifications/').then(({ data }) => setNotifications(data)).catch(() => {})
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const closeNotifications = (event) => { if (noticeRef.current && !noticeRef.current.contains(event.target)) setNoticeOpen(false) }
    document.addEventListener('mousedown', closeNotifications)
    return () => document.removeEventListener('mousedown', closeNotifications)
  }, [])

  const linkClass = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-[#e8f8ed] text-[#16843d] dark:bg-[#23462e] dark:text-[#7bea9d]' : 'text-slate-600 hover:bg-[#fffbea] dark:text-slate-300 dark:hover:bg-[#3b3e42]'}`
  const unread = notifications.filter((notification) => !notification.read).length
  const markRead = async (notification) => { await api.patch('/notifications/', { id: notification.id }).catch(() => {}); setNotifications(notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item)) }

  const Sidebar = () => (
    <aside className={`${collapsed ? 'w-19' : 'w-64'} flex h-full flex-col border-r border-slate-200 bg-[#fffdf5] p-4 transition-all dark:border-[#45484d] dark:bg-[#333538]`}>
      <div className={`mb-8 flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-2'} py-2`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#23C55E] text-white"><CircleDollarSign size={22}/></div>
        {!collapsed && <div><div className="font-extrabold tracking-tight text-slate-900 dark:text-white">Revnivo</div><div className="text-xs text-slate-500">Income workspace</div></div>}
      </div>
      <nav className="space-y-1">
        {user?.role === 'admin' ? <div>
          <button onClick={() => { setDashboardOpen(!dashboardOpen); if (collapsed) setCollapsed(false) }} className={`${linkClass({ isActive: false })} w-full ${collapsed ? 'justify-center' : ''}`} title="Dashboard"><BarChart3 size={18}/>{!collapsed && <><span className="flex-1 text-left">Dashboard</span><ChevronDown size={16} className={dashboardOpen ? '' : '-rotate-90'}/></>}</button>
          {dashboardOpen && <div className={collapsed ? 'mt-1 flex flex-col items-center gap-1' : 'ml-5 border-l border-slate-200 pl-3 dark:border-[#555960]'}><NavLink to="/" end className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center p-2' : ''}`} title="Income"><DollarSign size={18}/>{!collapsed && 'Income'}</NavLink><NavLink to="/admin/users" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center p-2' : ''}`} title="Users"><Users size={18}/>{!collapsed && 'Users'}</NavLink></div>}
        </div> : <NavLink to="/" end className={linkClass}><BarChart3 size={18}/>{!collapsed && 'Dashboard'}</NavLink>}
        {baseNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center' : ''}`} title={label}><Icon size={18}/>{!collapsed && label}</NavLink>)}
        {user?.role === 'admin' && <NavLink to="/admin/subscriptions" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center' : ''}`} title="Subscriptions"><WalletCards size={18}/>{!collapsed && 'Subscriptions'}</NavLink>}
      </nav>
      <div className="mt-auto border-t border-slate-200 pt-4 dark:border-[#45484d]">
        {!collapsed && <div className="mb-3 flex items-center gap-2 px-2"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8f8ed] font-bold text-[#16843d]">{user?.profile_image_url ? <img src={user.profile_image_url} alt="Profile" className="h-full w-full object-cover"/> : user?.name?.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{user?.name}</div><div className="truncate text-xs text-slate-500">{user?.email}</div></div></div>}
        <button onClick={logout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#3b3e42] ${collapsed ? 'justify-center' : ''}`} title="Logout"><LogOut size={18}/>{!collapsed && 'Logout'}</button>
      </div>
    </aside>
  )

  return <div className="min-h-screen bg-[#fffdf5] text-slate-900 dark:bg-[#292b2e] dark:text-slate-100">
    <div className={`fixed inset-y-0 left-0 z-40 hidden lg:block ${collapsed ? 'w-19' : 'w-64'}`}><Sidebar/></div>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}><div className="h-full w-64" onClick={(event) => event.stopPropagation()}><Sidebar/></div></div>}
    <div className={`${collapsed ? 'lg:pl-19' : 'lg:pl-64'} transition-all`}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-[#fffdf5]/90 px-4 backdrop-blur md:px-6 dark:border-[#45484d] dark:bg-[#333538]/90">
        <div className="flex items-center gap-2"><button className="rounded-xl p-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><button className="hidden rounded-xl p-2 lg:block" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">{collapsed ? <ChevronRight size={20}/> : <ChevronLeft size={20}/>}</button></div>
        <div className="relative ml-auto flex items-center gap-2"><button onClick={() => setNoticeOpen(!noticeOpen)} className="relative rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#555960] dark:bg-[#333538]" title="Notifications"><Bell size={18}/>{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[10px] text-white">{unread}</span>}</button><button onClick={toggleTheme} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#555960] dark:bg-[#333538]" title="Toggle theme">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>{noticeOpen && <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#555960] dark:bg-[#333538]"><div className="px-3 py-2 font-bold">Notifications</div>{notifications.length ? notifications.slice(0, 6).map((notification) => <button key={notification.id} onClick={() => markRead(notification)} className="block w-full rounded-lg p-3 text-left hover:bg-slate-50"><div className="text-sm font-semibold">{notification.title}</div><div className="text-xs text-slate-500">{notification.message}</div></button>) : <div className="p-3 text-sm text-slate-500">No notifications.</div>}</div>}</div>
      </header>
      <main className="p-4 md:p-6 lg:p-8"><Outlet/></main>
    </div>
  </div>
}
