import { Autocomplete, AutocompleteItem, Button, Card, CardBody, Chip, Input, Select, SelectItem } from '@heroui/react'
import { ExternalLink, List, Pencil, Plus, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import PlatformAvatar from '../components/PlatformAvatar'
import api from '../services/api'
import { currencyCountry, getCurrencyOptions } from '../utils/currencies'
import 'flag-icons/css/flag-icons.min.css'

const emptyForm = { name: '', website: '', default_currency: 'USD', status: 'not active', logo: null }
const statusColors = { working: 'success', applied: 'warning', 'under review': 'secondary', 'not active': 'default' }
const currencyOptions = getCurrencyOptions()

export default function Platforms() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/platforms/')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (platform) => { setEditing(platform); setForm({ name: platform.name, website: platform.website || '', default_currency: platform.default_currency || 'USD', status: platform.status || 'not active', logo: null }); setError(''); setModal(true) }
  const remove = async (platform) => { if (!window.confirm(`Remove ${platform.name} from your active platforms? Existing earnings will stay in your history.`)) return; await api.delete(`/platforms/${platform.id}/`); await load() }
  const visibleItems = useMemo(() => items.filter((platform) => `${platform.name} ${platform.default_currency} ${platform.status} ${platform.website || ''}`.toLowerCase().includes(search.toLowerCase())), [items, search])
0
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => { if (value !== null) formData.append(key, value) })
    try {
      if (editing) await api.patch(`/platforms/${editing.id}/`, formData)
      else await api.post('/platforms/', formData)
      setModal(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join(' ') || 'Could not save platform.')
    } finally { setSaving(false) }
  }

  const renderGrid = () => <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {visibleItems.map((platform) => <Card key={platform.id} className="dashboard-panel h-64 border-default-200 bg-content1 text-foreground shadow-none">
        <CardBody className="flex h-full flex-col p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <PlatformAvatar platform={platform} />
                    <div className="min-w-0">
                        <h3 className="truncate font-semibold">{platform.name}</h3>
                        <p className="mt-1 text-xs text-default-500">{platform.default_currency}</p>
                        </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                            <Button isIconOnly size="sm" variant="light" onPress={() => openEdit(platform)} aria-label={`Edit ${platform.name}`}>
                                <Pencil size={15} />
                                </Button>
                                <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(platform)} aria-label={`Delete ${platform.name}`}><Trash2 size={15} /></Button>
                                </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-2">
                                    {platform.website && <a className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href={platform.website} target="_blank" rel="noreferrer">Website <ExternalLink size={13} /></a>}
                                                                        <Chip size="sm" variant="flat" color={statusColors[platform.status] || 'default'}>{platform.status || 'not active'}</Chip>
                                    </div>
                                    </CardBody></Card>)}
  </div>

  const renderTable = () => <Card className="overflow-hidden border-default-200 bg-content1 text-foreground shadow-none"><CardBody className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-180 text-left"><thead className="border-b border-default-200 bg-content2 text-xs uppercase tracking-wide text-default-600"><tr><th className="px-5 py-4">Logo</th><th className="px-5 py-4">Platform</th><th className="px-5 py-4">Currency</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Website</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-default-200">{visibleItems.map((platform) => <tr key={platform.id} className="text-sm transition hover:bg-default-100"><td className="px-5 py-3"><PlatformAvatar platform={platform} /></td><td className="px-5 py-3 font-semibold">{platform.name}</td><td className="px-5 py-3"><Chip size="sm" variant="bordered">{platform.default_currency}</Chip></td><td className="px-5 py-3"><Chip size="sm" variant="flat" color={statusColors[platform.status] || 'default'}>{platform.status || 'not active'}</Chip></td><td className="px-5 py-3">{platform.website ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={platform.website} target="_blank" rel="noreferrer">Open <ExternalLink size={14} /></a> : <span className="text-default-400">-</span>}</td><td className="px-5 py-3"><div className="flex justify-end gap-1"><Button isIconOnly size="sm" variant="light" onPress={() => openEdit(platform)} aria-label={`Edit ${platform.name}`}><Pencil size={15} /></Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(platform)} aria-label={`Delete ${platform.name}`}><Trash2 size={15} /></Button></div></td></tr>)}</tbody></table></div></CardBody></Card>

  const renderModal = () => <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit platform' : 'Add platform'}>
    {error && <div className="mb-4 rounded-xl border border-danger-400/30 bg-danger-400/10 p-3 text-sm text-danger-200">{error}</div>}
    <form onSubmit={submit} className="space-y-4">
      <Input label="Platform name" isRequired value={form.name} onValueChange={(value) => setForm({ ...form, name: value })} placeholder="Upwork" />
      <Input label="Website" type="url" value={form.website} onValueChange={(value) => setForm({ ...form, website: value })} placeholder="https://..." />
      <Autocomplete label="Default currency" selectedKey={form.default_currency} onSelectionChange={(key) => key && setForm({ ...form, default_currency: String(key) })} allowsCustomValue={false} placeholder="Currency">
        {currencyOptions.map((item) => <AutocompleteItem key={item.code} textValue={`${item.code} ${item.name}`}><span className="inline-flex items-center gap-2"><span className={`fi fi-${currencyCountry(item.code)} dashboard-currency-flag`} />{item.code}</span></AutocompleteItem>)}
      </Autocomplete>
      <Select label="Status" selectedKeys={new Set([form.status])} onSelectionChange={(keys) => setForm({ ...form, status: Array.from(keys)[0] || 'not active' })}><SelectItem key="working">Working</SelectItem><SelectItem key="applied">Applied</SelectItem><SelectItem key="not active">Not active</SelectItem><SelectItem key="under review">Under review</SelectItem></Select>
      <div><label className="mb-1.5 block text-sm font-medium text-foreground-600">Logo image</label><input className="input" type="file" accept="image/*" onChange={(event) => setForm({ ...form, logo: event.target.files?.[0] || null })} /></div>
      <div className="flex justify-end gap-2 pt-2"><Button variant="light" onPress={() => setModal(false)}>Cancel</Button><Button color="primary" type="submit" isLoading={saving}>{saving ? 'Saving...' : 'Save platform'}</Button></div>
    </form>
  </Modal>

  if (loading) return <Loading label="Loading platforms..." />

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Sources</p><h1 className="mt-2 text-3xl font-semibold text-foreground">Platforms</h1><p className="mt-1 text-sm text-default-500">Add every platform you earn from and keep your income organized.</p></div><div className="flex gap-2"><Button isIconOnly variant="flat" onPress={() => setView(view === 'grid' ? 'list' : 'grid')} aria-label="Toggle platform view">{view === 'grid' ? <List size={18} /> : <Square size={18} />}</Button><Button color="primary" onPress={openNew} startContent={<Plus size={18} />}>Add platform</Button></div></div>
    <Input aria-label="Search platforms" value={search} onValueChange={setSearch} placeholder="Search platforms..." className="max-w-sm" />
    {visibleItems.length ? (view === 'grid' ? renderGrid() : renderTable()) : <EmptyState title="No platforms found" text={search ? 'Try a different search term.' : 'Add Upwork, Fiverr, YouTube, a client portal, or any other income source.'} />}
    {renderModal()}
  </div>
}
