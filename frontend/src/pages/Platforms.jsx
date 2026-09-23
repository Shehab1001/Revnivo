import { Button, Card, CardBody, Chip, Input, Select, SelectItem } from '@heroui/react'
import { ExternalLink, List, Pencil, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import PlatformAvatar from '../components/PlatformAvatar'
import api from '../services/api'

const emptyForm = { name: '', website: '', default_currency: 'USD', status: 'not active', logo: null }
const statusColors = { working: 'success', applied: 'warning', 'under review': 'secondary', 'not active': 'default' }

export default function Platforms() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('grid')

  const load = async () => { setLoading(true); try { const { data } = await api.get('/platforms/'); setItems(data) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (platform) => { setEditing(platform); setForm({ name: platform.name, website: platform.website || '', default_currency: platform.default_currency || 'USD', status: platform.status || 'not active', logo: null }); setError(''); setModal(true) }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => { if (value !== null) formData.append(key, value) })
    try { if (editing) await api.patch(`/platforms/${editing.id}/`, formData); else await api.post('/platforms/', formData); setModal(false); await load() }
    catch (err) { setError(err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join(' ') || 'Could not save platform.') }
    finally { setSaving(false) }
  }
  const remove = async (platform) => { if (!window.confirm(`Remove ${platform.name} from your active platforms? Existing earnings will stay in your history.`)) return; await api.delete(`/platforms/${platform.id}/`); await load() }
  if (loading) return <Loading label="Loading platforms..."/>

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Sources</p><h1 className="mt-2 text-3xl font-semibold text-foreground">Platforms</h1><p className="mt-1 text-sm text-default-500">Add every platform you earn from and keep your income organized.</p></div><div className="flex gap-2"><Button isIconOnly variant="flat" onPress={() => setView(view === 'grid' ? 'list' : 'grid')} aria-label="Toggle platform view">{view === 'grid' ? <List size={18}/> : <Square size={18}/>}</Button><Button color="primary" onPress={openNew} startContent={<Plus size={18}/>}>Add platform</Button></div></div>
    {items.length ? <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>{items.map((platform) => <Card key={platform.id} className="dashboard-panel border-white/8 bg-content1 text-foreground shadow-none"><CardBody className="p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><PlatformAvatar platform={platform} size="lg"/><div className="min-w-0"><h3 className="truncate font-semibold">{platform.name}</h3><p className="mt-1 text-xs text-default-500">Default currency: {platform.default_currency}</p><div className="mt-2 flex flex-wrap gap-2"><Chip size="sm" variant="flat" color={statusColors[platform.status] || 'default'}>{platform.status || 'not active'}</Chip><Chip size="sm" variant="bordered">{platform.default_currency}</Chip></div></div></div><div className="flex gap-1"><Button isIconOnly size="sm" variant="light" onPress={() => openEdit(platform)} aria-label={`Edit ${platform.name}`}><Pencil size={15}/></Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(platform)} aria-label={`Delete ${platform.name}`}><Trash2 size={15}/></Button></div></div>{platform.website && <a className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href={platform.website} target="_blank" rel="noreferrer">Visit website <ExternalLink size={13}/></a>}</CardBody></Card>)}</div> : <EmptyState title="No platforms yet" text="Add Upwork, Fiverr, YouTube, a client portal, or any other income source."/>}
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit platform' : 'Add platform'}>
      {error && <div className="mb-4 rounded-xl border border-danger-400/30 bg-danger-400/10 p-3 text-sm text-danger-200">{error}</div>}
      <form onSubmit={submit} className="space-y-4"><Input label="Platform name" isRequired value={form.name} onValueChange={(value) => setForm({ ...form, name: value })} placeholder="Upwork"/><Input label="Website" type="url" value={form.website} onValueChange={(value) => setForm({ ...form, website: value })} placeholder="https://..."/><Input label="Default currency" maxLength={8} value={form.default_currency} onValueChange={(value) => setForm({ ...form, default_currency: value.toUpperCase() })} placeholder="USD"/><Select label="Status" selectedKeys={new Set([form.status])} onSelectionChange={(keys) => setForm({ ...form, status: Array.from(keys)[0] || 'not active' })}><SelectItem key="working">Working</SelectItem><SelectItem key="applied">Applied</SelectItem><SelectItem key="not active">Not active</SelectItem><SelectItem key="under review">Under review</SelectItem></Select><div><label className="mb-1.5 block text-sm font-medium text-foreground-600">Logo image</label><input className="input" type="file" accept="image/*" onChange={(event) => setForm({ ...form, logo: event.target.files?.[0] || null })}/></div><div className="flex justify-end gap-2 pt-2"><Button variant="light" onPress={() => setModal(false)}>Cancel</Button><Button color="primary" type="submit" isLoading={saving}>{saving ? 'Saving...' : 'Save platform'}</Button></div></form>
    </Modal>
  </div>
}
