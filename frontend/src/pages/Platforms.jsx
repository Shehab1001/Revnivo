import { ExternalLink, List, Pencil, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import PlatformAvatar from '../components/PlatformAvatar'
import api from '../services/api'

const emptyForm = { name: '', website: '', default_currency: 'USD', status: 'not active', logo: null }

export default function Platforms() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('grid')

  const load = async () => { setLoading(true); try { const {data}=await api.get('/platforms/'); setItems(data) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (p) => { setEditing(p); setForm({ name:p.name, website:p.website || '', default_currency:p.default_currency || 'USD', status:p.status || 'not active', logo:null }); setError(''); setModal(true) }

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    const fd = new FormData(); fd.append('name', form.name); fd.append('website', form.website); fd.append('default_currency', form.default_currency); fd.append('status', form.status); if (form.logo) fd.append('logo', form.logo)
    try {
      if (editing) await api.patch(`/platforms/${editing.id}/`, fd)
      else await api.post('/platforms/', fd)
      setModal(false); await load()
    } catch (err) { setError(err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join(' ') || 'Could not save platform.') }
    finally { setSaving(false) }
  }

  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name} from your active platforms? Existing earnings will stay in your history.`)) return
    await api.delete(`/platforms/${p.id}/`); await load()
  }

  if (loading) return <Loading label="Loading platforms..."/>

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#16843d] dark:text-[#7bea9d]">Sources</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Platforms</h1><p className="mt-1 text-sm text-slate-500">Add or remove every platform you earn from, including its logo.</p></div><div className="flex gap-2"><button className="btn-secondary p-2.5" onClick={() => setView(view === 'grid' ? 'list' : 'grid')} title="Toggle platform view">{view === 'grid' ? <List size={18}/> : <Square size={18}/>}</button><button className="btn-primary" onClick={openNew}><Plus size={18}/>Add platform</button></div></div>
    {items.length ? <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>{items.map((p) => <div key={p.id} className="card p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><PlatformAvatar platform={p} size="lg"/><div className="min-w-0"><h3 className="truncate font-bold text-slate-900 dark:text-white">{p.name}</h3><p className="text-sm text-slate-500">Default: {p.default_currency}</p><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${p.status === 'working' ? 'bg-emerald-100 text-emerald-700' : p.status === 'applied' ? 'bg-red-100 text-red-800' : p.status === 'under review' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-700'}`}>{p.status || 'not active'}</span></div></div><div className="flex gap-1"><button onClick={()=>openEdit(p)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={16}/></button><button onClick={()=>remove(p)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 size={16}/></button></div></div>{p.website && <a className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#16843d]" href={p.website} target="_blank" rel="noreferrer">Visit website <ExternalLink size={14}/></a>}</div>)}</div> : <EmptyState title="No platforms yet" text="Add Upwork, Fiverr, YouTube, a client portal, or any other income source."/>}

    <Modal open={modal} onClose={()=>setModal(false)} title={editing ? 'Edit platform' : 'Add platform'}>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
      <form onSubmit={submit} className="space-y-4"><div><label className="label">Platform name</label><input className="input" required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Upwork"/></div><div><label className="label">Website</label><input className="input" type="url" value={form.website} onChange={(e)=>setForm({...form,website:e.target.value})} placeholder="https://..."/></div><div><label className="label">Default currency</label><input className="input" maxLength={8} value={form.default_currency} onChange={(e)=>setForm({...form,default_currency:e.target.value.toUpperCase()})} placeholder="USD"/></div><div><label className="label">Status</label><select className="input" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option>working</option><option>applied</option><option>not active</option><option>under review</option></select></div><div><label className="label">Logo image</label><input className="input" type="file" accept="image/*" onChange={(e)=>setForm({...form,logo:e.target.files?.[0] || null})}/></div><div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={()=>setModal(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving?'Saving...':'Save platform'}</button></div></form>
    </Modal>
  </div>
}
