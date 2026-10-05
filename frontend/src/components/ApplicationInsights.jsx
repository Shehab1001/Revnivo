import {
  Card,
  CardBody,
  Chip,
  Spinner,
} from '@heroui/react'
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import api from '../services/api'

const STATUS_LABELS = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

const TYPE_META = {
  task: {
    label: 'Task',
    color: 'primary',
    icon: CheckCircle2,
  },
  interview: {
    label: 'Interview',
    color: 'secondary',
    icon: CalendarClock,
  },
  reminder: {
    label: 'Reminder',
    color: 'warning',
    icon: Clock3,
  },
  deadline: {
    label: 'Deadline',
    color: 'danger',
    icon: AlertTriangle,
  },
}

function formatAgendaDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-default-200/80 bg-content1 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-default-400">
          {label}
        </div>

        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon size={16} />
        </span>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>

      <div className="mt-1 text-xs text-default-500">
        {hint}
      </div>
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="grid h-[260px] place-items-center text-center text-xs text-default-400">
      {label}
    </div>
  )
}

export default function ApplicationInsights() {
  const [analytics, setAnalytics] = useState(null)
  const [agenda, setAgenda] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const [analyticsResponse, agendaResponse] =
        await Promise.all([
          api.get('/applications/analytics/'),
          api.get('/applications/agenda/', {
            params: { days: 30 },
          }),
        ])

      setAnalytics(analyticsResponse.data)
      setAgenda(agendaResponse.data)
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not load career insights.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const pipeline = useMemo(
    () =>
      (analytics?.pipeline || []).map((item) => ({
        ...item,
        label:
          STATUS_LABELS[item.status] ||
          item.status,
      })),
    [analytics]
  )

  const monthly = useMemo(
    () =>
      (analytics?.monthly || []).map((item) => ({
        ...item,
        label: new Intl.DateTimeFormat('en', {
          month: 'short',
        }).format(
          new Date(
            `${item.month}-01T00:00:00`
          )
        ),
      })),
    [analytics]
  )

  const sourceData = useMemo(
    () =>
      (analytics?.sources || [])
        .slice(0, 6)
        .map((item) => ({
          name: item.source,
          value: item.count,
        })),
    [analytics]
  )

  if (loading) {
    return (
      <Card
        shadow="none"
        className="border border-default-200/80 bg-content1"
      >
        <CardBody className="grid min-h-48 place-items-center">
          <div className="flex items-center gap-2 text-sm text-default-500">
            <Spinner size="sm" />
            Loading career insights...
          </div>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    )
  }

  const overview = analytics?.overview || {}

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Career insights
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          Pipeline analytics
        </h2>
        <p className="mt-1 text-xs text-default-500">
          Conversion, response speed, monthly activity, and the next actions that need attention.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Submitted"
          value={overview.submitted || 0}
          hint="Applications beyond saved"
          icon={BriefcaseBusiness}
        />
        <Metric
          label="Response rate"
          value={`${overview.response_rate || 0}%`}
          hint="Reached an outcome stage"
          icon={TrendingUp}
        />
        <Metric
          label="Offer rate"
          value={`${overview.offer_rate || 0}%`}
          hint="Offers per submitted application"
          icon={Target}
        />
        <Metric
          label="Avg. response"
          value={`${overview.average_response_days || 0}d`}
          hint="Average time to first response"
          icon={Clock3}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          shadow="none"
          className="border border-default-200/80 bg-content1"
        >
          <CardBody className="gap-4 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Pipeline distribution
              </h3>
              <p className="mt-1 text-xs text-default-500">
                Current applications by stage
              </p>
            </div>

            {pipeline.some((item) => item.count > 0) ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipeline}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.2}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Applications"
                      fill="currentColor"
                      className="text-primary"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="Track applications to populate the pipeline chart." />
            )}
          </CardBody>
        </Card>

        <Card
          shadow="none"
          className="border border-default-200/80 bg-content1"
        >
          <CardBody className="gap-4 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                12-month activity
              </h3>
              <p className="mt-1 text-xs text-default-500">
                Tracked, applied, interview, and offer activity
              </p>
            </div>

            {monthly.some(
              (item) =>
                item.tracked ||
                item.applied ||
                item.interviews ||
                item.offers
            ) ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      opacity={0.2}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="tracked"
                      name="Tracked"
                      stroke="currentColor"
                      className="text-primary"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="applied"
                      name="Applied"
                      stroke="currentColor"
                      className="text-secondary"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="interviews"
                      name="Interviews"
                      stroke="currentColor"
                      className="text-warning"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="offers"
                      name="Offers"
                      stroke="currentColor"
                      className="text-success"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="Monthly activity will appear after applications are tracked." />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card
          shadow="none"
          className="border border-default-200/80 bg-content1"
        >
          <CardBody className="gap-4 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Top sources
              </h3>
              <p className="mt-1 text-xs text-default-500">
                Where your tracked roles come from
              </p>
            </div>

            {sourceData.length ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={95}
                      paddingAngle={2}
                      fill="currentColor"
                      className="text-primary"
                    />
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="Source analytics will appear here." />
            )}
          </CardBody>
        </Card>

        <Card
          shadow="none"
          className="border border-default-200/80 bg-content1"
        >
          <CardBody className="gap-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Upcoming agenda
                </h3>
                <p className="mt-1 text-xs text-default-500">
                  Tasks, interviews, and deadlines in the next 30 days
                </p>
              </div>

              <div className="flex gap-1">
                <Chip
                  size="sm"
                  variant="flat"
                  color="danger"
                >
                  {agenda?.overdue || 0} overdue
                </Chip>
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                >
                  {agenda?.due_today || 0} today
                </Chip>
              </div>
            </div>

            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {(agenda?.items || []).length ? (
                agenda.items.map((item) => {
                  const meta =
                    TYPE_META[item.type] ||
                    TYPE_META.task
                  const Icon = meta.icon
                  const date = new Date(item.at)
                  const overdue =
                    !Number.isNaN(date.getTime()) &&
                    date < new Date()

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-start gap-3 rounded-xl border border-default-200/80 bg-default-50 p-3"
                    >
                      <span
                        className={
                          'grid h-9 w-9 shrink-0 place-items-center rounded-xl ' +
                          (overdue
                            ? 'bg-danger/10 text-danger'
                            : 'bg-primary/10 text-primary')
                        }
                      >
                        <Icon size={16} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {item.title}
                          </div>
                          <Chip
                            size="sm"
                            variant="flat"
                            color={
                              overdue
                                ? 'danger'
                                : meta.color
                            }
                            className="h-5 text-[10px]"
                          >
                            {overdue
                              ? 'Overdue'
                              : meta.label}
                          </Chip>
                        </div>

                        <div className="mt-1 truncate text-[11px] text-default-500">
                          {item.company} — {item.job_title}
                        </div>

                        <div className="mt-1 text-[10px] text-default-400">
                          {formatAgendaDate(item.at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-default-200 text-center text-xs text-default-400">
                  Nothing due in the next 30 days.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  )
}
