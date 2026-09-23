import { Button, Card, CardBody, Chip, Input, Pagination } from '@heroui/react'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import api from '../services/api'
import { useSortableData } from '../utils/useSortableData.js'

export default function Subscriptions() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const subscriptionsResponse = await api.get('/admin/subscriptions/')
      setUsers(subscriptionsResponse.data.users || subscriptionsResponse.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load subscriptions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredUsers = users.filter((user) => `${user.name || ''} ${user.email || ''} ${user.subscription_status || ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '', undefined, { sensitivity: 'base' }))
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)
  const { sortedItems: sortedVisibleUsers } = useSortableData(visibleUsers, 'name')

  const activate = async (user) => {
    await api.patch('/admin/subscriptions/', { user_id: user.id, subscription_status: 'active', payment_method: user.payment_method || 'manual' }); load()
  }

  if (loading) return <Loading label="Loading subscriptions..."/>

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Administration</p><h1 className="mt-2 text-3xl font-semibold text-white">Subscriptions</h1><p className="mt-1 text-sm text-[#777a84]">Manage users and subscription status.</p></div>
    {error && <div className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-4 text-sm text-danger-200">{error}</div>}
    <Card className="overflow-hidden border-default-200 bg-content1 text-foreground shadow-none"><CardBody className="p-0"><div className="border-b border-default-200 p-5"><h2 className="font-semibold">Users</h2><p className="mt-1 text-xs text-default-500">Activate trials and manage subscription status.</p><Input aria-label="Search subscription users" value={search} onValueChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search users..." startContent={<Search size={16}/>} className="mt-4 max-w-sm" /></div><div className="overflow-x-auto"><table className="w-full min-w-180 text-left"><thead className="border-b border-default-200 bg-content2 text-[10px] uppercase tracking-wider text-default-600"><tr><th className="px-5 py-4 font-medium">User</th><th className="px-5 py-4 font-medium">Status</th><th className="px-5 py-4 font-medium">Trial</th><th className="px-5 py-4 font-medium">Payment</th><th className="px-5 py-4 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-default-200">{visibleUsers.map((user) => <tr key={user.id} className="text-sm hover:bg-default-100"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">{user.profile_image_url ? <img src={user.profile_image_url} alt="" className="h-full w-full object-cover"/> : (user.name || '?').slice(0, 1).toUpperCase()}</div><div><div className="font-semibold">{user.name || 'Unnamed user'}</div><div className="text-xs text-default-500">{user.email}</div></div></div></td><td className="px-5 py-4"><Chip size="sm" color={user.subscription_status === 'active' ? 'success' : 'default'} variant="flat">{user.subscription_status || 'trial'}</Chip></td><td className="px-5 py-4 text-xs text-default-600">{user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '—'}</td><td className="px-5 py-4 text-xs text-default-600">{user.payment_method || '—'}</td><td className="px-5 py-4 text-right"><Button size="sm" color="primary" variant="flat" onPress={() => activate(user)}>{user.subscription_status === 'active' ? 'Renew' : 'Activate'}</Button></td></tr>)}</tbody></table></div><div className="flex justify-center border-t border-default-200 p-4"><Pagination showControls color="primary" page={page} total={pageCount} onChange={setPage}/></div></CardBody></Card>
  </div>
}
