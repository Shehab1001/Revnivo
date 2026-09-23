import { Button, Card, CardBody, Chip } from '@heroui/react'
import { ShieldCheck, Trash2, UserCheck, Users as UsersIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import api from '../services/api'

function Stat({ label, value, icon: Icon }) {
  return <Card className="border-white/8 bg-[#15161a] text-white shadow-none">
    <CardBody className="flex flex-row items-center gap-3 p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1688ff]/12 text-[#4aa3ff]"><Icon size={19}/></span>
      <div><p className="text-xs text-[#858891]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>
    </CardBody>
  </Card>
}

export default function AdminUsers() {
  const [data, setData] = useState({ stats: {}, users: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    return api.get('/admin/users/').then(({ data: response }) => {
      setData(Array.isArray(response) ? { stats: { total: response.length }, users: response } : response)
    }).catch((err) => setError(err.response?.data?.detail || 'Could not load users.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const changeRole = async (user) => {
    try {
      await api.patch('/admin/users/', { id: user.id, role: user.role === 'admin' ? 'user' : 'admin' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update this user.')
    }
  }

  const remove = async (user) => {
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return
    try {
      await api.delete('/admin/users/', { data: { id: user.id } })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not delete this user.')
    }
  }

  if (loading) return <Loading label="Loading users..."/>

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Administration</p><h1 className="mt-2 text-3xl font-semibold text-white">Users dashboard</h1><p className="mt-1 text-sm text-[#777a84]">Monitor everyone registered on Revnivo.</p></div>
    {error && <div className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-4 text-sm text-danger-200">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total users" value={data.stats.total || 0} icon={UsersIcon}/><Stat label="Regular users" value={data.stats.users || 0} icon={UserCheck}/><Stat label="Admins" value={data.stats.admins || 0} icon={ShieldCheck}/><Stat label="Active free trials" value={data.stats.active_trials || 0} icon={UserCheck}/></div>
    <Card className="overflow-hidden border-white/8 bg-[#15161a] text-white shadow-none"><CardBody className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-180 text-left"><thead className="border-b border-white/8 bg-[#1b1c21] text-[10px] uppercase tracking-wider text-[#777a84]"><tr><th className="px-5 py-4 font-medium">Name</th><th className="px-5 py-4 font-medium">Email</th><th className="px-5 py-4 font-medium">Role</th><th className="px-5 py-4 font-medium">Trial</th><th className="px-5 py-4 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-white/6">{data.users.map((user) => <tr key={user.id} className="text-sm transition hover:bg-white/3"><td className="px-5 py-4 font-semibold">{user.name || 'Unnamed user'}</td><td className="px-5 py-4 text-[#a8abb2]">{user.email}</td><td className="px-5 py-4"><Chip size="sm" variant="flat" color={user.role === 'admin' ? 'success' : 'default'}>{user.role}</Chip></td><td className="px-5 py-4 text-[#858891]">{user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '—'}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="flat" onPress={() => changeRole(user)}>{user.role === 'admin' ? 'Make user' : 'Make admin'}</Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(user)} aria-label={`Delete ${user.email}`}><Trash2 size={15}/></Button></div></td></tr>)}</tbody></table></div></CardBody></Card>
  </div>
}
