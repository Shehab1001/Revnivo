import { Badge, Button, Table } from 'flowbite-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import api from '../services/api'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => { setLoading(true); setError(''); return api.get('/admin/users/').then(({ data }) => setUsers(data)).catch((err) => setError(err.response?.data?.detail || 'Could not load users.')).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const changeRole = async (user) => { await api.patch('/admin/users/', { id: user.id, role: user.role === 'admin' ? 'user' : 'admin' }); load() }
  const remove = async (user) => { if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return; await api.delete('/admin/users/', { data: { id: user.id } }); load() }
  if (loading) return <Loading label="Loading users..."/>
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-[#16843d]">Administration</p><h1 className="mt-1 text-3xl font-black dark:text-white">Users</h1><p className="mt-1 text-sm text-slate-500">Accounts registered on Revnivo.</p></div>{error && <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}<div className="card overflow-hidden"><Table hoverable><Table.Head><Table.HeadCell>Name</Table.HeadCell><Table.HeadCell>Email</Table.HeadCell><Table.HeadCell>Role</Table.HeadCell><Table.HeadCell>Trial</Table.HeadCell><Table.HeadCell>Actions</Table.HeadCell></Table.Head><Table.Body className="divide-y">{users.map((user) => <Table.Row key={user.id} className="bg-white dark:border-[#45484d] dark:bg-[#333538]"><Table.Cell className="font-semibold">{user.name}</Table.Cell><Table.Cell>{user.email}</Table.Cell><Table.Cell><Badge color={user.role === 'admin' ? 'success' : 'gray'}>{user.role}</Badge></Table.Cell><Table.Cell>{user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '—'}</Table.Cell><Table.Cell><div className="flex gap-2"><Button size="xs" color="light" onClick={() => changeRole(user)}>{user.role === 'admin' ? 'Make user' : 'Make admin'}</Button><Button size="xs" color="failure" onClick={() => remove(user)}>Delete</Button></div></Table.Cell></Table.Row>)}</Table.Body></Table></div></div>
}
