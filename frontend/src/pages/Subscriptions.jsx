import { Badge, Button, Card, Table, TextInput } from 'flowbite-react'
import { CreditCard, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import api from '../services/api'

export default function Subscriptions() {
  const [data, setData] = useState({ plan: { price: 3, trial_days: 30 }, users: [] })
  const [price, setPrice] = useState('3')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => { setLoading(true); setError(''); return api.get('/admin/subscriptions/').then(({ data: response }) => { const normalized = Array.isArray(response) ? { plan: { price: 3, trial_days: 30 }, users: response } : response; setData(normalized); setPrice(String(normalized.plan?.price ?? 3)) }).catch((err) => setError(err.response?.data?.detail || 'Could not load subscriptions.')).finally(() => setLoading(false)) }
  useEffect(load, [])
  const savePrice = async () => { await api.patch('/admin/subscriptions/', { plan_price: price }); load() }
  const activate = async (user) => { await api.patch('/admin/subscriptions/', { user_id: user.id, subscription_status: 'active', payment_method: user.payment_method || 'manual' }); load() }
  if (loading) return <Loading label="Loading subscriptions..."/>
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-[#16843d]">Administration</p><h1 className="mt-1 text-3xl font-black dark:text-white">Subscriptions</h1><p className="mt-1 text-sm text-slate-500">Manage the free trial and monthly plan.</p></div>{error && <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}<Card><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div className="flex items-center gap-3"><CreditCard className="text-[#23C55E]"/><div><p className="text-sm text-slate-500">Monthly subscription price</p><p className="text-xs text-slate-400">Free trial: {data.plan?.trial_days || 30} days</p></div></div><div className="flex gap-2"><TextInput type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)}/><Button color="success" onClick={savePrice}><Save size={16}/>Save price</Button></div></div></Card><div className="card overflow-hidden"><Table hoverable><Table.Head><Table.HeadCell>User</Table.HeadCell><Table.HeadCell>Status</Table.HeadCell><Table.HeadCell>Trial ends</Table.HeadCell><Table.HeadCell>Payment</Table.HeadCell><Table.HeadCell>Action</Table.HeadCell></Table.Head><Table.Body className="divide-y">{data.users.map((item) => <Table.Row key={item.id} className="bg-white dark:border-[#45484d] dark:bg-[#333538]"><Table.Cell><div className="font-semibold">{item.name}</div><div className="text-xs text-slate-500">{item.email}</div></Table.Cell><Table.Cell><Badge color={item.trial_active ? 'success' : item.subscription_status === 'active' ? 'info' : 'failure'}>{item.trial_active ? 'Free trial' : item.subscription_status}</Badge></Table.Cell><Table.Cell>{item.trial_ends_at ? new Date(item.trial_ends_at).toLocaleDateString() : '—'}</Table.Cell><Table.Cell>{item.payment_method || 'Not paid'}</Table.Cell><Table.Cell>{item.subscription_status !== 'active' && <Button size="xs" color="success" onClick={() => activate(item)}>Activate plan</Button>}</Table.Cell></Table.Row>)}</Table.Body></Table></div></div>
}
