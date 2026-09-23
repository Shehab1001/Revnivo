import { Button, Card, CardBody, Input, Pagination, Textarea } from '@heroui/react'
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import api from '../services/api'

const cairoDate = (value) => value ? new Date(value).toLocaleString('en-EG', { timeZone: 'Africa/Cairo' }) : ''

export default function Notes() {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', content: '' })
  const [editing, setEditing] = useState(null)
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const { data } = await api.get('/notes/', { params: { page: nextPage, search } })
      setItems(data.results)
      setPagination(data.pagination)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load notes.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load(page) }, [page, search])

  const openNew = () => { setEditing(null); setForm({ title: '', content: '' }); setError(''); setModal(true) }
  const openEdit = (note) => { setEditing(note); setForm({ title: note.title || '', content: note.content || '' }); setError(''); setModal(true) }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      if (editing) await api.patch(`/notes/${editing.id}/`, form)
      else await api.post('/notes/', form)
      setForm({ title: '', content: '' }); setEditing(null); setModal(false); setPage(1); await load(1)
    } catch (err) { setError(err.response?.data?.detail || 'Could not save note.') }
    finally { setSaving(false) }
  }
  const remove = async (note) => { if (!window.confirm('Delete this note?')) return; await api.delete(`/notes/${note.id}/`); await load(page) }

  if (loading && !items.length) return <Loading label="Loading notes..."/>

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Workspace</p><h1 className="mt-2 text-3xl font-semibold text-foreground">Notes</h1><p className="mt-1 text-sm text-default-500">Keep useful context beside your earnings.</p></div><Button color="primary" onPress={openNew} startContent={<Plus size={18}/>}>Add note</Button></div>
    {error && <div className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-3 text-sm text-danger-200">{error}</div>}
    <Card className="overflow-hidden border-white/8 bg-content1 shadow-none"><CardBody className="p-0"><div className="border-b border-default-100 p-4"><Input startContent={<Search size={17}/>} value={search} onValueChange={(value) => { setPage(1); setSearch(value) }} placeholder="Search notes..."/></div>{items.length ? <div className="divide-y divide-default-100">{items.map((note) => <article key={note.id} className="flex items-start gap-4 p-5 transition hover:bg-default-100/30"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><FileText size={18}/></div><div className="min-w-0 flex-1"><h2 className="font-semibold text-foreground">{note.title || 'Untitled note'}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-default-600">{note.content}</p><p className="mt-3 text-xs text-default-400">Created {cairoDate(note.created_at)}</p></div><Button isIconOnly size="sm" variant="light" onPress={() => openEdit(note)} aria-label="Edit note"><Pencil size={16}/></Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(note)} aria-label="Delete note"><Trash2 size={16}/></Button></article>)}</div> : <div className="p-5"><EmptyState title="No notes yet" text="Create a note to keep useful context beside your earnings."/></div>}{pagination.pages > 1 && <div className="flex justify-center border-t border-default-100 p-3"><Pagination page={page} total={pagination.pages} onChange={setPage}/></div>}</CardBody></Card>
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit note' : 'Add note'}><form onSubmit={submit} className="space-y-4"><Input label="Title" value={form.title} onValueChange={(value) => setForm({ ...form, title: value })} placeholder="Optional title"/><Textarea label="Content" isRequired value={form.content} onValueChange={(value) => setForm({ ...form, content: value })} placeholder="Write your note..." minRows={6}/><div className="flex justify-end gap-2"><Button variant="light" onPress={() => setModal(false)}>Cancel</Button><Button color="primary" type="submit" isLoading={saving}>{editing ? 'Save changes' : 'Create note'}</Button></div></form></Modal>
  </div>
}
