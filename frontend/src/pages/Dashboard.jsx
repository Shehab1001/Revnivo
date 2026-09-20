import { ArrowUpRight, CircleDollarSign, Layers3, ReceiptText, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import api from '../services/api'
import { formatMoney, monthLabel } from '../utils/format'

const chartTooltipStyle = { backgroundColor: '#000', border: '1px solid #333', color: '#fff' }
const chartTooltipLabelStyle = { color: '#fff' }
const chartTooltipItemStyle = { color: '#fff' }

function StatCard({ title, value, helper, icon: Icon }) {
  return <div className="card p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>{helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}</div><div className="rounded-xl bg-[#e8f8ed] p-2.5 text-[#23C55E] dark:bg-[#23462e] dark:text-[#7bea9d]"><Icon size={20} /></div></div></div>
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [year, setYear] = useState('all')
  const [platformId, setPlatformId] = useState('all')
  const [error, setError] = useState('')

  const load = async (c = currency, y = year, p = platformId) => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/dashboard/', { params: { currency: c, year: y, platform_id: p } })
      setData(res.data)
      if (!res.data.filters.currencies.includes(c) && res.data.filters.currencies.length) setCurrency(res.data.filters.currencies[0])
      if (res.data.platform_id !== p) setPlatformId(res.data.platform_id)
    } catch (err) { setError(err.response?.data?.detail || 'Could not load dashboard.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(currency, year, platformId) }, [currency, year, platformId])

  const monthly = useMemo(() => (data?.monthly || []).map((r) => ({ ...r, label: `${monthLabel(r.month, r.year)} ${String(r.year).slice(-2)}` })), [data])
  const yearly = useMemo(() => (data?.yearly || []).map((r) => ({ ...r, label: `${monthLabel(r.month, r.year)} ${r.year}` })), [data])
  const platformBreakdown = data?.platform_breakdown || []

  if (loading && !data) return <Loading label="Loading your income dashboard..." />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-sm font-semibold text-[#16843d] dark:text-[#7bea9d]">Overview</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Income Dashboard</h1><p className="mt-1 text-sm text-slate-500">Track your earnings without mixing different currencies.</p></div>
        <div className="flex gap-2">
          <select className="input w-40" value={platformId} onChange={(e) => setPlatformId(e.target.value)}><option value="all">All platforms</option>{(data?.filters?.platforms || []).map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select>
          <select className="input w-28" value={currency} onChange={(e) => setCurrency(e.target.value)}>{(data?.filters?.currencies?.length ? data.filters.currencies : ['USD']).map((c) => <option key={c}>{c}</option>)}</select>
          <select className="input w-32" value={year} onChange={(e) => setYear(e.target.value)}><option value="all">All years</option>{(data?.filters?.years || []).map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total income" value={formatMoney(data?.summary?.total_income, currency)} helper={year === 'all' ? 'Across all years' : `During ${year}`} icon={CircleDollarSign} />
        <StatCard title="Transactions" value={data?.summary?.transactions || 0} helper="Recorded payments" icon={ReceiptText} />
        <StatCard title="Platforms" value={data?.summary?.platforms || 0} helper="Active platform records" icon={Layers3} />
        <StatCard title="Top platform" value={data?.summary?.best_platform || '—'} helper={data?.summary?.best_platform ? formatMoney(data.summary.best_platform_total, currency) : 'No earnings yet'} icon={Trophy} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2"><div className="mb-10"><h2 className="font-bold text-slate-900 dark:text-white">Earnings growth</h2><p className="text-sm text-slate-500">Income grouped by month across all years in {currency}.</p></div>{yearly.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearly}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} /><XAxis dataKey="label" angle={-35} textAnchor="end" height={60} interval="preserveStartEnd" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} formatter={(v) => formatMoney(v, currency)} /><Bar dataKey="total" fill="#23C55E" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No yearly history" text="Your monthly history will build automatically as you add dated earnings." />}</div>
        <div className="card p-5"><div className="mb-5"><h2 className="font-bold text-slate-900 dark:text-white">Income by platform</h2><p className="text-sm text-slate-500">Share of selected income.</p></div>{platformBreakdown.length ? <><div className="h-50"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={platformBreakdown} dataKey="total" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>{platformBreakdown.map((_, i) => <Cell key={i} fill={['#23C55E', '#16A34A', '#86EFAC', '#15803D', '#4ADE80'][i % 5]} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} formatter={(v) => formatMoney(v, currency)} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{platformBreakdown.slice(0, 5).map((p) => <div key={p.platform_id} className="flex items-center justify-between text-sm"><span className="truncate text-slate-600 dark:text-slate-300">{p.name}</span><span className="font-semibold text-slate-900 dark:text-white">{formatMoney(p.total, currency)}</span></div>)}</div></> : <EmptyState title="No platform totals" text="Your platform mix will appear here." />}</div>

      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-12"><h2 className="font-bold text-slate-900 dark:text-white">Monthly earnings</h2><p className="text-sm text-slate-500">Income grouped by month for the selected filter.</p></div>
          {monthly.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#23C55E" stopOpacity={0.3} /><stop offset="95%" stopColor="#23C55E" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} /><XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} itemStyle={chartTooltipItemStyle} formatter={(v) => formatMoney(v, currency)} /><Area type="monotone" dataKey="total" stroke="#23C55E" fill="url(#incomeGradient)" strokeWidth={3} /></AreaChart></ResponsiveContainer></div> : <EmptyState title="No monthly data" text="Add earnings to see your month-by-month trend." />}
        </div>

        <div className="card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">Recent earnings</h2><p className="text-sm text-slate-500">Latest entries for the selected filters.</p></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={() => navigate('/earnings')} title="Open earnings"><ArrowUpRight size={18}/></button></div>{data?.recent?.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{data.recent.map((e) => <div key={e.id} className="flex items-center justify-between py-3"><div className="min-w-0">{platformId === 'all' && <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{e.platform_name}</p>}<p className="truncate text-sm text-slate-600 dark:text-slate-300">{e.category || 'Uncategorized'}</p><p className="text-xs text-slate-400">{e.earned_at}</p></div><span className="ml-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(e.amount_usd, 'USD')}</span></div>)}</div> : <EmptyState title="No earnings yet" text="Add your first payment to start the timeline." />}</div>


      </div>


    </div>
  )
}
