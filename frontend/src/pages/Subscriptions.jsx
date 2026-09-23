import { Button, Card, CardBody, Chip, Input, Select, SelectItem } from '@heroui/react'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import api from '../services/api'

const emptyPlan = { name: '', price: '3', trial_days: '30' }
const emptyCoupon = { code: '', discount_type: 'percent', discount_value: '10' }

function Panel({ title, children }) {
  return <Card className="border-white/8 bg-[#15161a] text-white shadow-none"><CardBody className="p-5"><h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><CreditCard size={18} className="text-[#4aa3ff]"/>{title}</h2>{children}</CardBody></Card>
}

export default function Subscriptions() {
  const [data, setData] = useState({ plans: [], coupons: [] })
  const [users, setUsers] = useState([])
  const [plan, setPlan] = useState(emptyPlan)
  const [editingPlan, setEditingPlan] = useState(null)
  const [coupon, setCoupon] = useState(emptyCoupon)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [plansResponse, subscriptionsResponse] = await Promise.all([api.get('/admin/plans/'), api.get('/admin/subscriptions/')])
      setData(plansResponse.data)
      setUsers(subscriptionsResponse.data.users || subscriptionsResponse.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load subscriptions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const addPlan = async (event) => {
    event.preventDefault()
    try {
      const payload = { ...plan, price: Number(plan.price), trial_days: Number(plan.trial_days) }
      if (editingPlan) await api.patch('/admin/plans/', { id: editingPlan.id, ...payload })
      else await api.post('/admin/plans/', payload)
      setPlan(emptyPlan); setEditingPlan(null); load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not save the plan.') }
  }

  const addCoupon = async (event) => {
    event.preventDefault()
    try {
      await api.post('/admin/coupons/', { ...coupon, discount_value: Number(coupon.discount_value) })
      setCoupon(emptyCoupon); load()
    } catch (err) { setError(err.response?.data?.detail || 'Could not save the coupon.') }
  }

  const deletePlan = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return
    await api.delete('/admin/plans/', { data: { id: item.id } }); load()
  }

  const deleteCoupon = async (item) => {
    if (!window.confirm(`Delete coupon ${item.code}?`)) return
    await api.delete('/admin/coupons/', { data: { id: item.id } }); load()
  }

  const activate = async (user) => {
    await api.patch('/admin/subscriptions/', { user_id: user.id, subscription_status: 'active', payment_method: user.payment_method || 'manual' }); load()
  }

  if (loading) return <Loading label="Loading subscriptions..."/>

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Administration</p><h1 className="mt-2 text-3xl font-semibold text-white">Subscriptions</h1><p className="mt-1 text-sm text-[#777a84]">Manage plans, coupons, trials, and subscribers.</p></div>
    {error && <div className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-4 text-sm text-danger-200">{error}</div>}
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title={editingPlan ? 'Edit subscription plan' : 'Add subscription plan'}><form onSubmit={addPlan} className="grid gap-3 md:grid-cols-3"><Input label="Name" required value={plan.name} onChange={(event) => setPlan({ ...plan, name: event.target.value })} placeholder="Pro"/><Input label="Price USD" required type="number" min="0.01" step="0.01" value={plan.price} onChange={(event) => setPlan({ ...plan, price: event.target.value })}/><Input label="Trial days" required type="number" min="0" value={plan.trial_days} onChange={(event) => setPlan({ ...plan, trial_days: event.target.value })}/><div className="flex gap-2 md:col-span-3"><Button color="primary" type="submit" startContent={editingPlan ? <Pencil size={15}/> : <Plus size={15}/>}>{editingPlan ? 'Update plan' : 'Add plan'}</Button>{editingPlan && <Button variant="light" onPress={() => { setEditingPlan(null); setPlan(emptyPlan) }}>Cancel</Button>}</div></form><div className="mt-5 space-y-2">{data.plans.length ? data.plans.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/6 bg-[#1b1c21] p-3"><span><b>{item.name}</b><span className="ml-2 text-xs text-[#858891]">${item.price}/month · {item.trial_days} trial days</span></span><div className="flex gap-1"><Button isIconOnly size="sm" variant="light" onPress={() => { setEditingPlan(item); setPlan({ name: item.name, price: String(item.price), trial_days: String(item.trial_days) }) }} aria-label={`Edit ${item.name}`}><Pencil size={14}/></Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => deletePlan(item)} aria-label={`Delete ${item.name}`}><Trash2 size={14}/></Button></div></div>) : <p className="text-sm text-[#777a84]">No plans created yet.</p>}</div></Panel>
      <Panel title="Discount coupons"><form onSubmit={addCoupon} className="grid gap-3 md:grid-cols-4"><Input className="md:col-span-2" label="Code" required value={coupon.code} onChange={(event) => setCoupon({ ...coupon, code: event.target.value })} placeholder="WELCOME10"/><Select label="Type" selectedKeys={new Set([coupon.discount_type])} onSelectionChange={(keys) => setCoupon({ ...coupon, discount_type: Array.from(keys)[0] || 'percent' })}><SelectItem key="percent">Percent</SelectItem><SelectItem key="fixed">Fixed</SelectItem></Select><Input label="Value" required type="number" min="0.01" step="0.01" value={coupon.discount_value} onChange={(event) => setCoupon({ ...coupon, discount_value: event.target.value })}/><Button className="md:col-span-4" color="primary" type="submit" startContent={<Plus size={15}/>}>Add coupon</Button></form><div className="mt-5 space-y-2">{data.coupons.length ? data.coupons.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/6 bg-[#1b1c21] p-3"><span><b>{item.code}</b><span className="ml-2 text-xs text-[#858891]">{item.discount_value}{item.discount_type === 'percent' ? '%' : ' USD'} off</span></span><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => deleteCoupon(item)} aria-label={`Delete ${item.code}`}><Trash2 size={14}/></Button></div>) : <p className="text-sm text-[#777a84]">No coupons created yet.</p>}</div></Panel>
    </div>
    <Card className="overflow-hidden border-white/8 bg-[#15161a] text-white shadow-none"><CardBody className="p-0"><div className="border-b border-white/8 p-5"><h2 className="font-semibold">Subscribers</h2><p className="mt-1 text-xs text-[#777a84]">Activate trials and manage subscription status.</p></div><div className="overflow-x-auto"><table className="w-full min-w-180 text-left"><thead className="border-b border-white/8 bg-[#1b1c21] text-[10px] uppercase tracking-wider text-[#777a84]"><tr><th className="px-5 py-4 font-medium">User</th><th className="px-5 py-4 font-medium">Status</th><th className="px-5 py-4 font-medium">Trial</th><th className="px-5 py-4 font-medium">Payment</th><th className="px-5 py-4 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-white/6">{users.map((user) => <tr key={user.id} className="text-sm hover:bg-white/3"><td className="px-5 py-4"><div className="font-semibold">{user.name || 'Unnamed user'}</div><div className="text-xs text-[#858891]">{user.email}</div></td><td className="px-5 py-4"><Chip size="sm" color={user.subscription_status === 'active' ? 'success' : 'default'} variant="flat">{user.subscription_status || 'trial'}</Chip></td><td className="px-5 py-4 text-xs text-[#858891]">{user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : '—'}</td><td className="px-5 py-4 text-xs text-[#858891]">{user.payment_method || '—'}</td><td className="px-5 py-4 text-right"><Button size="sm" color="primary" variant="flat" onPress={() => activate(user)}>{user.subscription_status === 'active' ? 'Renew' : 'Activate'}</Button></td></tr>)}</tbody></table></div></CardBody></Card>
  </div>
}
