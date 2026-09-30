import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react'
import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  GripVertical,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ApplicationInsights from '../components/ApplicationInsights'
import Modal from '../components/Modal'
import api from '../services/api'

const STATUS_ORDER = [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
]

const STATUS_META = {
  saved: {
    label: 'Saved',
    color: 'default',
    description: 'Interesting roles to revisit',
  },
  applied: {
    label: 'Applied',
    color: 'primary',
    description: 'Applications already submitted',
  },
  screening: {
    label: 'Screening',
    color: 'warning',
    description: 'Recruiter or assessment stage',
  },
  interview: {
    label: 'Interview',
    color: 'secondary',
    description: 'Interview process in progress',
  },
  offer: {
    label: 'Offer',
    color: 'success',
    description: 'Offers received',
  },
  rejected: {
    label: 'Rejected',
    color: 'danger',
    description: 'Closed without an offer',
  },
}

const PRIORITY_META = {
  low: { label: 'Low', color: 'default' },
  medium: { label: 'Medium', color: 'primary' },
  high: { label: 'High', color: 'danger' },
}

const EMPTY_FORM = {
  title: '',
  company: '',
  source_platform: '',
  source_job_id: '',
  job_url: '',
  location: '',
  remote: false,
  category: '',
  employment_type: '',
  salary_text: '',
  currency: 'USD',
  status: 'saved',
  priority: 'medium',
  applied_at: '',
  deadline_at: '',
  interview_at: '',
  recruiter_name: '',
  recruiter_email: '',
  recruiter_linkedin: '',
  notes: '',
  tags: '',
  archived: false,
}

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  )

  return local.toISOString().slice(0, 16)
}

function displayDate(value, withTime = false) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  }).format(date)
}

function applicationToForm(application) {
  return {
    title: application.title || '',
    company: application.company || '',
    source_platform: application.source_platform || '',
    source_job_id: application.source_job_id || '',
    job_url: application.job_url || '',
    location: application.location || '',
    remote: Boolean(application.remote),
    category: application.category || '',
    employment_type: application.employment_type || '',
    salary_text: application.salary_text || '',
    currency: application.currency || 'USD',
    status: application.status || 'saved',
    priority: application.priority || 'medium',
    applied_at: toDateInput(application.applied_at),
    deadline_at: toDateInput(application.deadline_at),
    interview_at: toDateTimeInput(application.interview_at),
    recruiter_name: application.recruiter_name || '',
    recruiter_email: application.recruiter_email || '',
    recruiter_linkedin: application.recruiter_linkedin || '',
    notes: application.notes || '',
    tags: (application.tags || []).join(', '),
    archived: Boolean(application.archived),
  }
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}) {
  return (
    <Card
      shadow="none"
      className="border border-default-200/80 bg-content1"
    >
      <CardBody className="gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-default-400">
            {label}
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon size={17} />
          </span>
        </div>

        <div>
          <div className="text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </div>
          <p className="mt-1 text-xs text-default-500">
            {detail}
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

function ApplicationCard({
  application,
  onOpen,
  onMove,
  onArchive,
  onDelete,
}) {
  const meta =
    STATUS_META[application.status] ||
    STATUS_META.saved

  const priority =
    PRIORITY_META[application.priority] ||
    PRIORITY_META.medium

  return (
    <Card
      shadow="none"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(
          'text/application-id',
          application.id
        )
      }}
      className="group cursor-grab border border-default-200/80 bg-content1 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
    >
      <CardBody className="gap-3 p-3.5">
        <div className="flex items-start gap-2">
          <span className="mt-1 text-default-300 opacity-0 transition group-hover:opacity-100">
            <GripVertical size={15} />
          </span>

          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpen(application)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                variant="flat"
                color={priority.color}
                className="h-5 text-[10px]"
              >
                {priority.label}
              </Chip>

              {application.remote && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                  className="h-5 text-[10px]"
                >
                  Remote
                </Chip>
              )}
            </div>

            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-foreground">
              {application.title}
            </h3>

            <div className="mt-1 flex items-center gap-1.5 text-xs text-default-500">
              <Building2 size={13} />
              <span className="truncate">
                {application.company}
              </span>
            </div>
          </button>
        </div>

        <div className="space-y-1.5 text-[11px] text-default-500">
          {application.location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={12} />
              <span className="truncate">
                {application.location}
              </span>
            </div>
          )}

          {application.salary_text && (
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} />
              <span className="truncate">
                {application.salary_text}
              </span>
            </div>
          )}

          {application.deadline_at && (
            <div className="flex items-center gap-1.5">
              <CalendarClock size={12} />
              Deadline {displayDate(application.deadline_at)}
            </div>
          )}

          {application.interview_at && (
            <div className="flex items-center gap-1.5 text-secondary">
              <Clock3 size={12} />
              Interview {displayDate(application.interview_at, true)}
            </div>
          )}
        </div>

        {(application.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {application.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-default-100 px-2 py-1 text-[10px] text-default-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-divider pt-2">
          <div className="text-[10px] text-default-400">
            {application.source_platform ||
              meta.label}
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Edit application"
              onPress={() => onOpen(application)}
            >
              <Pencil size={14} />
            </Button>

            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Archive application"
              onPress={() => onArchive(application)}
            >
              <Archive size={14} />
            </Button>

            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label="Delete application"
              onPress={() => onDelete(application)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <Select
          size="sm"
          label="Move to"
          selectedKeys={
            new Set([application.status || 'saved'])
          }
          onSelectionChange={(keys) => {
            const nextStatus = Array.from(keys)[0]
            if (
              nextStatus &&
              nextStatus !== application.status
            ) {
              onMove(application, String(nextStatus))
            }
          }}
        >
          {STATUS_ORDER.map((key) => (
            <SelectItem key={key}>
              {STATUS_META[key].label}
            </SelectItem>
          ))}
        </Select>
      </CardBody>
    </Card>
  )
}

function KanbanColumn({
  statusKey,
  applications,
  allApplications,
  onOpen,
  onMove,
  onArchive,
  onDelete,
}) {
  const [over, setOver] = useState(false)
  const meta = STATUS_META[statusKey]

  return (
    <section
      className={
        'min-h-[480px] w-[290px] shrink-0 rounded-2xl border p-3 transition ' +
        (over
          ? 'border-primary/50 bg-primary/5'
          : 'border-default-200/80 bg-default-50/50')
      }
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        const applicationId =
          event.dataTransfer.getData(
            'text/application-id'
          )

        const application = allApplications.find(
          (item) => item.id === applicationId
        )

        if (
          application &&
          application.status !== statusKey
        ) {
          onMove(application, statusKey)
        }
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-2 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color={meta.color}
              className="font-semibold"
            >
              {meta.label}
            </Chip>
            <span className="text-xs font-medium text-default-400">
              {applications.length}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-default-400">
            {meta.description}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {applications.length ? (
          applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onOpen={onOpen}
              onMove={onMove}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-default-200 text-center text-xs text-default-400">
            Drop applications here
          </div>
        )}
      </div>
    </section>
  )
}

export default function Applications() {
  const navigate = useNavigate()
  const [applications, setApplications] =
    useState([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    response_rate: 0,
    offer_rate: 0,
    by_status: {},
    upcoming_interviews: [],
    upcoming_deadlines: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [priority, setPriority] = useState('all')
  const [showArchived, setShowArchived] =
    useState(false)

  const [modalOpen, setModalOpen] =
    useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [events, setEvents] = useState([])
  const [eventNote, setEventNote] = useState('')
  const [eventSaving, setEventSaving] =
    useState(false)

  const loadApplications = async () => {
    setLoading(true)
    setError('')

    try {
      const [{ data }, statsResponse] =
        await Promise.all([
          api.get('/applications/', {
            params: {
              archived: showArchived
                ? 'only'
                : 'false',
            },
          }),
          api.get('/applications/stats/'),
        ])

      setApplications(data.applications || [])
      setStats(statsResponse.data || {})
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not load applications.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications()
  }, [showArchived])

  const sources = useMemo(
    () =>
      [
        ...new Set(
          applications
            .map(
              (application) =>
                application.source_platform
            )
            .filter(Boolean)
        ),
      ].sort(),
    [applications]
  )

  const filteredApplications = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return applications.filter((application) => {
      if (
        source !== 'all' &&
        application.source_platform !== source
      ) {
        return false
      }

      if (
        priority !== 'all' &&
        application.priority !== priority
      ) {
        return false
      }

      if (!needle) return true

      return [
        application.title,
        application.company,
        application.location,
        application.category,
        application.source_platform,
        application.notes,
        ...(application.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [
    applications,
    search,
    source,
    priority,
  ])

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(
      STATUS_ORDER.map((key) => [key, []])
    )

    for (const application of filteredApplications) {
      const statusKey =
        STATUS_ORDER.includes(application.status)
          ? application.status
          : 'saved'

      groups[statusKey].push(application)
    }

    return groups
  }, [filteredApplications])

  const openCreate = () => {
    setEditing(null)
    setEvents([])
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openApplication = async (application) => {
    setEditing(application)
    setForm(applicationToForm(application))
    setEvents([])
    setModalOpen(true)

    try {
      const { data } = await api.get(
        `/applications/${application.id}/`
      )
      setEvents(data.events || [])
    } catch {
      setEvents([])
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setEvents([])
    setEventNote('')
    setForm(EMPTY_FORM)
    setError('')
  }

  const submitApplication = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      ...form,
      tags: form.tags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      applied_at: form.applied_at || null,
      deadline_at: form.deadline_at || null,
      interview_at: form.interview_at || null,
    }

    try {
      if (editing) {
        await api.patch(
          `/applications/${editing.id}/`,
          payload
        )
      } else {
        await api.post('/applications/', payload)
      }

      closeModal()
      await loadApplications()
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not save the application.'
      )
    } finally {
      setSaving(false)
    }
  }

  const moveApplication = async (
    application,
    nextStatus
  ) => {
    const previousStatus = application.status

    setApplications((items) =>
      items.map((item) =>
        item.id === application.id
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    )

    try {
      const { data } = await api.patch(
        `/applications/${application.id}/status/`,
        { status: nextStatus }
      )

      setApplications((items) =>
        items.map((item) =>
          item.id === application.id
            ? data.application
            : item
        )
      )

      api
        .get('/applications/stats/')
        .then(({ data: nextStats }) =>
          setStats(nextStats)
        )
        .catch(() => {})
    } catch (requestError) {
      setApplications((items) =>
        items.map((item) =>
          item.id === application.id
            ? {
                ...item,
                status: previousStatus,
              }
            : item
        )
      )

      setError(
        requestError.response?.data?.detail ||
          'Could not move the application.'
      )
    }
  }

  const archiveApplication = async (
    application
  ) => {
    try {
      await api.patch(
        `/applications/${application.id}/`,
        {
          archived: !application.archived,
        }
      )
      await loadApplications()
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not archive the application.'
      )
    }
  }

  const deleteApplication = async (
    application
  ) => {
    const confirmed = window.confirm(
      `Delete "${application.title}" at ${application.company}?`
    )

    if (!confirmed) return

    try {
      await api.delete(
        `/applications/${application.id}/`
      )
      setApplications((items) =>
        items.filter(
          (item) => item.id !== application.id
        )
      )
      api
        .get('/applications/stats/')
        .then(({ data }) => setStats(data))
        .catch(() => {})
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not delete the application.'
      )
    }
  }

  const addEventNote = async () => {
    if (!editing || !eventNote.trim()) return

    setEventSaving(true)

    try {
      const { data } = await api.post(
        `/applications/${editing.id}/events/`,
        {
          title: 'Note added',
          message: eventNote.trim(),
        }
      )

      setEvents((items) => [
        data.event,
        ...items,
      ])
      setEventNote('')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not add the note.'
      )
    } finally {
      setEventSaving(false)
    }
  }

  return (
    <div className="space-y-6 text-foreground">
      <section className="overflow-hidden rounded-3xl border border-default-200/80 bg-content1 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Career CRM
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Application Tracker
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">
              Track every opportunity from saved role to offer.
              Drag applications between stages, keep recruiter
              details and deadlines, and preserve a full activity
              timeline.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="flat"
              startContent={<Archive size={16} />}
              onPress={() =>
                setShowArchived((value) => !value)
              }
            >
              {showArchived
                ? 'Show active'
                : 'Archived'}
            </Button>

            <Button
              color="primary"
              startContent={<Plus size={16} />}
              onPress={openCreate}
            >
              Add application
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tracked"
          value={stats.total || 0}
          detail="Active applications and saved roles"
          icon={BriefcaseBusiness}
        />
        <StatCard
          label="In progress"
          value={stats.active || 0}
          detail="Applied, screening, and interview"
          icon={Clock3}
        />
        <StatCard
          label="Response rate"
          value={`${stats.response_rate || 0}%`}
          detail="Applications that received an outcome"
          icon={MessageSquareText}
        />
        <StatCard
          label="Offer rate"
          value={`${stats.offer_rate || 0}%`}
          detail="Offers from submitted applications"
          icon={CheckCircle2}
        />
      </section>

      {!showArchived && (
        <ApplicationInsights />
      )}

      <Card
        shadow="none"
        className="border border-default-200/80 bg-content1"
      >
        <CardBody className="gap-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_180px_auto]">
            <Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search company, role, tag..."
              startContent={
                <Search
                  size={16}
                  className="text-default-400"
                />
              }
            />

            <Select
              aria-label="Source"
              selectedKeys={new Set([source])}
              onSelectionChange={(keys) =>
                setSource(
                  String(
                    Array.from(keys)[0] || 'all'
                  )
                )
              }
              startContent={<Filter size={15} />}
            >
              <SelectItem key="all">
                All sources
              </SelectItem>
              {sources.map((item) => (
                <SelectItem key={item}>
                  {item}
                </SelectItem>
              ))}
            </Select>

            <Select
              aria-label="Priority"
              selectedKeys={new Set([priority])}
              onSelectionChange={(keys) =>
                setPriority(
                  String(
                    Array.from(keys)[0] || 'all'
                  )
                )
              }
            >
              <SelectItem key="all">
                All priorities
              </SelectItem>
              <SelectItem key="high">
                High
              </SelectItem>
              <SelectItem key="medium">
                Medium
              </SelectItem>
              <SelectItem key="low">
                Low
              </SelectItem>
            </Select>

            <div className="flex items-center rounded-xl bg-default-100 px-3 text-xs font-medium text-default-500">
              {filteredApplications.length} visible
            </div>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <div className="grid min-h-72 place-items-center rounded-2xl border border-default-200/80 bg-content1">
          <div className="text-sm text-default-500">
            Loading applications...
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max gap-4">
            {STATUS_ORDER.map((statusKey) => (
              <KanbanColumn
                key={statusKey}
                statusKey={statusKey}
                applications={byStatus[statusKey]}
                allApplications={filteredApplications}
                onOpen={openApplication}
                onMove={moveApplication}
                onArchive={archiveApplication}
                onDelete={deleteApplication}
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editing
            ? 'Application details'
            : 'Add application'
        }
      >
        <form
          onSubmit={submitApplication}
          className="space-y-5"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              isRequired
              label="Job title"
              value={form.title}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  title: value,
                })
              }
            />

            <Input
              isRequired
              label="Company"
              value={form.company}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  company: value,
                })
              }
            />

            <Input
              label="Source platform"
              value={form.source_platform}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  source_platform: value,
                })
              }
              placeholder="Alignerr, Mercor..."
            />

            <Input
              label="Location"
              value={form.location}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  location: value,
                })
              }
            />

            <Input
              label="Salary / rate"
              value={form.salary_text}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  salary_text: value,
                })
              }
              placeholder="$40–$80/hr"
            />

            <Input
              label="Category"
              value={form.category}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  category: value,
                })
              }
            />

            <Select
              label="Stage"
              selectedKeys={
                new Set([form.status])
              }
              onSelectionChange={(keys) =>
                setForm({
                  ...form,
                  status: String(
                    Array.from(keys)[0] ||
                      'saved'
                  ),
                })
              }
            >
              {STATUS_ORDER.map((key) => (
                <SelectItem key={key}>
                  {STATUS_META[key].label}
                </SelectItem>
              ))}
            </Select>

            <Select
              label="Priority"
              selectedKeys={
                new Set([form.priority])
              }
              onSelectionChange={(keys) =>
                setForm({
                  ...form,
                  priority: String(
                    Array.from(keys)[0] ||
                      'medium'
                  ),
                })
              }
            >
              <SelectItem key="high">
                High
              </SelectItem>
              <SelectItem key="medium">
                Medium
              </SelectItem>
              <SelectItem key="low">
                Low
              </SelectItem>
            </Select>

            <Input
              type="date"
              label="Applied date"
              value={form.applied_at}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  applied_at: value,
                })
              }
            />

            <Input
              type="date"
              label="Deadline"
              value={form.deadline_at}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  deadline_at: value,
                })
              }
            />

            <Input
              type="datetime-local"
              label="Interview"
              value={form.interview_at}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  interview_at: value,
                })
              }
            />

            <Input
              label="Employment type"
              value={form.employment_type}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  employment_type: value,
                })
              }
            />
          </div>

          <Input
            type="url"
            label="Job URL"
            value={form.job_url}
            onValueChange={(value) =>
              setForm({
                ...form,
                job_url: value,
              })
            }
            endContent={
              form.job_url ? (
                <a
                  href={form.job_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary"
                >
                  <ExternalLink size={15} />
                </a>
              ) : null
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Recruiter name"
              value={form.recruiter_name}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  recruiter_name: value,
                })
              }
              startContent={<UserRound size={15} />}
            />

            <Input
              type="email"
              label="Recruiter email"
              value={form.recruiter_email}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  recruiter_email: value,
                })
              }
              startContent={<Mail size={15} />}
            />
          </div>

          <Input
            label="Tags"
            value={form.tags}
            onValueChange={(value) =>
              setForm({
                ...form,
                tags: value,
              })
            }
            placeholder="AI, Python, remote"
          />

          <Textarea
            label="Notes"
            minRows={4}
            value={form.notes}
            onValueChange={(value) =>
              setForm({
                ...form,
                notes: value,
              })
            }
          />

          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                remote: !form.remote,
              })
            }
            className={
              'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ' +
              (form.remote
                ? 'border-success/30 bg-success/10'
                : 'border-default-200 bg-default-50')
            }
          >
            <div>
              <div className="text-sm font-medium">
                Remote role
              </div>
              <div className="text-xs text-default-500">
                Mark this application as remote work
              </div>
            </div>
            <Chip
              size="sm"
              color={
                form.remote
                  ? 'success'
                  : 'default'
              }
              variant="flat"
            >
              {form.remote ? 'Yes' : 'No'}
            </Chip>
          </button>

          {editing && (
            <section className="space-y-3 rounded-2xl border border-default-200 p-4">
              <div>
                <h3 className="text-sm font-semibold">
                  Activity timeline
                </h3>
                <p className="text-xs text-default-500">
                  Every stage change and note is preserved.
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  value={eventNote}
                  onValueChange={setEventNote}
                  placeholder="Add a timeline note..."
                />
                <Button
                  type="button"
                  color="primary"
                  variant="flat"
                  isLoading={eventSaving}
                  onPress={addEventNote}
                >
                  Add
                </Button>
              </div>

              <div className="max-h-56 space-y-3 overflow-y-auto">
                {events.length ? (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="flex gap-3 rounded-xl bg-default-50 p-3"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">
                          {event.title}
                        </div>
                        {event.message && (
                          <div className="mt-0.5 text-xs leading-5 text-default-500">
                            {event.message}
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-default-400">
                          {displayDate(
                            event.created_at,
                            true
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-xs text-default-400">
                    No activity yet.
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-4">
            {editing && (
              <Button
                type="button"
                variant="flat"
                color="primary"
                onPress={() => {
                  const id = editing.id
                  closeModal()
                  navigate(`/applications/${id}`)
                }}
              >
                Open workspace
              </Button>
            )}

            <Button
              type="button"
              variant="light"
              onPress={closeModal}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              color="primary"
              isLoading={saving}
              endContent={
                !saving && <ArrowRight size={15} />
              }
            >
              {editing
                ? 'Save changes'
                : 'Add application'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
