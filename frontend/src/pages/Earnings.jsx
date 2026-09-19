import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import PlatformAvatar from '../components/PlatformAvatar'
import api from '../services/api'
import { formatMoney } from '../utils/format'

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = { platform_id: '', amount: '', currency: 'USD', earned_at: today(), category: '', note: '' }

export default function Earnings() {
  const [items, setItems] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const [earningsResponse, platformsResponse] = await Promise.all([
        api.get('/earnings/', { params: { page: nextPage, search } }),
        api.get('/platforms/'),
      ])
      setItems(earningsResponse.data.results)
      setPagination(earningsResponse.data.pagination)
      setPlatforms(platformsResponse.data)
    } catch (err) { setError(err.response?.data?.detail || 'Could not load earnings.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(page) }, [page, search])

  const platformMap = useMemo(() => Object.fromEntries(platforms.map((platform) => [platform.id, platform])), [platforms])
  const openNew = () => { const platform = platforms[0]; setEditing(null); setForm({ ...emptyForm, platform_id: platform?.id || '', currency: platform?.default_currency || 'USD', earned_at: today() }); setError(''); setModal(true) }
  const openEdit = (earning) => { setEditing(earning); setForm({ platform_id: earning.platform_id, amount: String(earning.amount), currency: earning.currency, earned_at: earning.earned_at, category: earning.category || '', note: earning.note || '' }); setError(''); setModal(true) }
  const changePlatform = (id) => { const platform = platformMap[id]; setForm({ ...form, platform_id: id, currency: platform?.default_currency || form.currency }) }
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { if (editing) await api.patch(`/earnings/${editing.id}/`, form); else await api.post('/earnings/', form); setModal(false); await load(page) } catch (err) { setError(err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join(' ') || 'Could not save earning.') } finally { setSaving(false) } }
  const remove = async (earning) => { if (!window.confirm('Delete this earning entry?')) return; await api.delete(`/earnings/${earning.id}/`); await load(page) }

  if (loading && !items.length) return <Loading label="Loading earnings..."/>

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#16843d] dark:text-[#7bea9d]">Transactions</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Earnings</h1><p className="mt-1 text-sm text-slate-500">Record every payment with date, currency, category, and note.</p></div><button className="btn-primary" onClick={openNew} disabled={!platforms.length}><Plus size={18}/>Add earning</button></div>
    {!platforms.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Add at least one platform before recording earnings.</div>}
    <div className="card overflow-hidden"><div className="border-b border-slate-200 p-4 dark:border-slate-800"><div className="relative max-w-sm"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="input pl-9" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} placeholder="Search earnings..."/></div></div>
      {items.length ? <div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Amount (USD)</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{items.map((earning) => <tr key={earning.id} className="text-sm"><td className="px-4 py-3"><div className="flex items-center gap-2"><PlatformAvatar platform={platformMap[earning.platform_id] || { name: earning.platform_name }}/><span className="font-semibold text-slate-800 dark:text-slate-100">{earning.platform_name}</span></div></td><td className="px-4 py-3 font-bold text-emerald-600" title={`${formatMoney(earning.amount, earning.currency)} original`}>{formatMoney(earning.amount_usd, 'USD')}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{earning.earned_at}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{earning.category || '—'}</td><td className="max-w-xs truncate px-4 py-3 text-slate-500">{earning.description || earning.note || '—'}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => openEdit(earning)}><Pencil size={16}/></button><button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => remove(earning)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No earnings found" text={search ? 'Try a different search term.' : 'Record your first payment to start tracking income.'}/></div>}
      {pagination.pages > 1 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-800"><span className="text-slate-500">Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
    </div>
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit earning' : 'Add earning'}>{error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<form onSubmit={submit} className="space-y-4"><div><label className="label">Platform</label><select className="input" required value={form.platform_id} onChange={(event) => changePlatform(event.target.value)}><option value="">Select platform</option>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Amount</label><input className="input" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })}/></div><div><label className="label">Currency</label><select className="input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="USD">USD</option><option value="EGP">EGP</option></select></div></div><div><label className="label">Date earned</label><input className="input" required type="date" value={form.earned_at} onChange={(event) => setForm({ ...form, earned_at: event.target.value })}/></div><div><label className="label">Category</label><input className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Project, Bonus, Referral..."/></div><div><label className="label">Description</label><textarea className="input min-h-24 resize-y" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Optional details"/></div><div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save earning'}</button></div></form></Modal>
  </div>
}
