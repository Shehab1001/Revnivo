import { Button, Card, CardBody, Chip, Input, Pagination } from '@heroui/react'
import { Search, ShieldCheck, Trash2, UserCheck, Users as UsersIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Loading from '../components/Loading'
import api from '../services/api'

const SUPERADMIN_EMAIL = 'dev.shehabsaid@gmail.com'

function Stat({ label, value, icon: Icon }) {
  return <Card className="border-white/8 bg-[#15161a] text-white shadow-none"><CardBody className="flex flex-row items-center gap-3 p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1688ff]/12 text-[#4aa3ff]"><Icon size={19}/></span><div><p className="text-xs text-[#858891]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div></CardBody></Card>
}

export default function AdminUsers() {
  const [data, setData] = useState({ stats: {}, users: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const load = () => { setLoading(true); return api.get('/admin/users/').then(({ data: response }) => setData(Array.isArray(response) ? { stats: { total: response.length }, users: response } : response)).catch((err) => setError(err.response?.data?.detail || 'Could not load users.')).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const filtered = useMemo(() => data.users.filter((user) => `${user.name || ''} ${user.email || ''} ${user.role || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' })), [data.users, search])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const users = filtered.slice((page - 1) * pageSize, page * pageSize)
  const protectedUser = (user) => user.email?.toLowerCase() === SUPERADMIN_EMAIL
  const changeRole = async (user) => { if (protectedUser(user)) return; try { await api.patch('/admin/users/', { id: user.id, role: user.role === 'admin' ? 'user' : 'admin' }); load() } catch (err) { setError(err.response?.data?.detail || 'Could not update this user.') } }
  const remove = async (user) => { if (protectedUser(user) || !window.confirm(`Delete ${user.email}? This cannot be undone.`)) return; await api.delete('/admin/users/', { data: { id: user.id } }); load() }
  if (loading) return <Loading label="Loading users..."/>
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Administration</p><h1 className="mt-2 text-3xl font-semibold text-white">Users dashboard</h1></div>{error && <div className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-4 text-sm text-danger-200">{error}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total users" value={data.stats.total || 0} icon={UsersIcon}/><Stat label="Regular users" value={data.stats.users || 0} icon={UserCheck}/><Stat label="Admins" value={data.stats.admins || 0} icon={ShieldCheck}/><Stat label="Active free trials" value={data.stats.active_trials || 0} icon={UserCheck}/></div><Card className="overflow-hidden border-default-200 bg-content1 text-foreground shadow-none"><CardBody className="p-0"><div className="border-b border-default-200 p-4"><Input aria-label="Search users" value={search} onValueChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search users..." startContent={<Search size={16}/>} className="max-w-sm"/></div><div className="overflow-x-auto"><table className="w-full min-w-180 text-left"><thead className="border-b border-default-200 bg-content2 text-xs uppercase tracking-wide text-default-600"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Trial</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-default-200">{users.map((user) => <tr key={user.id} className="text-sm hover:bg-default-100"><td className="px-5 py-4 font-semibold"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">{user.profile_image_url ? <img src={user.profile_image_url} alt="" className="h-full w-full object-cover"/> : (user.name || '?').slice(0, 1).toUpperCase()}</div>{user.name || 'Unnamed user'}</div></td><td className="px-5 py-4">{user.email}</td><td className="px-5 py-4"><Chip size="sm" color={protectedUser(user) ? 'primary' : user.role === 'admin' ? 'success' : 'default'} variant="flat">{protectedUser(user) ? 'super admin' : user.role}</Chip></td><td className="px-5 py-4">{user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '-'}</td><td className="px-5 py-4 text-right">{protectedUser(user) ? <span className="text-xs text-primary">Protected</span> : <><Button size="sm" variant="flat" onPress={() => changeRole(user)}>{user.role === 'admin' ? 'Make user' : 'Make admin'}</Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(user)} aria-label="Delete"><Trash2 size={15}/></Button></>}</td></tr>)}</tbody></table></div><div className="flex justify-center border-t border-default-200 p-4"><Pagination showControls color="primary" page={page} total={pages} onChange={setPage}/></div></CardBody></Card></div>
}
