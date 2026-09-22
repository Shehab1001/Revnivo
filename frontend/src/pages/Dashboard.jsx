import { ArrowUpRight, CalendarDays, CircleDollarSign, Download, Layers3, ReceiptText, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { Autocomplete, AutocompleteItem, Button, Card, CardBody, Input, Select, SelectItem } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import api from '../services/api'
import { formatMoney, monthLabel } from '../utils/format'
import 'flag-icons/css/flag-icons.min.css'

const tooltipStyle = { backgroundColor: '#18191d', border: '1px solid #303239', borderRadius: 12, color: '#fff' }
const axisStyle = { fill: '#747780', fontSize: 11 }
const platformLineColors = ['#48a4ff', '#b993ff', '#28d8e9', '#37dc8d', '#ffb020', '#ff7096']

const fallbackCurrencies = ['AED', 'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EGP', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'KRW', 'MXN', 'NOK', 'NZD', 'PLN', 'QAR', 'SAR', 'SEK', 'SGD', 'TRY', 'USD', 'ZAR']
const supportedCurrencyCodes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : fallbackCurrencies
const currencyNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null
const currencyCountries = {
  AED: 'AE', AUD: 'AU', BGN: 'BG', BRL: 'BR', CAD: 'CA', CHF: 'CH', CNY: 'CN', CZK: 'CZ', DKK: 'DK', EGP: 'EG', EUR: 'EU', GBP: 'GB', HKD: 'HK', HUF: 'HU', IDR: 'ID', ILS: 'IL', INR: 'IN', JPY: 'JP', KRW: 'KR', KWD: 'KW', MAD: 'MA', MXN: 'MX', MYR: 'MY', NGN: 'NG', NOK: 'NO', NZD: 'NZ', PHP: 'PH', PKR: 'PK', PLN: 'PL', QAR: 'QA', RON: 'RO', RUB: 'RU', SAR: 'SA', SEK: 'SE', SGD: 'SG', THB: 'TH', TRY: 'TR', UAH: 'UA', USD: 'US', VND: 'VN', ZAR: 'ZA', XAF: 'CM', XOF: 'SN', XPF: 'PF', BHD: 'BH', OMR: 'OM', JOD: 'JO', TWD: 'TW', CLP: 'CL', COP: 'CO', PEN: 'PE', ARS: 'AR', ISK: 'IS', KES: 'KE', GHS: 'GH', TZS: 'TZ', UGX: 'UG', ETB: 'ET', DZD: 'DZ', TND: 'TN', LKR: 'LK', BDT: 'BD', NPR: 'NP', MMK: 'MM', KHR: 'KH', LAK: 'LA', MNT: 'MN', BOB: 'BO', PYG: 'PY', UYU: 'UY', CRC: 'CR', DOP: 'DO', GTQ: 'GT', HNL: 'HN', NIO: 'NI', PAB: 'PA', JMD: 'JM', TTD: 'TT', BSD: 'BS', BBD: 'BB', XCD: 'AG', FJD: 'FJ', WST: 'WS', TOP: 'TO', VUV: 'VU', SBD: 'SB', PGK: 'PG', MUR: 'MU', SCR: 'SC', NAD: 'NA', BWP: 'BW', SZL: 'SZ', MZN: 'MZ', ZMW: 'ZM', RWF: 'RW', SOS: 'SO', SDG: 'SD', LYD: 'LY', IQD: 'IQ', IRR: 'IR', AFN: 'AF', KZT: 'KZ', UZS: 'UZ', AZN: 'AZ', GEL: 'GE', AMD: 'AM', BYN: 'BY', MDL: 'MD', ALL: 'AL', BAM: 'BA', RSD: 'RS', MKD: 'MK'
}

function currencyOption(code) {
  let name = code
  try { name = currencyNames?.of(code) || code } catch { name = code }
  return { code, name }
}

function currencyCountry(code) {
  return (currencyCountries[code] || 'XX').toLowerCase()
}

function Metric({ label, value, note, icon: Icon, accent, trend }) {
  const accents = {
    blue: 'bg-[#1688ff]/12 text-[#4aa3ff]',
    violet: 'bg-[#a679ff]/12 text-[#b993ff]',
    cyan: 'bg-[#16c8db]/12 text-[#28d8e9]',
    green: 'bg-[#25d17f]/12 text-[#37dc8d]',
  }
  return <Card className="dashboard-reveal dashboard-panel border-white/6 bg-[#15161a] text-white shadow-none" radius="lg">
    <CardBody className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#858891]">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-[28px]">{value}</p>
          <div className="mt-2 flex items-center gap-2"><p className="truncate text-[11px] text-[#676a73]">{note}</p>{trend && <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${trend.direction === 'up' ? 'bg-[#25d17f]/12 text-[#37dc8d]' : 'bg-[#ff5d73]/12 text-[#ff8090]'}`}>{trend.direction === 'up' ? <TrendingUp size={11}/> : <TrendingDown size={11}/>} {trend.label}</span>}</div>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accents[accent]}`}><Icon size={17}/></span>
      </div>
    </CardBody>
  </Card>
}

function Panel({ children, className = '' }) {
  return <Card className={`dashboard-reveal dashboard-panel border-white/6 bg-[#15161a] text-white shadow-none ${className}`} radius="lg">
    <CardBody className="p-4 sm:p-5">{children}</CardBody>
  </Card>
}

function PanelHeading({ title, subtitle, action }) {
  return <div className="mb-5 flex items-start justify-between gap-3">
    <div><h2 className="text-sm font-semibold text-white">{title}</h2>{subtitle && <p className="mt-1 text-xs text-[#70737c]">{subtitle}</p>}</div>
    {action}
  </div>
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [period, setPeriod] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [platformId, setPlatformId] = useState('all')
  const [activeTab, setActiveTab] = useState('Overview')
  const [error, setError] = useState('')

  const load = async (selectedCurrency = currency, selectedPeriod = period, selectedPlatform = platformId, selectedFrom = dateFrom, selectedTo = dateTo) => {
    setLoading(true)
    setError('')
    try {
      const params = { currency: selectedCurrency, period: selectedPeriod, platform_id: selectedPlatform }
      if (selectedPeriod === 'custom') {
        params.date_from = selectedFrom
        params.date_to = selectedTo
      }
      const res = await api.get('/dashboard/', { params })
      setData(res.data)
      if (res.data.platform_id !== selectedPlatform) setPlatformId(res.data.platform_id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (period !== 'custom' || (dateFrom && dateTo)) load(currency, period, platformId, dateFrom, dateTo)
  }, [currency, period, platformId, dateFrom, dateTo])

  const monthly = useMemo(() => (data?.monthly || []).map((item) => ({ ...item, label: monthLabel(item.month, item.year) })), [data])
  const yearly = useMemo(() => (data?.yearly || []).map((item) => ({ ...item, label: `${monthLabel(item.month, item.year)} ${String(item.year).slice(-2)}` })), [data])
  const platformBreakdown = data?.platform_breakdown || []
  const monthlyByPlatform = useMemo(() => (data?.monthly_by_platform || []).map((item) => ({ ...item, label: `${monthLabel(item.month, item.year)} ${String(item.year).slice(-2)}` })), [data])
  const platformLines = useMemo(() => platformBreakdown.map((platform, index) => ({ ...platform, dataKey: platform.platform_id, color: platformLineColors[index % platformLineColors.length] })), [platformBreakdown])
  const summary = data?.summary || {}
  const currencyOptions = useMemo(() => Array.from(new Set([...(data?.filters?.currencies || []), ...supportedCurrencyCodes])).sort().map(currencyOption), [data])
  const currentMonthIncome = Number(summary.current_month_income || 0)
  const previousMonthIncome = Number(summary.previous_month_income || 0)
  const monthTrend = previousMonthIncome > 0
    ? { direction: currentMonthIncome >= previousMonthIncome ? 'up' : 'down', label: `${Math.abs(((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100).toFixed(1)}%` }
    : currentMonthIncome > 0 ? { direction: 'up', label: 'New' } : null

  if (loading && !data) return <Loading label="Loading your income dashboard..." />

  return <div className="dashboard-page -m-4 min-h-[calc(100vh-4rem)] bg-[#0b0c0f] p-4 text-white sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
    <div className="mx-auto max-w-360 space-y-5">
      <div className="dashboard-reveal flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      
        <div className="flex items-center justify-between gap-3 text-xs text-[#777a84] sm:justify-end"><span className="hidden sm:inline">Live income workspace</span><span className="h-2 w-2 rounded-full bg-[#25d17f] shadow-[0_0_12px_#25d17f]"/><Button size="sm" color="primary" radius="full" onPress={() => navigate('/earnings')} startContent={<ArrowUpRight size={14}/>}>Add earning</Button></div>
      </div>

      <div className="dashboard-reveal flex flex-col gap-4 border-b border-white/8 pb-5 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-[0.22em] text-[#1688ff]">{activeTab}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Good morning, welcome back</h1><p className="mt-1 text-sm text-[#777a84]">Here is what is happening with your income today.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Select aria-label="Platform" className="w-full sm:w-36" size="sm" variant="bordered" selectedKeys={new Set([String(platformId)])} onSelectionChange={(keys) => setPlatformId(Array.from(keys)[0] || 'all')}><SelectItem key="all">All platforms</SelectItem>{(data?.filters?.platforms || []).map((platform) => <SelectItem key={String(platform.id)}>{platform.name}</SelectItem>)}</Select>
          <Autocomplete aria-label="Currency" className="w-full sm:w-44" size="sm" variant="bordered" selectedKey={currency} onSelectionChange={(key) => key && setCurrency(String(key))} allowsCustomValue={false} placeholder="Currency"><AutocompleteItem key="USD" textValue="USD United States Dollar"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`fi fi-${currencyCountry('USD')} dashboard-currency-flag`}/><span>USD</span></span></AutocompleteItem>{currencyOptions.filter((item) => item.code !== 'USD').map((item) => <AutocompleteItem key={item.code} textValue={`${item.code} ${item.name}`}><span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`fi fi-${currencyCountry(item.code)} dashboard-currency-flag`}/><span>{item.code}</span></span></AutocompleteItem>)}</Autocomplete>
          <Select aria-label="Date range" className="col-span-2 w-full sm:col-span-1 sm:w-40" size="sm" variant="bordered" selectedKeys={new Set([period])} onSelectionChange={(keys) => setPeriod(Array.from(keys)[0] || 'all')}>
            <SelectItem key="all">All time</SelectItem>
            <SelectItem key="last_week">Last week</SelectItem>
            <SelectItem key="last_month">Last month</SelectItem>
            <SelectItem key="last_3_months">Last 3 months</SelectItem>
            <SelectItem key="last_year">Last year</SelectItem>
            <SelectItem key="custom">Custom</SelectItem>
          </Select>
          {period === 'custom' && <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-3 sm:grid-cols-2"><Input aria-label="From date" type="date" size="sm" variant="bordered" label="From" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)}/><Input aria-label="To date" type="date" size="sm" variant="bordered" label="To" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)}/></div>}
        </div>
      </div>

      {error && <div className="rounded-xl border border-danger-400/30 bg-danger-400/10 p-3 text-sm text-danger-200">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue" value={formatMoney(summary.total_income, currency)} note={period === 'all' ? 'Across all time' : period === 'custom' ? `${dateFrom || 'Start'} to ${dateTo || 'End'}` : period.replaceAll('_', ' ')} icon={CircleDollarSign} accent="blue"/>
        <Metric label="Transactions" value={summary.transactions || 0} note="Recorded payments" icon={ReceiptText} accent="violet"/>
        <Metric label="Platforms" value={summary.platforms || 0} note="Active platform records" icon={Layers3} accent="cyan"/>
        <Metric label="This month income" value={formatMoney(currentMonthIncome, currency)} note="vs last month" trend={monthTrend} icon={CircleDollarSign} accent="green"/>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.18fr_.82fr]">
        <Panel><PanelHeading title="Sales performance" subtitle={`Monthly income in ${currency}`} action={<Select aria-label="Chart period" size="sm" className="w-32" variant="flat" defaultSelectedKeys={['all']}><SelectItem key="all">All time</SelectItem></Select>}/>{yearly.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearly} barCategoryGap="22%"><CartesianGrid stroke="#25272c" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisStyle}/><YAxis axisLine={false} tickLine={false} tick={axisStyle}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(value, currency)}/><Bar dataKey="total" fill="#1688ff" radius={[7, 7, 2, 2]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No earnings history" text="Add dated earnings to build this chart."/>}</Panel>
        <Panel><PanelHeading title="Income by platform" subtitle="Each line represents a platform" action={<Button isIconOnly size="sm" variant="light" className="text-[#858891]" onPress={() => load()} aria-label="Refresh chart"><RefreshCw size={15}/></Button>}/>{monthlyByPlatform.length && platformLines.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyByPlatform}><CartesianGrid stroke="#25272c" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisStyle}/><YAxis axisLine={false} tickLine={false} tick={axisStyle}/><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatMoney(value, currency), platformLines.find((platform) => platform.dataKey === name)?.name || name]}/><Legend wrapperStyle={{ color: '#9da0a8', fontSize: 11 }} formatter={(value) => platformLines.find((platform) => platform.dataKey === value)?.name || value}/>{platformLines.map((platform) => <Line key={platform.dataKey} type="monotone" dataKey={platform.dataKey} name={platform.dataKey} stroke={platform.color} strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 4 }}/>)}</LineChart></ResponsiveContainer></div> : <EmptyState title="No platform trend" text="Add earnings to see a line for each platform."/>}</Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Panel><PanelHeading title="Platform mix" subtitle="Where your selected income comes from"/>{platformBreakdown.length ? <div className="space-y-4">{platformBreakdown.slice(0, 5).map((platform, index) => { const total = platformBreakdown.reduce((sum, item) => sum + Number(item.total || 0), 0); const percent = total ? Math.round((Number(platform.total || 0) / total) * 100) : 0; return <div key={platform.platform_id}><div className="mb-2 flex items-center justify-between text-xs"><span className="truncate text-[#c5c7cc]">{platform.name}</span><span className="text-[#777a84]">{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#292b30]"><div className={`h-full rounded-full ${['bg-[#1688ff]', 'bg-[#a679ff]', 'bg-[#16c8db]', 'bg-[#25d17f]', 'bg-[#ffb020]'][index % 5]}`} style={{ width: `${percent}%` }}/></div></div>})}</div> : <EmptyState title="No platform totals" text="Your platform mix will appear here."/>}</Panel>
        <Panel><PanelHeading title="Recent earnings" subtitle="Latest entries for the selected filters" action={<Button size="sm" variant="flat" color="primary" onPress={() => navigate('/earnings')} endContent={<ArrowUpRight size={14}/>}>View all</Button>}/>{data?.recent?.length ? <div className="overflow-x-auto"><table className="w-full min-w-130 text-left"><thead><tr className="border-b border-white/8 text-[10px] uppercase tracking-wider text-[#70737c]"><th className="pb-3 font-medium">Description</th><th className="pb-3 font-medium">Platform</th><th className="pb-3 font-medium">Date</th><th className="pb-3 text-right font-medium">Amount</th></tr></thead><tbody className="divide-y divide-white/6">{data.recent.map((item) => <tr key={item.id} className="text-xs transition hover:bg-white/2.5"><td className="py-3 pr-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#1688ff]/12 text-[#4aa3ff]"><ReceiptText size={13}/></span><span className="truncate text-[#d8d9dd]">{item.category || 'Uncategorized'}</span></div></td><td className="py-3 pr-3 text-[#94979f]">{item.platform_name || '—'}</td><td className="py-3 pr-3 text-[#777a84]">{item.earned_at}</td><td className="py-3 text-right font-semibold text-[#35d989]">+{formatMoney(item.amount_usd, 'USD')}</td></tr>)}</tbody></table></div> : <EmptyState title="No earnings yet" text="Add your first payment to start the timeline."/>}</Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4 text-xs text-[#62656e]"><span>Updated just now from your income records</span><div className="flex items-center gap-2"><Button size="sm" variant="light" className="text-[#777a84]" startContent={<CalendarDays size={14}/>}>{period === 'all' ? 'All time' : period.replaceAll('_', ' ')}</Button><Button size="sm" variant="light" className="text-[#777a84]" startContent={<Download size={14}/>} onPress={() => navigate('/earnings')}>Export view</Button></div></div>
    </div>
  </div>
}
