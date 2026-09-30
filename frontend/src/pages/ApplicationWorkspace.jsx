import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from '@heroui/react'
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Plus,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import api from '../services/api'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
]

const TASK_PRIORITIES = [
  { key: 'urgent', label: 'Urgent', color: 'danger' },
  { key: 'high', label: 'High', color: 'warning' },
  { key: 'medium', label: 'Medium', color: 'primary' },
  { key: 'low', label: 'Low', color: 'default' },
]

const INTERVIEW_RESULTS = [
  { key: 'pending', label: 'Pending' },
  { key: 'passed', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'rescheduled', label: 'Rescheduled' },
]

const DOCUMENT_KINDS = [
  { key: 'resume', label: 'Resume / CV' },
  { key: 'cover_letter', label: 'Cover letter' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'offer', label: 'Offer' },
  { key: 'other', label: 'Other' },
]

function formatDate(value, withTime = false) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

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

function toDateTimeInput(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const local = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60000
  )

  return local.toISOString().slice(0, 16)
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-default-200/80 bg-default-50 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-default-400">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value || '—'}
      </div>
    </div>
  )
}

function EmptyPanel({ title, detail }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {title}
        </div>
        <p className="mt-1 max-w-sm text-xs leading-5 text-default-500">
          {detail}
        </p>
      </div>
    </div>
  )
}

export default function ApplicationWorkspace() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [application, setApplication] = useState(null)
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [interviews, setInterviews] = useState([])
  const [documents, setDocuments] = useState([])

  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [taskSaving, setTaskSaving] = useState(false)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_at: '',
    reminder_at: '',
  })

  const [interviewSaving, setInterviewSaving] =
    useState(false)
  const [interviewForm, setInterviewForm] =
    useState({
      title: 'Interview',
      round_type: 'Interview',
      scheduled_at: '',
      duration_minutes: '60',
      timezone:
        Intl.DateTimeFormat().resolvedOptions()
          .timeZone || '',
      meeting_url: '',
      location: '',
      interviewer_name: '',
      interviewer_email: '',
      prep_notes: '',
      questions: '',
      result: 'pending',
    })

  const [documentKind, setDocumentKind] =
    useState('resume')
  const [documentNote, setDocumentNote] =
    useState('')
  const [documentUploading, setDocumentUploading] =
    useState(false)

  const loadWorkspace = async () => {
    setLoading(true)
    setError('')

    try {
      const [
        detailResponse,
        taskResponse,
        interviewResponse,
        documentResponse,
      ] = await Promise.all([
        api.get(
          `/applications/${applicationId}/`
        ),
        api.get(
          `/applications/${applicationId}/tasks/`
        ),
        api.get(
          `/applications/${applicationId}/interviews/`
        ),
        api.get(
          `/applications/${applicationId}/documents/`
        ),
      ])

      setApplication(
        detailResponse.data.application
      )
      setEvents(detailResponse.data.events || [])
      setTasks(taskResponse.data.tasks || [])
      setInterviews(
        interviewResponse.data.interviews || []
      )
      setDocuments(
        documentResponse.data.documents || []
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not load this application workspace.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspace()
  }, [applicationId])

  const openTasks = useMemo(
    () =>
      tasks.filter((task) => !task.completed),
    [tasks]
  )

  const completedTasks = useMemo(
    () =>
      tasks.filter((task) => task.completed),
    [tasks]
  )

  const upcomingInterviews = useMemo(
    () =>
      [...interviews].sort((a, b) =>
        String(a.scheduled_at || '').localeCompare(
          String(b.scheduled_at || '')
        )
      ),
    [interviews]
  )

  const createTask = async () => {
    if (!taskForm.title.trim()) return

    setTaskSaving(true)
    setError('')

    try {
      const { data } = await api.post(
        `/applications/${applicationId}/tasks/`,
        {
          ...taskForm,
          due_at: taskForm.due_at || null,
          reminder_at:
            taskForm.reminder_at || null,
        }
      )

      setTasks((items) => [
        data.task,
        ...items,
      ])

      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        due_at: '',
        reminder_at: '',
      })
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not create task.'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  const toggleTask = async (task) => {
    try {
      const { data } = await api.patch(
        `/applications/${applicationId}/tasks/${task.id}/`,
        {
          completed: !task.completed,
        }
      )

      setTasks((items) =>
        items.map((item) =>
          item.id === task.id
            ? data.task
            : item
        )
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not update task.'
      )
    }
  }

  const deleteTask = async (task) => {
    try {
      await api.delete(
        `/applications/${applicationId}/tasks/${task.id}/`
      )
      setTasks((items) =>
        items.filter(
          (item) => item.id !== task.id
        )
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not delete task.'
      )
    }
  }

  const createInterview = async () => {
    if (!interviewForm.scheduled_at) return

    setInterviewSaving(true)
    setError('')

    try {
      const { data } = await api.post(
        `/applications/${applicationId}/interviews/`,
        {
          ...interviewForm,
          duration_minutes: Number(
            interviewForm.duration_minutes || 60
          ),
          questions: interviewForm.questions,
        }
      )

      setInterviews((items) => [
        ...items,
        data.interview,
      ])

      setApplication((current) =>
        current
          ? {
              ...current,
              interview_at:
                data.interview.scheduled_at,
            }
          : current
      )

      setInterviewForm((current) => ({
        ...current,
        title: 'Interview',
        round_type: 'Interview',
        scheduled_at: '',
        duration_minutes: '60',
        meeting_url: '',
        location: '',
        interviewer_name: '',
        interviewer_email: '',
        prep_notes: '',
        questions: '',
        result: 'pending',
      }))
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not schedule interview.'
      )
    } finally {
      setInterviewSaving(false)
    }
  }

  const updateInterviewResult = async (
    interview,
    result
  ) => {
    try {
      const { data } = await api.patch(
        `/applications/${applicationId}/interviews/${interview.id}/`,
        { result }
      )

      setInterviews((items) =>
        items.map((item) =>
          item.id === interview.id
            ? data.interview
            : item
        )
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not update interview.'
      )
    }
  }

  const deleteInterview = async (
    interview
  ) => {
    try {
      await api.delete(
        `/applications/${applicationId}/interviews/${interview.id}/`
      )
      setInterviews((items) =>
        items.filter(
          (item) => item.id !== interview.id
        )
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not delete interview.'
      )
    }
  }

  const uploadDocument = async (file) => {
    if (!file) return

    setDocumentUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', documentKind)
      formData.append('note', documentNote)

      const { data } = await api.post(
        `/applications/${applicationId}/documents/`,
        formData
      )

      setDocuments((items) => [
        data.document,
        ...items,
      ])
      setDocumentNote('')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not upload document.'
      )
    } finally {
      setDocumentUploading(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const deleteDocument = async (
    document
  ) => {
    try {
      await api.delete(
        `/applications/${applicationId}/documents/${document.id}/`
      )
      setDocuments((items) =>
        items.filter(
          (item) => item.id !== document.id
        )
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not remove document.'
      )
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-2 text-sm text-default-500">
          <Spinner size="sm" />
          Loading application workspace...
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <Button
          variant="light"
          startContent={<ArrowLeft size={16} />}
          onPress={() => navigate('/applications')}
        >
          Back to applications
        </Button>

        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">
          {error || 'Application not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-foreground">
      <section className="rounded-3xl border border-default-200/80 bg-content1 p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Button
              variant="light"
              size="sm"
              className="-ml-2 mb-3"
              startContent={<ArrowLeft size={15} />}
              onPress={() =>
                navigate('/applications')
              }
            >
              Applications
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                variant="flat"
                color="primary"
              >
                {application.status}
              </Chip>

              <Chip
                size="sm"
                variant="flat"
              >
                {application.priority} priority
              </Chip>

              {application.remote && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="success"
                >
                  Remote
                </Chip>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {application.title}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-default-500">
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness size={15} />
                {application.company}
              </span>

              {application.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} />
                  {application.location}
                </span>
              )}

              {application.source_platform && (
                <span>
                  Source: {application.source_platform}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {application.job_url && (
              <Button
                as="a"
                href={application.job_url}
                target="_blank"
                rel="noreferrer"
                variant="flat"
                endContent={
                  <ExternalLink size={15} />
                }
              >
                Original role
              </Button>
            )}

            <Button
              color="primary"
              onPress={() =>
                navigate('/applications')
              }
            >
              Back to board
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-2xl border border-default-200/80 bg-content1 p-1.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={
                'rounded-xl px-4 py-2 text-sm font-medium transition ' +
                (tab === item.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-default-500 hover:bg-default-100 hover:text-foreground')
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-4 p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Application overview
                </h2>
                <p className="mt-1 text-xs text-default-500">
                  Core role, recruiter, and schedule information.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem
                  icon={BriefcaseBusiness}
                  label="Company"
                  value={application.company}
                />
                <InfoItem
                  icon={MapPin}
                  label="Location"
                  value={
                    application.location ||
                    (application.remote
                      ? 'Remote'
                      : '—')
                  }
                />
                <InfoItem
                  icon={CalendarClock}
                  label="Applied"
                  value={formatDate(
                    application.applied_at
                  )}
                />
                <InfoItem
                  icon={Clock3}
                  label="Deadline"
                  value={formatDate(
                    application.deadline_at
                  )}
                />
                <InfoItem
                  icon={UserRound}
                  label="Recruiter"
                  value={
                    application.recruiter_name
                  }
                />
                <InfoItem
                  icon={Mail}
                  label="Recruiter email"
                  value={
                    application.recruiter_email
                  }
                />
              </div>

              {application.salary_text && (
                <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-success">
                    Compensation
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {application.salary_text}
                  </div>
                </div>
              )}

              {application.notes && (
                <div className="rounded-xl border border-default-200 bg-default-50 p-4">
                  <div className="text-xs font-semibold text-default-500">
                    Notes
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {application.notes}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card
              shadow="none"
              className="border border-default-200/80 bg-content1"
            >
              <CardBody className="gap-3 p-5">
                <h2 className="text-base font-semibold">
                  Next actions
                </h2>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-primary/5 p-3 text-center">
                    <div className="text-xl font-semibold text-primary">
                      {openTasks.length}
                    </div>
                    <div className="mt-1 text-[10px] text-default-500">
                      Open tasks
                    </div>
                  </div>

                  <div className="rounded-xl bg-secondary/5 p-3 text-center">
                    <div className="text-xl font-semibold text-secondary">
                      {
                        interviews.filter(
                          (item) => !item.completed
                        ).length
                      }
                    </div>
                    <div className="mt-1 text-[10px] text-default-500">
                      Interviews
                    </div>
                  </div>

                  <div className="rounded-xl bg-warning/5 p-3 text-center">
                    <div className="text-xl font-semibold text-warning">
                      {documents.length}
                    </div>
                    <div className="mt-1 text-[10px] text-default-500">
                      Documents
                    </div>
                  </div>
                </div>

                {openTasks.slice(0, 4).map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => setTab('tasks')}
                    className="flex w-full items-start gap-3 rounded-xl border border-default-200 bg-default-50 p-3 text-left transition hover:border-primary/30"
                  >
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-primary/40" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">
                        {task.title}
                      </div>
                      <div className="mt-0.5 text-[10px] text-default-400">
                        {task.due_at
                          ? `Due ${formatDate(
                              task.due_at,
                              true
                            )}`
                          : 'No due date'}
                      </div>
                    </div>
                  </button>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-4 p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Add follow-up task
                </h2>
                <p className="mt-1 text-xs text-default-500">
                  Create deadlines and optional reminder times.
                </p>
              </div>

              <Input
                label="Task"
                value={taskForm.title}
                onValueChange={(value) =>
                  setTaskForm({
                    ...taskForm,
                    title: value,
                  })
                }
                placeholder="Follow up with recruiter"
              />

              <Textarea
                label="Description"
                minRows={3}
                value={taskForm.description}
                onValueChange={(value) =>
                  setTaskForm({
                    ...taskForm,
                    description: value,
                  })
                }
              />

              <Select
                label="Priority"
                selectedKeys={
                  new Set([taskForm.priority])
                }
                onSelectionChange={(keys) =>
                  setTaskForm({
                    ...taskForm,
                    priority: String(
                      Array.from(keys)[0] ||
                        'medium'
                    ),
                  })
                }
              >
                {TASK_PRIORITIES.map((item) => (
                  <SelectItem key={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </Select>

              <Input
                type="datetime-local"
                label="Due date"
                value={taskForm.due_at}
                onValueChange={(value) =>
                  setTaskForm({
                    ...taskForm,
                    due_at: value,
                  })
                }
              />

              <Input
                type="datetime-local"
                label="Reminder"
                value={taskForm.reminder_at}
                onValueChange={(value) =>
                  setTaskForm({
                    ...taskForm,
                    reminder_at: value,
                  })
                }
              />

              <Button
                color="primary"
                startContent={<Plus size={15} />}
                isLoading={taskSaving}
                onPress={createTask}
              >
                Add task
              </Button>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card
              shadow="none"
              className="border border-default-200/80 bg-content1"
            >
              <CardBody className="gap-3 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">
                    Open tasks
                  </h2>
                  <Chip size="sm" variant="flat">
                    {openTasks.length}
                  </Chip>
                </div>

                {openTasks.length ? (
                  openTasks.map((task) => {
                    const priority =
                      TASK_PRIORITIES.find(
                        (item) =>
                          item.key === task.priority
                      ) ||
                      TASK_PRIORITIES[2]

                    return (
                      <div
                        key={task.id}
                        className="rounded-xl border border-default-200 bg-default-50 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              toggleTask(task)
                            }
                            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-primary/40 text-primary transition hover:bg-primary/10"
                            aria-label="Complete task"
                          >
                            <Check size={12} />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold">
                                {task.title}
                              </div>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={priority.color}
                                className="h-5 text-[10px]"
                              >
                                {priority.label}
                              </Chip>
                            </div>

                            {task.description && (
                              <p className="mt-1 text-xs leading-5 text-default-500">
                                {task.description}
                              </p>
                            )}

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-default-400">
                              {task.due_at && (
                                <span>
                                  Due {formatDate(
                                    task.due_at,
                                    true
                                  )}
                                </span>
                              )}
                              {task.reminder_at && (
                                <span>
                                  Reminder {formatDate(
                                    task.reminder_at,
                                    true
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() =>
                              deleteTask(task)
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <EmptyPanel
                    title="No open tasks"
                    detail="Add follow-ups, deadlines, or preparation tasks for this application."
                  />
                )}
              </CardBody>
            </Card>

            {completedTasks.length > 0 && (
              <Card
                shadow="none"
                className="border border-default-200/80 bg-content1"
              >
                <CardBody className="gap-2 p-5">
                  <h2 className="text-sm font-semibold">
                    Completed
                  </h2>

                  {completedTasks.map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() =>
                        toggleTask(task)
                      }
                      className="flex w-full items-center gap-3 rounded-xl bg-default-50 p-3 text-left"
                    >
                      <CheckCircle2
                        size={16}
                        className="text-success"
                      />
                      <span className="flex-1 truncate text-xs text-default-500 line-through">
                        {task.title}
                      </span>
                    </button>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'interviews' && (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-4 p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Schedule interview
                </h2>
                <p className="mt-1 text-xs text-default-500">
                  Store meeting details, preparation notes, and expected questions.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Title"
                  value={interviewForm.title}
                  onValueChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      title: value,
                    })
                  }
                />
                <Input
                  label="Round"
                  value={interviewForm.round_type}
                  onValueChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      round_type: value,
                    })
                  }
                  placeholder="Technical, HR..."
                />
              </div>

              <Input
                isRequired
                type="datetime-local"
                label="Date and time"
                value={interviewForm.scheduled_at}
                onValueChange={(value) =>
                  setInterviewForm({
                    ...interviewForm,
                    scheduled_at: value,
                  })
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="number"
                  label="Duration (minutes)"
                  value={interviewForm.duration_minutes}
                  onValueChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      duration_minutes: value,
                    })
                  }
                />
                <Input
                  label="Timezone"
                  value={interviewForm.timezone}
                  onValueChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      timezone: value,
                    })
                  }
                />
              </div>

              <Input
                type="url"
                label="Meeting URL"
                value={interviewForm.meeting_url}
                onValueChange={(value) =>
                  setInterviewForm({
                    ...interviewForm,
                    meeting_url: value,
                  })
                }
              />

              <Input
                label="Location"
                value={interviewForm.location}
                onValueChange={(value) =>
                  setInterviewForm({
                    ...interviewForm,
                    location: value,
                  })
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Interviewer"
                  value={interviewForm.interviewer_name}
                  onValueChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      interviewer_name: value,
                    })
                  }
                />
                <Input
                  type="email"
                  label="Interviewer email"
                  value={interviewForm.interviewer_email}
                  onValueChange={(value) =>
                    setInterviewForm({
                      ...interviewForm,
                      interviewer_email: value,
                    })
                  }
                />
              </div>

              <Textarea
                label="Preparation notes"
                minRows={4}
                value={interviewForm.prep_notes}
                onValueChange={(value) =>
                  setInterviewForm({
                    ...interviewForm,
                    prep_notes: value,
                  })
                }
              />

              <Textarea
                label="Questions to prepare"
                minRows={4}
                value={interviewForm.questions}
                onValueChange={(value) =>
                  setInterviewForm({
                    ...interviewForm,
                    questions: value,
                  })
                }
                placeholder="One question per line"
              />

              <Button
                color="primary"
                startContent={
                  <CalendarClock size={15} />
                }
                isLoading={interviewSaving}
                onPress={createInterview}
              >
                Schedule interview
              </Button>
            </CardBody>
          </Card>

          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Interview rounds
                </h2>
                <Chip size="sm" variant="flat">
                  {interviews.length}
                </Chip>
              </div>

              {upcomingInterviews.length ? (
                upcomingInterviews.map(
                  (interview) => (
                    <div
                      key={interview.id}
                      className="rounded-2xl border border-default-200 bg-default-50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">
                              {interview.title}
                            </h3>
                            <Chip
                              size="sm"
                              variant="flat"
                              color={
                                interview.result ===
                                'passed'
                                  ? 'success'
                                  : interview.result ===
                                      'failed'
                                    ? 'danger'
                                    : 'primary'
                              }
                            >
                              {interview.result}
                            </Chip>
                          </div>

                          <div className="mt-2 text-xs text-default-500">
                            {formatDate(
                              interview.scheduled_at,
                              true
                            )}
                            {' · '}
                            {
                              interview.duration_minutes
                            } min
                          </div>

                          {interview.interviewer_name && (
                            <div className="mt-1 text-xs text-default-500">
                              With{' '}
                              {
                                interview.interviewer_name
                              }
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {interview.meeting_url && (
                            <Button
                              as="a"
                              href={
                                interview.meeting_url
                              }
                              target="_blank"
                              rel="noreferrer"
                              size="sm"
                              variant="flat"
                              endContent={
                                <ExternalLink
                                  size={13}
                                />
                              }
                            >
                              Join
                            </Button>
                          )}

                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() =>
                              deleteInterview(
                                interview
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      {interview.prep_notes && (
                        <div className="mt-3 rounded-xl bg-content1 p-3 text-xs leading-5 text-default-500">
                          {
                            interview.prep_notes
                          }
                        </div>
                      )}

                      {(interview.questions || [])
                        .length > 0 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-default-400">
                            Questions to prepare
                          </div>
                          <ul className="mt-2 space-y-1 text-xs text-default-500">
                            {interview.questions.map(
                              (question, index) => (
                                <li
                                  key={`${interview.id}-q-${index}`}
                                >
                                  • {question}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}

                      <div className="mt-3">
                        <Select
                          size="sm"
                          label="Result"
                          selectedKeys={
                            new Set([
                              interview.result ||
                                'pending',
                            ])
                          }
                          onSelectionChange={(
                            keys
                          ) => {
                            const result =
                              Array.from(keys)[0]

                            if (result) {
                              updateInterviewResult(
                                interview,
                                String(result)
                              )
                            }
                          }}
                        >
                          {INTERVIEW_RESULTS.map(
                            (item) => (
                              <SelectItem
                                key={item.key}
                              >
                                {item.label}
                              </SelectItem>
                            )
                          )}
                        </Select>
                      </div>
                    </div>
                  )
                )
              ) : (
                <EmptyPanel
                  title="No interviews scheduled"
                  detail="Add HR, technical, final, or client interview rounds here."
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'documents' && (
        <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-4 p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Upload document
                </h2>
                <p className="mt-1 text-xs text-default-500">
                  Store the exact CV, cover letter, assessment, or offer used for this role.
                </p>
              </div>

              <Select
                label="Document type"
                selectedKeys={
                  new Set([documentKind])
                }
                onSelectionChange={(keys) =>
                  setDocumentKind(
                    String(
                      Array.from(keys)[0] ||
                        'other'
                    )
                  )
                }
              >
                {DOCUMENT_KINDS.map((item) => (
                  <SelectItem key={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </Select>

              <Textarea
                label="Note"
                minRows={3}
                value={documentNote}
                onValueChange={setDocumentNote}
                placeholder="Version notes, tailored keywords..."
              />

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-5 text-sm font-medium text-primary transition hover:bg-primary/10">
                <Upload size={17} />
                {documentUploading
                  ? 'Uploading...'
                  : 'Choose file'}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  disabled={documentUploading}
                  accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,image/*,video/mp4,video/webm,audio/*"
                  onChange={(event) =>
                    uploadDocument(
                      event.target.files?.[0]
                    )
                  }
                />
              </label>
            </CardBody>
          </Card>

          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  Application files
                </h2>
                <Chip size="sm" variant="flat">
                  {documents.length}
                </Chip>
              </div>

              {documents.length ? (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-3 rounded-xl border border-default-200 bg-default-50 p-3 sm:flex-row sm:items-center"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <FileText size={18} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {document.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-default-400">
                        <span>
                          {DOCUMENT_KINDS.find(
                            (item) =>
                              item.key ===
                              document.kind
                          )?.label ||
                            document.kind}
                        </span>
                        <span>
                          {Math.max(
                            document.size / 1024,
                            0.1
                          ).toFixed(1)}{' '}
                          KB
                        </span>
                        <span>
                          {formatDate(
                            document.created_at
                          )}
                        </span>
                      </div>

                      {document.note && (
                        <div className="mt-1 truncate text-xs text-default-500">
                          {document.note}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <Button
                        as="a"
                        href={
                          document.download_url
                        }
                        target="_blank"
                        rel="noreferrer"
                        isIconOnly
                        size="sm"
                        variant="flat"
                        aria-label="Open document"
                      >
                        <Download size={15} />
                      </Button>

                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() =>
                          deleteDocument(document)
                        }
                        aria-label="Delete document"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPanel
                  title="No documents yet"
                  detail="Upload the exact CV and supporting files used for this application."
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'timeline' && (
        <Card
          shadow="none"
          className="border border-default-200/80 bg-content1"
        >
          <CardBody className="gap-4 p-5">
            <div>
              <h2 className="text-base font-semibold">
                Activity timeline
              </h2>
              <p className="mt-1 text-xs text-default-500">
                Stage changes, notes, tasks, interviews, and document activity.
              </p>
            </div>

            {events.length ? (
              <div className="relative space-y-4">
                <div className="absolute bottom-2 left-[7px] top-2 w-px bg-divider" />

                {events.map((event) => (
                  <div
                    key={event.id}
                    className="relative flex gap-4"
                  >
                    <span className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-content1 bg-primary" />

                    <div className="min-w-0 flex-1 rounded-xl border border-default-200 bg-default-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {event.title}
                        </div>
                        <div className="text-[10px] text-default-400">
                          {formatDate(
                            event.created_at,
                            true
                          )}
                        </div>
                      </div>

                      {event.message && (
                        <p className="mt-1 text-xs leading-5 text-default-500">
                          {event.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="No activity yet"
                detail="Application changes will appear here automatically."
              />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
