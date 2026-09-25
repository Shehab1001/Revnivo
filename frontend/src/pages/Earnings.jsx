import { Autocomplete, AutocompleteItem, Button, Input, Pagination, Select, SelectItem, Textarea } from '@heroui/react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import PlatformAvatar from '../components/PlatformAvatar'
import api from '../services/api'
import { formatMoney, localDateInputValue } from '../utils/format'
import { currencyCountry, getCurrencyOptions } from '../utils/currencies'
import 'flag-icons/css/flag-icons.min.css'

const today = () => localDateInputValue()
const emptyForm = { platform_id: '', amount: '', currency: 'USD', earned_at: today(), category: '', note: '' }
const currencyOptions = getCurrencyOptions()

const dropdownClassNames = {
  trigger:
    'h-11 min-h-11 rounded-xl border-0 bg-[#eceef2] px-3.5 shadow-none transition-colors data-[hover=true]:bg-[#e4e7ec] dark:bg-content1 dark:data-[hover=true]:bg-default-100',
  value: 'text-sm font-semibold text-foreground dark:text-white',
  selectorIcon: 'right-3 text-default-500 dark:text-zinc-200',
  popoverContent:
    'rounded-2xl border border-default-200 bg-content1 p-1 shadow-xl dark:border-white/10 dark:bg-[#202023]',
}

const autocompleteInputClassNames = {
  inputWrapper:
    'h-11 min-h-11 rounded-xl border-0 bg-[#eceef2] px-3.5 shadow-none transition-colors data-[hover=true]:bg-[#e4e7ec] group-data-[focus=true]:bg-[#eceef2] dark:bg-content1 dark:data-[hover=true]:bg-default-100 dark:group-data-[focus=true]:bg-content1',
  input:
    'text-sm font-semibold text-foreground placeholder:text-default-500 dark:text-white',
  innerWrapper: 'gap-2',
}


const modalDropdownClassNames = {
  trigger:
    'h-14 min-h-14 rounded-xl border border-default-300/70 bg-default-100 px-4 shadow-none transition-colors data-[hover=true]:bg-default-200 dark:border-white/12 dark:bg-[#24262b] dark:data-[hover=true]:bg-[#2c2f35]',
  label:
    'text-xs font-medium text-default-500 dark:text-zinc-400',
  value:
    'text-sm font-semibold text-foreground dark:text-white',
  selectorIcon:
    'right-4 text-default-500 dark:text-zinc-300',
  popoverContent:
    'rounded-2xl border border-default-200 bg-content1 p-1 shadow-xl dark:border-white/10 dark:bg-[#202226]',
}

const modalAutocompleteInputClassNames = {
  inputWrapper:
    'h-14 min-h-14 rounded-xl border border-default-300/70 bg-default-100 px-4 shadow-none transition-colors data-[hover=true]:bg-default-200 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:bg-default-100 dark:border-white/12 dark:bg-[#24262b] dark:data-[hover=true]:bg-[#2c2f35] dark:group-data-[focus=true]:bg-[#24262b]',
  label:
    'text-xs font-medium text-default-500 dark:text-zinc-400',
  input:
    'text-sm font-semibold text-foreground placeholder:text-default-500 dark:text-white',
  innerWrapper: 'gap-2',
}

export default function Earnings() {
  const [items, setItems] = useState([]); const [platforms, setPlatforms] = useState([]); const [pagination, setPagination] = useState({ page: 1, pages: 1 }); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null); const [form, setForm] = useState(emptyForm); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const load = async (nextPage = page) => { setLoading(true); try { const [earningsResponse, platformsResponse] = await Promise.all([api.get('/earnings/', { params: { page: nextPage, search } }), api.get('/platforms/')]); setItems(earningsResponse.data.results); setPagination(earningsResponse.data.pagination); setPlatforms(platformsResponse.data) } catch (err) { setError(err.response?.data?.detail || 'Could not load earnings.') } finally { setLoading(false) } }
  useEffect(() => { load(page) }, [page, search])
  const platformMap = useMemo(() => Object.fromEntries(platforms.map((platform) => [platform.id, platform])), [platforms])
  const openNew = () => { const platform = platforms[0]; setEditing(null); setForm({ ...emptyForm, platform_id: platform?.id || '', currency: platform?.default_currency || 'USD' }); setError(''); setModal(true) }
  const openEdit = (earning) => { setEditing(earning); setForm({ platform_id: earning.platform_id, amount: String(earning.amount), currency: earning.currency, earned_at: earning.earned_at, category: earning.category || '', note: earning.note || '' }); setError(''); setModal(true) }
  const changePlatform = (id) => { const platform = platformMap[id]; setForm({ ...form, platform_id: id, currency: platform?.default_currency || form.currency }) }
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { if (editing) await api.patch(`/earnings/${editing.id}/`, form); else await api.post('/earnings/', form); setModal(false); await load(page) } catch (err) { setError(err.response?.data?.detail || Object.values(err.response?.data || {}).flat().join(' ') || 'Could not save earning.') } finally { setSaving(false) } }
  const remove = async (earning) => { if (!window.confirm('Delete this earning entry?')) return; await api.delete(`/earnings/${earning.id}/`); await load(page) }
  if (loading && !items.length) return <Loading label="Loading earnings..." />

  return <div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">Transactions</p><h1 className="mt-2 text-3xl font-semibold text-foreground">Earnings</h1><p className="mt-1 text-sm text-default-500">Record every payment with date, currency, category, and description.</p></div><Button color="primary" onPress={openNew} isDisabled={!platforms.length} startContent={<Plus size={18} />}>Add earning</Button></div>
    {!platforms.length && <div className="rounded-xl border border-warning-300/30 bg-warning-400/10 p-4 text-sm text-warning-200">Add at least one platform before recording earnings.</div>}
    <div className="card overflow-hidden"><div className="border-b border-white/8 bg-[#15161a] p-4"><Input className="max-w-sm" startContent={<Search size={17} />} value={search} onValueChange={(value) => { setPage(1); setSearch(value) }} placeholder="Search.." /></div>{items.length ? <div className="overflow-x-auto"><table className="min-w-full text-left"><thead className="bg-[#1b1c21] text-xs font-bold uppercase tracking-wide text-[#c5c7cc] mb-8"><tr><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/6">{items.map((earning) => <tr key={earning.id} className="text-sm"><td className="px-4 py-3"><div className="flex items-center gap-2"><PlatformAvatar platform={platformMap[earning.platform_id] || { name: earning.platform_name }} /><span className="font-semibold">{earning.platform_name}</span></div></td><td className="px-4 py-3 font-bold text-[#35d989]" title={`${formatMoney(earning.amount, earning.currency)} original`}>{formatMoney(earning.amount_usd, 'USD')}</td><td className="px-4 py-3 text-default-600">{earning.earned_at}</td><td className="px-4 py-3 text-default-600">{earning.category || '—'}</td><td className="max-w-xs truncate px-4 py-3 text-default-500">{earning.description || earning.note || '—'}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button isIconOnly size="sm" variant="light" onPress={() => openEdit(earning)} aria-label="Edit earning"><Pencil size={16} /></Button><Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(earning)} aria-label="Delete earning"><Trash2 size={16} /></Button></div></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No earnings found" text={search ? 'Try a different search term.' : 'Record your first payment to start tracking income.'} /></div>}{pagination.pages > 1 && <div className="flex justify-center border-t border-white/8 p-3"><Pagination showControls page={page} total={pagination.pages} onChange={setPage} /></div>}</div>
    <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit earning' : 'Add earning'}>{error && <div className="mb-4 rounded-xl border border-danger-400/30 bg-danger-400/10 p-3 text-sm text-danger-200">{error}</div>}<form onSubmit={submit} className="space-y-5"><Select label="Platform" isRequired size="md" variant="flat" radius="lg" classNames={modalDropdownClassNames} selectedKeys={new Set([form.platform_id])} onSelectionChange={(keys) => changePlatform(Array.from(keys)[0] || '')}><SelectItem key="">Select platform</SelectItem>{platforms.map((platform) => <SelectItem key={platform.id}>{platform.name}</SelectItem>)}</Select><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="Amount" isRequired type="number" min="0.01" step="0.01" value={form.amount} onValueChange={(value) => setForm({ ...form, amount: value })} /><Autocomplete label="Currency" size="md" variant="flat" radius="lg" selectedKey={form.currency} onSelectionChange={(key) => key && setForm({ ...form, currency: String(key) })} allowsCustomValue={false} placeholder="Currency" inputProps={{ classNames: modalAutocompleteInputClassNames }} classNames={{ selectorButton: modalDropdownClassNames.selectorIcon, popoverContent: modalDropdownClassNames.popoverContent }}>{currencyOptions.map((item) => <AutocompleteItem key={item.code} textValue={`${item.code} ${item.name}`}><span className="inline-flex items-center gap-2"><span className={`fi fi-${currencyCountry(item.code)} dashboard-currency-flag`} />{item.code}</span></AutocompleteItem>)}</Autocomplete></div><Input label="Date earned" isRequired type="date" value={form.earned_at} onValueChange={(value) => setForm({ ...form, earned_at: value })} /><Input label="Category" isRequired value={form.category} onValueChange={(value) => setForm({ ...form, category: value })} placeholder="Project, Bonus, Referral..." /><Textarea label="Description" value={form.note} onValueChange={(value) => setForm({ ...form, note: value })} placeholder="Optional details" /><div className="flex justify-end gap-2 pt-2"><Button variant="light" onPress={() => setModal(false)}>Cancel</Button><Button color="primary" type="submit" isLoading={saving}>{saving ? 'Saving...' : 'Save earning'}</Button></div></form></Modal>
  </div>
}
