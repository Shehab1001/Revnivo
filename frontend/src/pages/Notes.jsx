import { FileText, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import api from '../services/api'

export default function Notes() {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', content: '' })
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

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/notes/', form)
      setForm({ title: '', content: '' }); setModal(false); setPage(1); await load(1)
    } catch (err) { setError(err.response?.data?.detail || 'Could not save note.') }
    finally { setSaving(false) }
  }

  const remove = async (note) => {
    if (!window.confirm('Delete this note?')) return
    await api.delete(`/notes/${note.id}/`)
    await load(page)
  }

  if (loading && !items.length) return <Loading label="Loading notes..."/>

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-[#16843d] dark:text-[#7bea9d]">Workspace</p><h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Notes</h1><p className="mt-1 text-sm text-slate-500">Keep quick descriptions, reminders, and payment context in one place.</p></div>
      <button className="btn-primary" onClick={() => { setError(''); setModal(true) }}><Plus size={18}/>Add note</button>
    </div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="card overflow-hidden"><div className="border-b border-slate-200 p-4 dark:border-[#45484d]"><div className="relative max-w-sm"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="input pl-9" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} placeholder="Search notes..."/></div></div>
      {items.length ? <div className="divide-y divide-slate-100 dark:divide-[#45484d]">{items.map((note) => <article key={note.id} className="flex items-start gap-4 p-5"><div className="rounded-xl bg-[#e8f8ed] p-2 text-[#16843d]"><FileText size={18}/></div><div className="min-w-0 flex-1"><h2 className="font-bold text-slate-900 dark:text-white">{note.title || 'Untitled note'}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{note.content}</p><p className="mt-3 text-xs text-slate-400">{note.updated_at ? new Date(note.updated_at).toLocaleString() : ''}</p></div><button className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => remove(note)} title="Delete note"><Trash2 size={17}/></button></article>)}</div> : <div className="p-5"><EmptyState title="No notes yet" text="Create a note to keep useful context beside your earnings."/></div>}
      {pagination.pages > 1 && <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-[#45484d]"><span className="text-slate-500">Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button></div></div>}
    </div>
    <Modal open={modal} onClose={() => setModal(false)} title="Add note"><form onSubmit={submit} className="space-y-4"><div><label className="label">Title</label><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Optional title"/></div><div><label className="label">Note</label><textarea className="input min-h-40 resize-y" required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Write your note..."/></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save note'}</button></div></form></Modal>
  </div>
}
