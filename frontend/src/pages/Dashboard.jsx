import { ArrowUpRight, CalendarDays, CircleDollarSign, Clock3, Download, Eye, EyeOff, GripVertical, Lightbulb, Layers3, ReceiptText, RotateCcw, Save, Settings2, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { Autocomplete, AutocompleteItem, Button, Card, CardBody, Input, Select, SelectItem, Switch } from '@heroui/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import api from '../services/api'
import { useTheme } from '../contexts/ThemeContext'
import { formatMoney, monthLabel } from '../utils/format'
import { currencyCountry, detectLocalCurrency, getCurrencyOptions } from '../utils/currencies'
import 'flag-icons/css/flag-icons.min.css'

const platformLineColors = ['#48a4ff', '#b993ff', '#28d8e9', '#37dc8d', '#ffb020', '#ff7096']

const DEFAULT_DASHBOARD_WIDGETS = [
  'pending',
  'goals',
  'insights',
  'charts',
  'platform_mix',
]

const DASHBOARD_WIDGET_LABELS = {
  pending: 'Pending',
  goals: 'Goals',
  insights: 'Insights',
  charts: 'Charts',
  platform_mix: 'Platform mix',
}


function splitMetricValue(value) {
  const text = String(value ?? '')
  const firstDigit = text.search(/\d/)

  if (firstDigit === -1) {
    return { prefix: '', amount: text, suffix: '' }
  }

  let lastDigit = -1
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (/\d/.test(text[index])) {
      lastDigit = index
      break
    }
  }

  return {
    prefix: text.slice(0, firstDigit),
    amount: text.slice(firstDigit, lastDigit + 1),
    suffix: text.slice(lastDigit + 1),
  }
}


function Metric({ label, value, note, icon: Icon, accent, trend, visible }) {
  const accents = {
    blue: 'bg-primary/10 text-primary',
    violet: 'bg-secondary/10 text-secondary',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    green: 'bg-success/10 text-success',
  }

  const valueLength = String(value ?? '').length
  const { prefix, amount, suffix } = splitMetricValue(value)

  const valueSize =
    valueLength > 28
      ? 'text-base sm:text-lg'
      : valueLength > 20
        ? 'text-lg sm:text-xl'
        : valueLength > 14
          ? 'text-xl sm:text-2xl'
          : 'text-2xl sm:text-[28px]'

  return <Card className="dashboard-reveal dashboard-panel border border-default-200/60 bg-content1 text-foreground shadow-sm dark:border-white/5 dark:shadow-none" radius="lg">
    <CardBody className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-default-500">{label}</p>

          <p
            className={`mt-2 max-w-full whitespace-normal break-words [overflow-wrap:anywhere] font-semibold leading-tight tracking-tight tabular-nums ${valueSize}`}
            title={visible ? String(value) : undefined}
          >
            {visible ? (
              <>
                {prefix && (
                  <span className="mr-1 align-middle text-[0.58em] font-semibold tracking-normal text-default-500">
                    {prefix.trim()}
                  </span>
                )}
                <span>{amount}</span>
                {suffix && (
                  <span className="ml-1 align-middle text-[0.58em] font-semibold tracking-normal text-default-500">
                    {suffix.trim()}
                  </span>
                )}
              </>
            ) : (
              '* * * * *'
            )}
          </p>

          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-[11px] text-default-400">
              {visible ? note : '*****'}
            </p>

            {visible && trend && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  trend.direction === 'up'
                    ? 'bg-success/10 text-success'
                    : 'bg-danger/10 text-danger'
                }`}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp size={11} />
                ) : (
                  <TrendingDown size={11} />
                )}
                {trend.label}
              </span>
            )}
          </div>
        </div>

        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accents[accent]}`}>
          <Icon size={17} />
        </span>
      </div>
    </CardBody>
  </Card>
}

function Panel({ children, className = '' }) {
  return <Card className={`dashboard-reveal dashboard-panel border border-default-200/60 bg-content1 text-foreground shadow-sm dark:border-white/5 dark:shadow-none ${className}`} radius="lg">
    <CardBody className="p-4 sm:p-5">{children}</CardBody>
  </Card>
}

function PanelHeading({ title, subtitle, action }) {
  return <div className="mb-5 flex items-start justify-between gap-3">
    <div><h2 className="text-sm font-semibold text-foreground">{title}</h2>{subtitle && <p className="mt-1 text-xs text-default-500">{subtitle}</p>}</div>
    {action}
  </div>
}

export default function Dashboard() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const chartTheme = theme === 'dark'
    ? { tooltip: { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 12, color: '#f4f4f5' }, axis: { fill: '#a1a1aa', fontSize: 11 }, grid: '#27272a', legend: '#a1a1aa', primary: '#338ef7' }
    : { tooltip: { backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 12, color: '#18181b' }, axis: { fill: '#71717a', fontSize: 11 }, grid: '#e4e4e7', legend: '#71717a', primary: '#006fee' }
  const tooltipStyle = chartTheme.tooltip
  const axisStyle = chartTheme.axis
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const localCurrency = useMemo(() => detectLocalCurrency(), [])
  const [currency, setCurrency] = useState(localCurrency)
  const [currencySearch, setCurrencySearch] = useState('')
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [period, setPeriod] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [platformId, setPlatformId] = useState('all')
  const [activeTab, setActiveTab] = useState('Overview')
  const [error, setError] = useState('')
  const [dataVisible, setDataVisible] = useState(true)
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalForm, setGoalForm] = useState({
    monthly_goal: '',
    yearly_goal: '',
  })
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const [draggingWidget, setDraggingWidget] = useState(null)
  const [dashboardPreferences, setDashboardPreferences] = useState({
    order: DEFAULT_DASHBOARD_WIDGETS,
    hidden: [],
  })
  const effectiveCurrency = currency || localCurrency
  const visibilityStorageKey = user?.id ? `revnivo_dashboard_data_visible_${user.id}` : ''

  useEffect(() => {
    if (!visibilityStorageKey) return
    setDataVisible(localStorage.getItem(visibilityStorageKey) !== 'false')
  }, [visibilityStorageKey])

  useEffect(() => {
    if (!user?.id) return

    api
      .get('/dashboard/preferences/')
      .then(({ data: preferences }) => {
        setDashboardPreferences({
          order: preferences.order || DEFAULT_DASHBOARD_WIDGETS,
          hidden: preferences.hidden || [],
        })
      })
      .catch(() => {
        setDashboardPreferences({
          order: DEFAULT_DASHBOARD_WIDGETS,
          hidden: [],
        })
      })
  }, [user?.id])

  const saveDashboardPreferences = async (nextPreferences) => {
    const previous = dashboardPreferences
    setDashboardPreferences(nextPreferences)
    setPreferencesSaving(true)

    try {
      const { data: saved } = await api.put(
        '/dashboard/preferences/',
        nextPreferences
      )
      setDashboardPreferences(saved)
    } catch {
      setDashboardPreferences(previous)
      setError('Could not save dashboard customization.')
    } finally {
      setPreferencesSaving(false)
    }
  }

  const toggleDashboardWidget = (widgetId) => {
    const hidden = dashboardPreferences.hidden.includes(widgetId)
      ? dashboardPreferences.hidden.filter((item) => item !== widgetId)
      : [...dashboardPreferences.hidden, widgetId]

    saveDashboardPreferences({
      ...dashboardPreferences,
      hidden,
    })
  }

  const moveDashboardWidget = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return

    const order = [...dashboardPreferences.order]
    const sourceIndex = order.indexOf(sourceId)
    const targetIndex = order.indexOf(targetId)

    if (sourceIndex < 0 || targetIndex < 0) return

    order.splice(sourceIndex, 1)
    order.splice(targetIndex, 0, sourceId)

    saveDashboardPreferences({
      ...dashboardPreferences,
      order,
    })
  }

  const resetDashboardPreferences = () => {
    saveDashboardPreferences({
      order: DEFAULT_DASHBOARD_WIDGETS,
      hidden: [],
    })
  }

  const toggleDataVisibility = (visible) => {
    setDataVisible(visible)
    if (visibilityStorageKey) {
      localStorage.setItem(visibilityStorageKey, String(visible))
    }
  }

  const load = async (selectedCurrency = effectiveCurrency, selectedPeriod = period, selectedPlatform = platformId, selectedFrom = dateFrom, selectedTo = dateTo) => {
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
    if (period !== 'custom' || (dateFrom && dateTo)) load(effectiveCurrency, period, platformId, dateFrom, dateTo)
  }, [currency, period, platformId, dateFrom, dateTo])

  useEffect(() => {
    if (!data?.goals) return
    setGoalForm({
      monthly_goal: data.goals.monthly_goal ? String(data.goals.monthly_goal) : '',
      yearly_goal: data.goals.yearly_goal ? String(data.goals.yearly_goal) : '',
    })
  }, [data?.goals?.monthly_goal, data?.goals?.yearly_goal])

  const saveGoals = async () => {
    setGoalSaving(true)
    setError('')
    try {
      await api.put('/goals/', {
        monthly_goal: Number(goalForm.monthly_goal || 0),
        yearly_goal: Number(goalForm.yearly_goal || 0),
        currency: effectiveCurrency,
      })
      setGoalEditing(false)
      await load(effectiveCurrency, period, platformId, dateFrom, dateTo)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save income goals.')
    } finally {
      setGoalSaving(false)
    }
  }

  const monthly = useMemo(() => (data?.monthly || []).map((item) => ({ ...item, label: monthLabel(item.month, item.year) })), [data])
  const yearly = useMemo(() => (data?.yearly || []).map((item) => ({ ...item, label: `${monthLabel(item.month, item.year)} ${String(item.year).slice(-2)}` })), [data])
  const platformBreakdown = data?.platform_breakdown || []
  const monthlyByPlatform = useMemo(() => (data?.monthly_by_platform || []).map((item) => ({ ...item, label: `${monthLabel(item.month, item.year)} ${String(item.year).slice(-2)}` })), [data])
  const platformLines = useMemo(() => platformBreakdown.map((platform, index) => ({ ...platform, dataKey: platform.platform_id, color: platformLineColors[index % platformLineColors.length] })), [platformBreakdown])
  const summary = data?.summary || {}
  const goals = data?.goals || {}
  const insights = data?.insights || []
  const monthlyGoalProgress = goals.monthly_goal > 0
    ? Math.min((Number(goals.current_month_net || 0) / Number(goals.monthly_goal)) * 100, 100)
    : 0
  const yearlyGoalProgress = goals.yearly_goal > 0
    ? Math.min((Number(goals.current_year_net || 0) / Number(goals.yearly_goal)) * 100, 100)
    : 0
  const currencyOptions = useMemo(() => getCurrencyOptions(), [])
  const currencySearchOptions = useMemo(() => {
    let regionNames = null

    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regionNames = null
    }

    return currencyOptions.map((item) => {
      const countryCode = currencyCountry(item.code)
      const countryName =
        regionNames && countryCode
          ? regionNames.of(String(countryCode).toUpperCase()) || ''
          : ''

      return {
        ...item,
        searchText: `${item.code} ${item.name || ''} ${countryName}`.trim(),
      }
    })
  }, [currencyOptions])
  const currentMonthIncome = Number(summary.current_month_income || 0)
  const previousMonthIncome = Number(summary.previous_month_income || 0)
  const monthTrend = previousMonthIncome > 0
    ? { direction: currentMonthIncome >= previousMonthIncome ? 'up' : 'down', label: `${Math.abs(((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100).toFixed(1)}%` }
    : currentMonthIncome > 0 ? { direction: 'up', label: 'New' } : null

  if (loading && !data) return <Loading label="Loading your income dashboard..." />

  return <div className="dashboard-page -m-4 min-h-[calc(100vh-4rem)] bg-background p-4 text-foreground transition-colors duration-300 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
    <div className="mx-auto max-w-360 space-y-5">
      <div className="dashboard-reveal flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      
        <div className="flex items-center justify-between gap-3 text-xs text-default-500 sm:justify-end"><span className="hidden sm:inline">Live income workspace</span><span className="live-income-dot h-2 w-2 rounded-full bg-success shadow-[0_0_12px_hsl(var(--heroui-success))]"/><Button size="sm" color="primary" radius="full" onPress={() => navigate('/earnings')} startContent={<ArrowUpRight size={14}/>}>Add earning</Button></div>
      </div>

      <div className="dashboard-reveal flex flex-col gap-4 border-b border-divider pb-5 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">{activeTab}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Welcome back, {user?.name || 'there'}</h1><p className="mt-1 text-sm text-default-500">Here is what is happening with your income today.</p></div>
        
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:items-end">
          <div className="flex items-center justify-end gap-2">
            <Switch
              isSelected={!dataVisible}
              onValueChange={(hidden) => toggleDataVisibility(!hidden)}
              size="sm"
              classNames={{ label: 'text-sm font-medium text-default-600' }}
            >
              {dataVisible ? 'Hide data' : 'Unhide data'}
            </Switch>
            <Button
              size="sm"
              variant="flat"
              radius="lg"
              onPress={() => setCustomizeOpen(true)}
              startContent={<Settings2 size={14}/>}
            >
              Customize
            </Button>
          </div>

          <div className="flex w-full flex-wrap justify-end gap-2">
            <Select
              aria-label="Platform"
              className="w-full sm:w-44"
              size="md"
              variant="flat"
              radius="lg"
              startContent={<Layers3 size={16} className="shrink-0 text-default-600 dark:text-zinc-100" />}
              selectedKeys={new Set([String(platformId)])}
              onSelectionChange={(keys) => setPlatformId(Array.from(keys)[0] || 'all')}
              classNames={{
                trigger:
                  'h-11 min-h-11 rounded-xl border-0 bg-[#eceef2] px-3.5 shadow-none transition-colors data-[hover=true]:bg-[#e4e7ec] dark:bg-content1 dark:data-[hover=true]:bg-default-100',
                value:
                  'text-sm font-semibold text-foreground dark:text-white',
                selectorIcon:
                  'right-3 text-default-500 dark:text-zinc-200',
                popoverContent:
                  'rounded-2xl border border-default-200 bg-content1 p-1 shadow-xl dark:border-white/10 dark:bg-[#202023]',
              }}
            >
              <SelectItem key="all">All platforms</SelectItem>
              {(data?.filters?.platforms || []).map((platform) => (
                <SelectItem key={String(platform.id)}>{platform.name}</SelectItem>
              ))}
            </Select>

            <Select
              aria-label="Date range"
              className="w-full sm:w-44" 
              size="md"
              variant="flat"
              radius="lg"
              startContent={<CalendarDays size={16} className="shrink-0 text-default-600 dark:text-zinc-100" />}
              selectedKeys={new Set([period])}
              onSelectionChange={(keys) => setPeriod(Array.from(keys)[0] || 'all')}
              classNames={{
                trigger:
                  'h-11 min-h-11 rounded-xl border-0 bg-[#eceef2] px-3.5 shadow-none transition-colors data-[hover=true]:bg-[#e4e7ec] dark:bg-content1 dark:data-[hover=true]:bg-default-100',
                value:
                  'text-sm font-semibold text-foreground dark:text-white',
                selectorIcon:
                  'right-3 text-default-500 dark:text-zinc-200',
                popoverContent:
                  'rounded-2xl border border-default-200 bg-content1 p-1 shadow-xl dark:border-white/10 dark:bg-[#202023]',
              }}
            >
              <SelectItem key="all">All time</SelectItem>
              <SelectItem key="last_week">Last week</SelectItem>
              <SelectItem key="last_month">Last month</SelectItem>
              <SelectItem key="last_3_months">Last 3 months</SelectItem>
              <SelectItem key="last_year">Last year</SelectItem>
              <SelectItem key="custom">Custom</SelectItem>
            </Select>

            <Autocomplete
              aria-label="Currency"
              className="w-full sm:w-44"
              size="md"
              variant="flat"
              radius="lg"
              isClearable={false}
              allowsCustomValue={false}
              selectedKey={currency || null}
              inputValue={currencyOpen ? currencySearch : currency}
              onInputChange={(value) => {
                if (currencyOpen) setCurrencySearch(value)
              }}
              onSelectionChange={(key) => {
                if (!key) return
                const selected = String(key)
                setCurrency(selected)
                setCurrencySearch(selected)
              }}
              onOpenChange={(isOpen) => {
                setCurrencyOpen(isOpen)
                if (isOpen) setCurrencySearch('')
              }}
              defaultFilter={(textValue, inputValue) =>
                textValue.toLowerCase().includes(inputValue.trim().toLowerCase())
              }
              inputProps={{
                startContent: (
                  <CircleDollarSign
                    size={16}
                    className="shrink-0 text-default-600 dark:text-zinc-100"
                  />
                ),
                classNames: {
                  inputWrapper:
                    'h-11 min-h-11 rounded-xl border-0 bg-[#eceef2] px-3.5 shadow-none transition-colors data-[hover=true]:bg-[#e4e7ec] group-data-[focus=true]:bg-[#eceef2] dark:bg-content1 dark:data-[hover=true]:bg-default-100 dark:group-data-[focus=true]:bg-content1',
                  input:
                    'text-sm font-semibold text-foreground placeholder:text-default-500 dark:text-white',
                  innerWrapper: 'gap-2',
                },
              }}
              classNames={{
                selectorButton:
                  'text-default-500 dark:text-zinc-200',
                popoverContent:
                  'rounded-2xl border border-default-200 bg-content1 p-1 shadow-xl dark:border-white/10 dark:bg-[#202023]',
              }}
            >
              {currencySearchOptions.map((item) => (
                <AutocompleteItem
                  key={item.code}
                  textValue={item.searchText}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`fi fi-${currencyCountry(item.code)} dashboard-currency-flag`}
                    />
                    <span className="font-semibold">{item.code}</span>
                  </span>
                </AutocompleteItem>
              ))}
            </Autocomplete>
            {period === 'custom' && (
              <div className="ml-auto grid w-full grid-cols-2 gap-2 sm:w-[320px]">
                <Input
                  aria-label="From date"
                  type="date"
                  size="sm"
                  variant="bordered"
                  radius="lg"
                  label="From"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  classNames={{
                    inputWrapper:
                      'h-11 min-h-11 border-default-300 bg-background/50 dark:border-white/15 dark:bg-[#151517]',
                  }}
                />
                <Input
                  aria-label="To date"
                  type="date"
                  size="sm"
                  variant="bordered"
                  radius="lg"
                  label="To"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(event) => setDateTo(event.target.value)}
                  classNames={{
                    inputWrapper:
                      'h-11 min-h-11 border-default-300 bg-background/50 dark:border-white/15 dark:bg-[#151517]',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Gross revenue" value={formatMoney(summary.total_income, effectiveCurrency)} note={period === 'all' ? 'Paid income across all time' : period === 'custom' ? `${dateFrom || 'Start'} to ${dateTo || 'End'}` : period.replaceAll('_', ' ')} icon={CircleDollarSign} accent="blue" visible={dataVisible}/>
        <Metric label="Net income" value={formatMoney(summary.net_income, effectiveCurrency)} note="After platform and payment fees" icon={CircleDollarSign} accent="green" visible={dataVisible}/>
        <Metric label="This month income" value={formatMoney(currentMonthIncome, effectiveCurrency)} note="vs last month" trend={monthTrend} icon={TrendingUp} accent="green" visible={dataVisible}/>
        <Metric label="Transactions" value={summary.transactions || 0} note="Paid transactions" icon={ReceiptText} accent="violet" visible={dataVisible}/>
        <Metric label="Platforms" value={summary.platforms || 0} note="Active platform records" icon={Layers3} accent="cyan" visible={dataVisible}/>
      </div>

      <div className="flex flex-col gap-4">
        {dashboardPreferences.order.map((widgetId) => {
          if (dashboardPreferences.hidden.includes(widgetId)) {
            return null
          }

          if (widgetId === 'pending') {
            return (
              <div key={widgetId} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label="Pending"
                  value={formatMoney(summary.pending_net_income, effectiveCurrency)}
                  note={`${summary.pending_count || 0} expected payment${summary.pending_count === 1 ? '' : 's'}${summary.overdue_count ? ` · ${summary.overdue_count} overdue` : ''}`}
                  icon={Clock3}
                  accent="violet"
                  visible={dataVisible}
                />
              </div>
            )
          }

          if (widgetId === 'goals') {
            return (
              <Panel key={widgetId}>
                <PanelHeading
                  title="Income goals"
                  subtitle={`Track progress using net income in ${effectiveCurrency}`}
                  action={
                    goalEditing ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="light" onPress={() => setGoalEditing(false)}>Cancel</Button>
                        <Button size="sm" color="primary" isLoading={goalSaving} onPress={saveGoals} startContent={!goalSaving ? <Save size={14}/> : null}>Save</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="flat" color="primary" onPress={() => setGoalEditing(true)} startContent={<Target size={14}/>}>Set goals</Button>
                    )
                  }
                />

                {goalEditing ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Monthly goal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={goalForm.monthly_goal}
                      onValueChange={(value) => setGoalForm((current) => ({ ...current, monthly_goal: value }))}
                      startContent={<span className="text-xs text-default-400">{effectiveCurrency}</span>}
                    />
                    <Input
                      label="Yearly goal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={goalForm.yearly_goal}
                      onValueChange={(value) => setGoalForm((current) => ({ ...current, yearly_goal: value }))}
                      startContent={<span className="text-xs text-default-400">{effectiveCurrency}</span>}
                    />
                  </div>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[
                      ['Monthly', goals.current_month_net || 0, goals.monthly_goal || 0, monthlyGoalProgress],
                      ['Yearly', goals.current_year_net || 0, goals.yearly_goal || 0, yearlyGoalProgress],
                    ].map(([label, current, target, progress]) => (
                      <div key={label} className="rounded-2xl border border-default-200/70 bg-default-50/50 p-4 dark:border-white/8 dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-foreground">{label} goal</span>
                          <span className="text-xs font-semibold text-primary">{target > 0 ? `${Math.round(progress)}%` : 'Not set'}</span>
                        </div>
                        <div className="mt-3 text-sm font-semibold text-foreground">
                          {formatMoney(current, effectiveCurrency)}
                          <span className="ml-1 text-xs font-normal text-default-400">/ {target > 0 ? formatMoney(target, effectiveCurrency) : '—'}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-default-200/70">
                          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${target > 0 ? progress : 0}%` }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )
          }

          if (widgetId === 'insights') {
            return (
              <Panel key={widgetId}>
                <PanelHeading title="Smart insights" subtitle="Automatic observations from your income data" action={<Lightbulb size={17} className="text-warning"/>}/>
                {insights.length ? (
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    {insights.map((insight, index) => (
                      <div key={index} className="flex gap-3 rounded-xl border border-default-200/60 bg-default-50/50 p-3 text-xs leading-5 text-default-600 dark:border-white/6 dark:bg-white/[0.02]">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Lightbulb size={13}/></span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Insights are warming up" text="Add more earnings to generate useful observations."/>
                )}
              </Panel>
            )
          }

          if (widgetId === 'charts') {
            return (
              <div key={widgetId} className="grid gap-4 xl:grid-cols-[1.18fr_.82fr]">
                <Panel><PanelHeading title="Sales performance" subtitle={`Monthly income in ${effectiveCurrency}`}/>{yearly.length ? <div className={`h-72 transition-all duration-300 ${dataVisible ? '' : 'pointer-events-none select-none blur-md'} `}><ResponsiveContainer width="100%" height="100%"><BarChart data={yearly} barCategoryGap="22%"><CartesianGrid stroke={chartTheme.grid} vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisStyle}/><YAxis axisLine={false} tickLine={false} tick={axisStyle}/><Tooltip contentStyle={tooltipStyle} labelStyle={{ color: chartTheme.tooltip.color }} itemStyle={{ color: chartTheme.tooltip.color }} formatter={(value) => formatMoney(value, effectiveCurrency)}/><Bar dataKey="total" fill={chartTheme.primary} radius={[7, 7, 2, 2]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No earnings history" text="Add dated earnings to build this chart."/>}</Panel>
                <Panel><PanelHeading title="Income by platform" subtitle="Each line represents a platform"/>{monthlyByPlatform.length && platformLines.length ? <div className={`h-72 transition-all duration-300 ${dataVisible ? '' : 'pointer-events-none select-none blur-md'} `}><ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyByPlatform}><CartesianGrid stroke={chartTheme.grid} vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisStyle}/><YAxis axisLine={false} tickLine={false} tick={axisStyle}/><Tooltip contentStyle={tooltipStyle} labelStyle={{ color: chartTheme.tooltip.color }} itemStyle={{ color: chartTheme.tooltip.color }} formatter={(value, name) => [formatMoney(value, effectiveCurrency), platformLines.find((platform) => platform.dataKey === name)?.name || name]}/><Legend wrapperStyle={{ color: chartTheme.legend, fontSize: 11 }} formatter={(value) => platformLines.find((platform) => platform.dataKey === value)?.name || value}/>{platformLines.map((platform) => <Line key={platform.dataKey} type="monotone" dataKey={platform.dataKey} name={platform.dataKey} stroke={platform.color} strokeWidth={2.5} dot={false} connectNulls activeDot={{ r: 4 }}/>)}</LineChart></ResponsiveContainer></div> : <EmptyState title="No platform trend" text="Add earnings to see a line for each platform."/>}</Panel>
              </div>
            )
          }

          if (widgetId === 'platform_mix') {
            return (
              <Panel key={widgetId}>
                <PanelHeading title="Platform mix" subtitle="Where your selected income comes from"/>
                {platformBreakdown.length ? (
                  <div className={`grid gap-x-8 gap-y-5 transition-all duration-300 md:grid-cols-2 ${dataVisible ? '' : 'pointer-events-none select-none blur-md'} `}>
                    {platformBreakdown.slice(0, 6).map((platform, index) => {
                      const total = platformBreakdown.reduce((sum, item) => sum + Number(item.total || 0), 0)
                      const percent = total ? Math.round((Number(platform.total || 0) / total) * 100) : 0
                      const barColors = ['bg-primary', 'bg-secondary', 'bg-cyan-500', 'bg-success', 'bg-warning']
                      return <div key={platform.platform_id} className="group"><div className="mb-2.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-foreground/85">{platform.name}</span><span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-semibold text-default-500 ring-1 ring-inset ring-default-200/70">{percent}%</span></div><div className="relative h-2.5 overflow-hidden rounded-full bg-default-200/60"><div className={`relative h-full rounded-full ${barColors[index % barColors.length]} transition-all duration-700 ease-out group-hover:brightness-110`} style={{ width: `${percent}%` }}><div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"/></div></div></div>
                    })}
                  </div>
                ) : (
                  <EmptyState title="No platform totals" text="Your platform mix will appear here."/>
                )}
              </Panel>
            )
          }

          return null
        })}
      </div>

      <Panel>
        <PanelHeading title="Recent earnings" subtitle="Latest entries for the selected filters" action={<Button size="sm" variant="flat" color="primary" onPress={() => navigate('/earnings')} endContent={<ArrowUpRight size={14}/>}>View all</Button>}/>
        {data?.recent?.length ? <div className={`overflow-x-auto transition-all duration-300 ${dataVisible ? '' : 'pointer-events-none select-none blur-md'} `}><table className="w-full min-w-130 text-left"><thead><tr className="border-b border-divider text-[10px] uppercase tracking-wider text-default-500"><th className="pb-3 font-medium">Description</th><th className="pb-3 font-medium">Platform</th><th className="pb-3 font-medium">Date</th><th className="pb-3 text-right font-medium">Amount</th></tr></thead><tbody className="divide-y divide-divider">{data.recent.map((item) => <tr key={item.id} className="text-xs transition-colors hover:bg-default-100/60"><td className="py-3 pr-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ReceiptText size={13}/></span><span className="truncate text-foreground/90">{item.category || 'Uncategorized'}</span></div></td><td className="py-3 pr-3 text-default-500">{item.platform_name || '—'}</td><td className="py-3 pr-3 text-default-400">{item.earned_at}</td><td className="py-3 text-right font-semibold text-success">+{formatMoney(item.amount_usd, 'USD')}</td></tr>)}</tbody></table></div> : <EmptyState title="No earnings yet" text="Add your first payment to start the timeline."/>}
      </Panel>

      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        title="Customize dashboard"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-default-500">
              Drag sections to reorder them, or hide anything you do not need.
              Your layout is saved to your account.
            </p>
          </div>

          <div className="space-y-2">
            {dashboardPreferences.order.map((widgetId) => {
              const hidden = dashboardPreferences.hidden.includes(widgetId)

              return (
                <div
                  key={widgetId}
                  draggable
                  onDragStart={() => setDraggingWidget(widgetId)}
                  onDragEnd={() => setDraggingWidget(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    moveDashboardWidget(draggingWidget, widgetId)
                    setDraggingWidget(null)
                  }}
                  className={`flex cursor-grab items-center gap-3 rounded-xl border p-3 transition active:cursor-grabbing ${
                    draggingWidget === widgetId
                      ? 'border-primary/40 bg-primary/5 opacity-60'
                      : 'border-default-200 bg-default-50/60 dark:border-white/8 dark:bg-white/[0.02]'
                  }`}
                >
                  <GripVertical size={17} className="shrink-0 text-default-400"/>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                    {DASHBOARD_WIDGET_LABELS[widgetId]}
                  </span>

                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color={hidden ? 'default' : 'primary'}
                    onPress={() => toggleDashboardWidget(widgetId)}
                    aria-label={hidden ? 'Show section' : 'Hide section'}
                  >
                    {hidden ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </Button>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-divider pt-4">
            <Button
              variant="light"
              startContent={<RotateCcw size={15}/>}
              onPress={resetDashboardPreferences}
              isDisabled={preferencesSaving}
            >
              Reset to default
            </Button>

            <Button
              color="primary"
              onPress={() => setCustomizeOpen(false)}
              isLoading={preferencesSaving}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4 text-xs text-default-400"><span>Updated just now from your income records</span><div className="flex items-center gap-2"><Button size="sm" variant="light" className="text-default-500 hover:text-foreground" startContent={<CalendarDays size={14}/>}>{dataVisible ? (period === 'all' ? 'All time' : period.replaceAll('_', ' ')) : '*****'}</Button><Button size="sm" variant="light" className="text-default-500 hover:text-foreground" startContent={<Download size={14}/>} onPress={() => navigate('/earnings')}>Export view</Button></div></div>
    </div>
  </div>
}
