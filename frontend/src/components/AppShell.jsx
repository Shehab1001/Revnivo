import { Bell, BarChart3, ChevronDown, ChevronLeft, ChevronRight, DollarSign, FileText, LogOut, Menu, MessageCircle, Moon, PanelLeft, PanelsTopLeft, Settings as SettingsIcon, Sun, Users, WalletCards } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'

const baseNav = [
  { to: '/platforms', label: 'Platforms', icon: PanelsTopLeft },
  { to: '/earnings', label: 'Earnings', icon: WalletCards },
  { to: '/notes', label: 'Notes', icon: FileText },
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
  const [profileOpen, setProfileOpen] = useState(false)
  const noticeRef = useRef(null)
  const profileRef = useRef(null)
  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'dev.shehabsaid@gmail.com'

  useEffect(() => {
    const loadNotifications = () => api.get('/notifications/').then(({ data }) => setNotifications(data)).catch(() => { })
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const sortTable = (event) => {
      const header = event.target.closest('th')
      const table = header?.closest('table')
      if (!header || !table || header.cellIndex === table.querySelectorAll('thead th').length - 1) return
      const tbody = table.tBodies[0]
      if (!tbody) return
      const direction = header.dataset.sortDirection === 'desc' ? 'asc' : 'desc'
      table.querySelectorAll('thead th').forEach((cell) => { delete cell.dataset.sortDirection })
      header.dataset.sortDirection = direction
      const rows = [...tbody.rows]
      rows.sort((left, right) => {
        const a = left.cells[header.cellIndex]?.textContent.trim() || ''
        const b = right.cells[header.cellIndex]?.textContent.trim() || ''
        const aNumber = Number(a.replace(/[^0-9.-]/g, ''))
        const bNumber = Number(b.replace(/[^0-9.-]/g, ''))
        const numeric = a !== '' && b !== '' && Number.isFinite(aNumber) && Number.isFinite(bNumber)
        const result = numeric ? aNumber - bNumber : a.localeCompare(b, undefined, { sensitivity: 'base' })
        return direction === 'asc' ? result : -result
      })
      rows.forEach((row) => tbody.appendChild(row))
    }
    document.addEventListener('click', sortTable)
    return () => document.removeEventListener('click', sortTable)
  }, [])

  useEffect(() => {
    const heartbeat = () => api.get('/chat-presence/').catch(() => { })
    heartbeat()
    const timer = window.setInterval(heartbeat, 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const closeNotifications = (event) => {
      if (noticeRef.current && !noticeRef.current.contains(event.target)) {
        setNoticeOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', closeNotifications)
    return () => document.removeEventListener('mousedown', closeNotifications)
  }, [notifications])

  useEffect(() => {
    const markChatReadLocally = (event) => {
      const chatUserId = String(event.detail?.chatUserId || '')
      if (!chatUserId) return
      setNotifications((items) => items.map((item) => String(item.chat_user_id || '') === chatUserId ? { ...item, read: true } : item))
    }
    window.addEventListener('chat-read', markChatReadLocally)
    return () => window.removeEventListener('chat-read', markChatReadLocally)
  }, [])

  useEffect(() => {
    const sortTable = (event) => {
      const header = event.target.closest('th')
      const table = header?.closest('table')
      if (!header || !table || header.cellIndex === table.tHead.rows[0].cells.length - 1) return
      const body = table.tBodies[0]
      if (!body) return
      const direction = header.dataset.sortDirection === 'desc' ? 'asc' : 'desc'
      table.querySelectorAll('thead th').forEach((cell) => delete cell.dataset.sortDirection)
      header.dataset.sortDirection = direction
      const rows = [...body.rows]
      rows.sort((a, b) => {
        const left = a.cells[header.cellIndex]?.textContent.trim() || ''
        const right = b.cells[header.cellIndex]?.textContent.trim() || ''
        const leftNumber = Number(left.replace(/[^0-9.-]/g, ''))
        const rightNumber = Number(right.replace(/[^0-9.-]/g, ''))
        const comparison = left && right && Number.isFinite(leftNumber) && Number.isFinite(rightNumber) ? leftNumber - rightNumber : left.localeCompare(right, undefined, { sensitivity: 'base' })
        return direction === 'asc' ? comparison : -comparison
      })
      rows.forEach((row) => body.appendChild(row))
    }
    document.addEventListener('click', sortTable)
    return () => document.removeEventListener('click', sortTable)
  }, [])

  const linkClass = ({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-[#1688ff]/12 text-[#1688ff] shadow-[inset_3px_0_0_#1688ff] dark:bg-[#1688ff]/15 dark:text-[#65b5ff]' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-[#9da0a8] dark:hover:bg-white/6 dark:hover:text-white'}`
  const unread = notifications.filter((notification) => !notification.read).length
  const unreadChat = notifications.filter((notification) => notification.kind === 'chat' && !notification.read).length
  const markRead = async (notification) => { await api.patch('/notifications/', { id: notification.id }).catch(() => { }); setNotifications(notifications.map((item) => item.id === notification.id ? { ...item, read: true } : item)) }

  const Sidebar = () => (
    <aside className={`${collapsed ? 'w-19' : 'w-64'} flex h-full flex-col border-r border-default-200 bg-content1/90 p-3 shadow-[8px_0_30px_rgb(15_23_42_/_.03)] backdrop-blur-xl transition-all dark:border-white/8 dark:bg-[#101114]/95 dark:shadow-none`}>
      <div className={`mb-8 flex rounded-2xl border border-slate-200/80 bg-slate-50/80 ${collapsed ? 'items-center justify-center p-2' : 'flex-col items-start gap-2 p-3'} dark:border-white/8 dark:bg-white/4`}>
        <img src={collapsed ? '/logo-mark.svg' : '/logo.svg'} alt="Revnivo" className={`${collapsed ? 'h-10 w-10' : 'h-10 w-32'} brand-logo shrink-0 object-contain`} />
        {!collapsed && <div className="truncate text-[11px] text-slate-500 dark:text-[#777a84]">Income workspace</div>}
      </div>
      <nav className="space-y-1">
        {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-[#62656e]">Workspace</p>}
        {isAdmin ? <div>
          <button onClick={() => { setDashboardOpen(!dashboardOpen); if (collapsed) setCollapsed(false) }} className={`${linkClass({ isActive: false })} w-full ${collapsed ? 'justify-center' : ''}`} title="Dashboard"><BarChart3 size={18} />{!collapsed && <><span className="flex-1 text-left">Dashboard</span><ChevronDown size={16} className={dashboardOpen ? '' : '-rotate-90'} /></>}</button>
          {dashboardOpen && <div className={collapsed ? 'mt-1 flex flex-col items-center gap-1' : 'ml-3 border-l border-slate-200 pl-3 dark:border-white/8'}><NavLink to="/" end className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center p-2' : ''}`} title="Income"><DollarSign size={18} />{!collapsed && 'Income'}</NavLink><NavLink to="/admin/users" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center p-2' : ''}`} title="Users"><Users size={18} />{!collapsed && 'Users'}</NavLink></div>}
        </div> : <NavLink to="/" end className={linkClass}><BarChart3 size={18} />{!collapsed && 'Dashboard'}</NavLink>}
        {baseNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center' : ''}`} title={label}><span className="relative"><Icon size={18} />{label === 'Chat' && unreadChat > 0 && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#23C55E] px-0.5 text-[9px] font-bold text-white">{unreadChat}</span>}</span>{!collapsed && label}</NavLink>)}
        {isAdmin && <>{!collapsed && <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-[#62656e]">Administration</p>}<NavLink to="/admin/subscriptions" className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center' : ''}`} title="Subscriptions"><WalletCards size={18} />{!collapsed && 'Subscriptions'}</NavLink></>}
      </nav>
      <div ref={profileRef} className="relative mt-auto border-t border-slate-200/80 pt-3 dark:border-white/8">
        <button onClick={() => setProfileOpen((open) => !open)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition hover:bg-slate-100/80 dark:hover:bg-white/6 ${collapsed ? 'justify-center' : ''}`} aria-expanded={profileOpen} aria-label="Open account menu">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#1688ff]/12 font-bold text-[#1688ff] dark:text-[#65b5ff]">{user?.profile_image_url ? <img src={user.profile_image_url} alt="Profile" className="h-full w-full object-cover" /> : user?.name?.slice(0, 2).toUpperCase()}</div>
          {!collapsed && <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</div><div className="truncate text-[11px] text-slate-500 dark:text-[#777a84]">{user?.email}</div></div>}
        </button>
        {profileOpen && <div className={`absolute bottom-14 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#1b1c21] ${collapsed ? 'left-12' : 'left-0'}`}>
          <NavLink to="/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-[#d8d9dd] dark:hover:bg-white/8"><SettingsIcon size={16} />Settings</NavLink>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"><LogOut size={16} />Log out</button>
        </div>}
      </div>
    </aside>
  )

  return <div className="min-h-screen bg-background text-foreground">
    <div className={`fixed inset-y-0 left-0 z-40 hidden lg:block ${collapsed ? 'w-19' : 'w-64'}`}><Sidebar /></div>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)}><div className="h-full w-64" onClick={(event) => event.stopPropagation()}><Sidebar /></div></div>}
    <div className={`${collapsed ? 'lg:pl-19' : 'lg:pl-64'} transition-all`}>
      <header className="light-header-shadow sticky top-0 z-30 flex h-16 items-center justify-between border-b border-default-200 bg-background/90 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-2"><button className="rounded-xl p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><button className="hidden rounded-xl p-2 lg:block" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar" aria-label="Toggle sidebar"><PanelLeft size={20} /></button></div>
        <div className="flex items-center gap-2">
          <div ref={noticeRef} className="relative flex items-center gap-2">
            <button onClick={() => setNoticeOpen(!noticeOpen)} className="relative rounded-xl border border-default-200 bg-content1/90 p-2.5 shadow-small backdrop-blur" title="Notifications" aria-label="Notifications"><Bell size={18} />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[10px] text-white">{unread}</span>}</button>
            <button onClick={toggleTheme} className="rounded-xl border border-default-200 bg-content1/90 p-2.5 shadow-small backdrop-blur" title="Toggle theme" aria-label="Toggle theme">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            {noticeOpen && <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-default-200 bg-content1 p-2 shadow-xl"><div className="px-3 py-2 font-bold">Notifications</div>{notifications.length ? notifications.slice(0, 6).map((notification) => <button key={notification.id} onClick={() => markRead(notification)} className="block w-full rounded-lg p-3 text-left hover:bg-default-100"><div className="text-sm font-semibold">{notification.title}</div><div className="text-xs text-default-500">{notification.message}</div></button>) : <div className="p-3 text-sm text-default-500">No notifications.</div>}</div>}
          </div>
        </div>
      </header>
      <main className="p-4 md:p-6 lg:p-8"><Outlet /></main>
    </div>
  </div>
}
