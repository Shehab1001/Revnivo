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
  Archive,
  BriefcaseBusiness,
  Check,
  Copy,
  FileCheck2,
  FilePlus2,
  FileText,
  History,
  Plus,
  Printer,
  RotateCcw,
  Save,
  SearchCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import ResumePreview from '../components/ResumePreview'
import api from '../services/api'

const EDITOR_TABS = [
  { key: 'resume', label: 'Resume Builder', icon: FileText },
  { key: 'cover', label: 'Cover Letters', icon: FileCheck2 },
  { key: 'ats', label: 'ATS Match', icon: SearchCheck },
  { key: 'versions', label: 'Versions', icon: History },
]

const TEMPLATES = [
  { key: 'modern', label: 'Modern' },
  { key: 'classic', label: 'Classic' },
  { key: 'compact', label: 'Compact' },
  { key: 'minimal', label: 'Minimal' },
]

const SECTION_LABELS = {
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  languages: 'Languages',
}

function uid(prefix = 'item') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function emptyResume() {
  return {
    id: '',
    name: 'Untitled Resume',
    template: 'modern',
    accent: 'primary',
    profile: {
      full_name: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
      github: '',
    },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    section_order: [
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'languages',
    ],
    archived: false,
  }
}

function emptyCoverLetter() {
  return {
    id: '',
    name: 'Cover Letter',
    resume_id: '',
    application_id: '',
    company: '',
    job_title: '',
    recipient_name: '',
    salutation: 'Dear Hiring Manager,',
    body: '',
    closing: 'Sincerely,',
    archived: false,
  }
}

function SectionCard({
  title,
  description,
  children,
  action,
}) {
  return (
    <Card
      shadow="none"
      className="border border-default-200/80 bg-content1"
    >
      <CardBody className="gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-xs leading-5 text-default-500">
                {description}
              </p>
            )}
          </div>

          {action}
        </div>

        {children}
      </CardBody>
    </Card>
  )
}

function ListItemShell({
  title,
  onDelete,
  children,
}) {
  return (
    <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-default-400">
          {title}
        </div>

        <Button
          isIconOnly
          size="sm"
          variant="light"
          color="danger"
          onPress={onDelete}
          aria-label="Remove item"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {children}
    </div>
  )
}

function ScoreGauge({ score = 0 }) {
  const normalized = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  )

  return (
    <div className="grid h-36 w-36 place-items-center rounded-full bg-default-100 p-3">
      <div className="grid h-full w-full place-items-center rounded-full bg-content1 text-center shadow-sm">
        <div>
          <div className="text-3xl font-semibold tracking-tight text-primary">
            {normalized.toFixed(0)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-default-400">
            Match score
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResumeStudio() {
  const [resumes, setResumes] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(null)

  const [coverLetters, setCoverLetters] = useState([])
  const [selectedCoverId, setSelectedCoverId] = useState('')
  const [coverDraft, setCoverDraft] = useState(
    emptyCoverLetter()
  )

  const [tab, setTab] = useState('resume')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [versions, setVersions] = useState([])
  const [versionLabel, setVersionLabel] = useState('')

  const [jobDescription, setJobDescription] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  const loadLibrary = async () => {
    setLoading(true)
    setError('')

    try {
      const [resumeResponse, coverResponse] =
        await Promise.all([
          api.get('/resumes/'),
          api.get('/cover-letters/'),
        ])

      const resumeItems =
        resumeResponse.data.resumes || []
      const coverItems =
        coverResponse.data.cover_letters || []

      setResumes(resumeItems)
      setCoverLetters(coverItems)

      if (!selectedId && resumeItems.length) {
        setSelectedId(resumeItems[0].id)
        setDraft(resumeItems[0])
      } else if (!resumeItems.length) {
        setDraft(null)
      }

      if (!selectedCoverId && coverItems.length) {
        setSelectedCoverId(coverItems[0].id)
        setCoverDraft(coverItems[0])
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not load Resume Studio.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLibrary()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setVersions([])
      return
    }

    api
      .get(`/resumes/${selectedId}/versions/`)
      .then(({ data }) =>
        setVersions(data.versions || [])
      )
      .catch(() => setVersions([]))
  }, [selectedId])

  const selectedResume = useMemo(
    () =>
      resumes.find(
        (item) => item.id === selectedId
      ) || null,
    [resumes, selectedId]
  )

  const selectedCover = useMemo(
    () =>
      coverLetters.find(
        (item) => item.id === selectedCoverId
      ) || null,
    [coverLetters, selectedCoverId]
  )

  const selectResume = (resume) => {
    setSelectedId(resume.id)
    setDraft(structuredClone(resume))
    setAnalysis(null)
    setMessage('')
  }

  const selectCoverLetter = (letter) => {
    setSelectedCoverId(letter.id)
    setCoverDraft(structuredClone(letter))
    setMessage('')
  }

  const createResume = async () => {
    setSaving(true)
    setError('')

    try {
      const { data } = await api.post(
        '/resumes/',
        {
          name: `Resume ${resumes.length + 1}`,
        }
      )

      const resume = data.resume

      setResumes((items) => [
        resume,
        ...items,
      ])
      setSelectedId(resume.id)
      setDraft(resume)
      setTab('resume')
      setMessage('New resume created.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not create resume.'
      )
    } finally {
      setSaving(false)
    }
  }

  const saveResume = async () => {
    if (!draft?.id) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const { data } = await api.patch(
        `/resumes/${draft.id}/`,
        draft
      )

      setDraft(data.resume)
      setResumes((items) =>
        items.map((item) =>
          item.id === data.resume.id
            ? data.resume
            : item
        )
      )
      setMessage('Resume saved.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not save resume.'
      )
    } finally {
      setSaving(false)
    }
  }

  const duplicateResume = async () => {
    if (!draft?.id) return

    setSaving(true)

    try {
      const { data } = await api.post(
        `/resumes/${draft.id}/duplicate/`,
        {}
      )

      setResumes((items) => [
        data.resume,
        ...items,
      ])
      setSelectedId(data.resume.id)
      setDraft(data.resume)
      setMessage('Resume duplicated.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not duplicate resume.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteResume = async () => {
    if (!draft?.id) return

    const confirmed = window.confirm(
      `Delete "${draft.name}" and its saved versions?`
    )

    if (!confirmed) return

    try {
      await api.delete(
        `/resumes/${draft.id}/`
      )

      const next = resumes.filter(
        (item) => item.id !== draft.id
      )

      setResumes(next)
      setSelectedId(next[0]?.id || '')
      setDraft(next[0] || null)
      setMessage('Resume deleted.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not delete resume.'
      )
    }
  }

  const createVersion = async () => {
    if (!draft?.id) return

    try {
      await saveResume()

      const { data } = await api.post(
        `/resumes/${draft.id}/versions/`,
        {
          label: versionLabel,
        }
      )

      setVersions((items) => [
        data.version,
        ...items,
      ])
      setVersionLabel('')
      setMessage('Version snapshot created.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not create version.'
      )
    }
  }

  const restoreVersion = async (version) => {
    if (!draft?.id) return

    const confirmed = window.confirm(
      `Restore ${version.label || `Version ${version.version}`}?`
    )

    if (!confirmed) return

    try {
      const { data } = await api.post(
        `/resumes/${draft.id}/versions/${version.id}/restore/`,
        {}
      )

      setDraft(data.resume)
      setResumes((items) =>
        items.map((item) =>
          item.id === data.resume.id
            ? data.resume
            : item
        )
      )
      setMessage('Version restored.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not restore version.'
      )
    }
  }

  const createCoverLetter = async () => {
    setSaving(true)

    try {
      const { data } = await api.post(
        '/cover-letters/',
        {
          name: `Cover Letter ${coverLetters.length + 1}`,
          resume_id: selectedId || null,
        }
      )

      setCoverLetters((items) => [
        data.cover_letter,
        ...items,
      ])
      setSelectedCoverId(data.cover_letter.id)
      setCoverDraft(data.cover_letter)
      setTab('cover')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not create cover letter.'
      )
    } finally {
      setSaving(false)
    }
  }

  const saveCoverLetter = async () => {
    if (!coverDraft?.id) return

    setSaving(true)
    setError('')

    try {
      const { data } = await api.patch(
        `/cover-letters/${coverDraft.id}/`,
        {
          ...coverDraft,
          resume_id:
            coverDraft.resume_id || null,
          application_id:
            coverDraft.application_id || null,
        }
      )

      setCoverDraft(data.cover_letter)
      setCoverLetters((items) =>
        items.map((item) =>
          item.id === data.cover_letter.id
            ? data.cover_letter
            : item
        )
      )
      setMessage('Cover letter saved.')
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not save cover letter.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteCoverLetter = async () => {
    if (!coverDraft?.id) return

    const confirmed = window.confirm(
      `Delete "${coverDraft.name}"?`
    )

    if (!confirmed) return

    try {
      await api.delete(
        `/cover-letters/${coverDraft.id}/`
      )

      const next = coverLetters.filter(
        (item) => item.id !== coverDraft.id
      )

      setCoverLetters(next)
      setSelectedCoverId(next[0]?.id || '')
      setCoverDraft(
        next[0] || emptyCoverLetter()
      )
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not delete cover letter.'
      )
    }
  }

  const analyzeResume = async () => {
    if (!draft?.id) return

    setAnalyzing(true)
    setError('')

    try {
      await saveResume()

      const { data } = await api.post(
        `/resumes/${draft.id}/analyze/`,
        {
          job_description: jobDescription,
        }
      )

      setAnalysis(data)
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          'Could not analyze this resume.'
      )
    } finally {
      setAnalyzing(false)
    }
  }

  const updateProfile = (field, value) => {
    setDraft((current) => ({
      ...current,
      profile: {
        ...(current?.profile || {}),
        [field]: value,
      },
    }))
  }

  const updateListItem = (
    section,
    index,
    patch
  ) => {
    setDraft((current) => {
      const items = [
        ...(current?.[section] || []),
      ]

      items[index] = {
        ...items[index],
        ...patch,
      }

      return {
        ...current,
        [section]: items,
      }
    })
  }

  const removeListItem = (
    section,
    index
  ) => {
    setDraft((current) => ({
      ...current,
      [section]: (
        current?.[section] || []
      ).filter((_, itemIndex) =>
        itemIndex !== index
      ),
    }))
  }

  const addExperience = () => {
    setDraft((current) => ({
      ...current,
      experience: [
        ...(current?.experience || []),
        {
          id: uid('exp'),
          company: '',
          title: '',
          location: '',
          start_date: '',
          end_date: '',
          current: false,
          summary: '',
          bullets: [],
        },
      ],
    }))
  }

  const addEducation = () => {
    setDraft((current) => ({
      ...current,
      education: [
        ...(current?.education || []),
        {
          id: uid('edu'),
          school: '',
          degree: '',
          field: '',
          location: '',
          start_date: '',
          end_date: '',
          details: '',
        },
      ],
    }))
  }

  const addProject = () => {
    setDraft((current) => ({
      ...current,
      projects: [
        ...(current?.projects || []),
        {
          id: uid('project'),
          name: '',
          role: '',
          url: '',
          description: '',
          bullets: [],
          technologies: [],
        },
      ],
    }))
  }

  const addCertification = () => {
    setDraft((current) => ({
      ...current,
      certifications: [
        ...(current?.certifications || []),
        {
          id: uid('cert'),
          name: '',
          issuer: '',
          date: '',
          url: '',
        },
      ],
    }))
  }

  const addLanguage = () => {
    setDraft((current) => ({
      ...current,
      languages: [
        ...(current?.languages || []),
        {
          id: uid('lang'),
          language: '',
          level: '',
        },
      ],
    }))
  }

  const moveSection = (
    section,
    direction
  ) => {
    setDraft((current) => {
      const order = [
        ...(current?.section_order || []),
      ]
      const index = order.indexOf(section)
      const target = index + direction

      if (
        index < 0 ||
        target < 0 ||
        target >= order.length
      ) {
        return current
      }

      const next = [...order]
      ;[next[index], next[target]] = [
        next[target],
        next[index],
      ]

      return {
        ...current,
        section_order: next,
      }
    })
  }

  const printResume = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-2 text-sm text-default-500">
          <Spinner size="sm" />
          Loading Resume Studio...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-foreground">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #resume-print-area,
          #resume-print-area * {
            visibility: visible !important;
          }
          #resume-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            max-width: none !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <section className="rounded-3xl border border-default-200/80 bg-content1 p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Jobs · Career tools
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Resume Studio
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">
              Build multiple targeted resumes, preserve versions,
              write cover letters, compare truthful keyword coverage
              with a job description, and attach the right materials
              to each application.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="flat"
              startContent={<FilePlus2 size={16} />}
              onPress={createResume}
              isLoading={saving}
            >
              New resume
            </Button>

            {draft && (
              <>
                <Button
                  variant="flat"
                  startContent={<Copy size={16} />}
                  onPress={duplicateResume}
                >
                  Duplicate
                </Button>

                <Button
                  variant="flat"
                  startContent={<Printer size={16} />}
                  onPress={printResume}
                >
                  Print / PDF
                </Button>

                <Button
                  color="primary"
                  startContent={<Save size={16} />}
                  isLoading={saving}
                  onPress={saveResume}
                >
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-2xl border border-default-200/80 bg-content1 p-1.5">
          {EDITOR_TABS.map((item) => {
            const Icon = item.icon

            return (
              <button
                type="button"
                key={item.key}
                onClick={() => setTab(item.key)}
                className={
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ' +
                  (tab === item.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-default-500 hover:bg-default-100 hover:text-foreground')
                }
              >
                <Icon size={15} />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'resume' && (
        <div className="grid gap-4 2xl:grid-cols-[250px_minmax(0,1fr)_minmax(480px,0.95fr)]">
          <Card
            shadow="none"
            className="h-fit border border-default-200/80 bg-content1 2xl:sticky 2xl:top-4"
          >
            <CardBody className="gap-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Resume library
                </h2>
                <Chip size="sm" variant="flat">
                  {resumes.length}
                </Chip>
              </div>

              <div className="space-y-2">
                {resumes.length ? (
                  resumes.map((resume) => (
                    <button
                      type="button"
                      key={resume.id}
                      onClick={() =>
                        selectResume(resume)
                      }
                      className={
                        'w-full rounded-xl border p-3 text-left transition ' +
                        (resume.id === selectedId
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-default-200 bg-default-50 hover:border-primary/20')
                      }
                    >
                      <div className="truncate text-xs font-semibold">
                        {resume.name}
                      </div>
                      <div className="mt-1 text-[10px] text-default-400">
                        {resume.template} template
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-default-200 p-4 text-center text-xs text-default-400">
                    Create your first resume.
                  </div>
                )}
              </div>

              {draft && (
                <Button
                  color="danger"
                  variant="light"
                  size="sm"
                  startContent={<Trash2 size={14} />}
                  onPress={deleteResume}
                >
                  Delete resume
                </Button>
              )}
            </CardBody>
          </Card>

          {draft ? (
            <div className="space-y-4">
              <SectionCard
                title="Resume settings"
                description="Name this version and choose its layout."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Resume name"
                    value={draft.name}
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        name: value,
                      })
                    }
                  />

                  <Select
                    label="Template"
                    selectedKeys={
                      new Set([
                        draft.template ||
                          'modern',
                      ])
                    }
                    onSelectionChange={(keys) =>
                      setDraft({
                        ...draft,
                        template: String(
                          Array.from(keys)[0] ||
                            'modern'
                        ),
                      })
                    }
                  >
                    {TEMPLATES.map((item) => (
                      <SelectItem key={item.key}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </SectionCard>

              <SectionCard
                title="Contact & headline"
                description="These details appear at the top of the resume."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Full name"
                    value={
                      draft.profile?.full_name ||
                      ''
                    }
                    onValueChange={(value) =>
                      updateProfile(
                        'full_name',
                        value
                      )
                    }
                  />

                  <Input
                    label="Professional headline"
                    value={
                      draft.profile?.headline ||
                      ''
                    }
                    onValueChange={(value) =>
                      updateProfile(
                        'headline',
                        value
                      )
                    }
                  />

                  <Input
                    type="email"
                    label="Email"
                    value={
                      draft.profile?.email || ''
                    }
                    onValueChange={(value) =>
                      updateProfile('email', value)
                    }
                  />

                  <Input
                    label="Phone"
                    value={
                      draft.profile?.phone || ''
                    }
                    onValueChange={(value) =>
                      updateProfile('phone', value)
                    }
                  />

                  <Input
                    label="Location"
                    value={
                      draft.profile?.location ||
                      ''
                    }
                    onValueChange={(value) =>
                      updateProfile(
                        'location',
                        value
                      )
                    }
                  />

                  <Input
                    label="Website"
                    value={
                      draft.profile?.website ||
                      ''
                    }
                    onValueChange={(value) =>
                      updateProfile(
                        'website',
                        value
                      )
                    }
                  />

                  <Input
                    label="LinkedIn"
                    value={
                      draft.profile?.linkedin ||
                      ''
                    }
                    onValueChange={(value) =>
                      updateProfile(
                        'linkedin',
                        value
                      )
                    }
                  />

                  <Input
                    label="GitHub"
                    value={
                      draft.profile?.github ||
                      ''
                    }
                    onValueChange={(value) =>
                      updateProfile(
                        'github',
                        value
                      )
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Professional summary"
                description="Use a concise, factual summary tailored to the work you want."
              >
                <Textarea
                  minRows={5}
                  value={draft.summary || ''}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      summary: value,
                    })
                  }
                  placeholder="Senior analyst with experience in..."
                />
              </SectionCard>

              <SectionCard
                title="Section order"
                description="Move major sections up or down without changing their content."
              >
                <div className="space-y-2">
                  {(draft.section_order || []).map(
                    (section, index) => (
                      <div
                        key={section}
                        className="flex items-center justify-between rounded-xl border border-default-200 bg-default-50 px-3 py-2"
                      >
                        <span className="text-xs font-medium">
                          {SECTION_LABELS[
                            section
                          ] || section}
                        </span>

                        <div className="flex gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            isDisabled={index === 0}
                            onPress={() =>
                              moveSection(
                                section,
                                -1
                              )
                            }
                          >
                            ↑
                          </Button>

                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            isDisabled={
                              index ===
                              draft.section_order
                                .length -
                                1
                            }
                            onPress={() =>
                              moveSection(
                                section,
                                1
                              )
                            }
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Experience"
                description="Use impact-oriented bullets and measurable results where they are accurate."
                action={
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Plus size={14} />}
                    onPress={addExperience}
                  >
                    Add
                  </Button>
                }
              >
                <div className="space-y-3">
                  {(draft.experience || []).map(
                    (item, index) => (
                      <ListItemShell
                        key={item.id || index}
                        title={
                          item.title ||
                          `Experience ${index + 1}`
                        }
                        onDelete={() =>
                          removeListItem(
                            'experience',
                            index
                          )
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Job title"
                            value={item.title}
                            onValueChange={(value) =>
                              updateListItem(
                                'experience',
                                index,
                                { title: value }
                              )
                            }
                          />
                          <Input
                            label="Company"
                            value={item.company}
                            onValueChange={(value) =>
                              updateListItem(
                                'experience',
                                index,
                                { company: value }
                              )
                            }
                          />
                          <Input
                            label="Location"
                            value={item.location}
                            onValueChange={(value) =>
                              updateListItem(
                                'experience',
                                index,
                                { location: value }
                              )
                            }
                          />
                          <Input
                            label="Start"
                            value={item.start_date}
                            onValueChange={(value) =>
                              updateListItem(
                                'experience',
                                index,
                                {
                                  start_date:
                                    value,
                                }
                              )
                            }
                            placeholder="Jan 2024"
                          />
                          <Input
                            label="End"
                            value={item.end_date}
                            onValueChange={(value) =>
                              updateListItem(
                                'experience',
                                index,
                                {
                                  end_date:
                                    value,
                                }
                              )
                            }
                            placeholder="Present"
                          />
                        </div>

                        <Textarea
                          className="mt-3"
                          label="Role summary"
                          minRows={2}
                          value={item.summary}
                          onValueChange={(value) =>
                            updateListItem(
                              'experience',
                              index,
                              { summary: value }
                            )
                          }
                        />

                        <Textarea
                          className="mt-3"
                          label="Achievement bullets"
                          minRows={4}
                          value={(item.bullets || []).join(
                            '\n'
                          )}
                          onValueChange={(value) =>
                            updateListItem(
                              'experience',
                              index,
                              {
                                bullets: value
                                  .split('\n')
                                  .map((line) =>
                                    line.trim()
                                  )
                                  .filter(Boolean),
                              }
                            )
                          }
                          placeholder="One bullet per line"
                        />
                      </ListItemShell>
                    )
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Education"
                action={
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Plus size={14} />}
                    onPress={addEducation}
                  >
                    Add
                  </Button>
                }
              >
                <div className="space-y-3">
                  {(draft.education || []).map(
                    (item, index) => (
                      <ListItemShell
                        key={item.id || index}
                        title={
                          item.degree ||
                          `Education ${index + 1}`
                        }
                        onDelete={() =>
                          removeListItem(
                            'education',
                            index
                          )
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            ['school', 'School'],
                            ['degree', 'Degree'],
                            ['field', 'Field'],
                            ['location', 'Location'],
                            ['start_date', 'Start'],
                            ['end_date', 'End'],
                          ].map(
                            ([field, label]) => (
                              <Input
                                key={field}
                                label={label}
                                value={
                                  item[field] || ''
                                }
                                onValueChange={(
                                  value
                                ) =>
                                  updateListItem(
                                    'education',
                                    index,
                                    {
                                      [field]:
                                        value,
                                    }
                                  )
                                }
                              />
                            )
                          )}
                        </div>

                        <Textarea
                          className="mt-3"
                          label="Details"
                          minRows={2}
                          value={item.details || ''}
                          onValueChange={(value) =>
                            updateListItem(
                              'education',
                              index,
                              { details: value }
                            )
                          }
                        />
                      </ListItemShell>
                    )
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Skills"
                description="Comma-separated tools, methods, and capabilities."
              >
                <Textarea
                  minRows={4}
                  value={(draft.skills || []).join(
                    ', '
                  )}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      skills: value
                        .split(',')
                        .map((item) =>
                          item.trim()
                        )
                        .filter(Boolean),
                    })
                  }
                  placeholder="Python, SQL, Power BI, Financial Modeling..."
                />
              </SectionCard>

              <SectionCard
                title="Projects"
                action={
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Plus size={14} />}
                    onPress={addProject}
                  >
                    Add
                  </Button>
                }
              >
                <div className="space-y-3">
                  {(draft.projects || []).map(
                    (item, index) => (
                      <ListItemShell
                        key={item.id || index}
                        title={
                          item.name ||
                          `Project ${index + 1}`
                        }
                        onDelete={() =>
                          removeListItem(
                            'projects',
                            index
                          )
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Project name"
                            value={item.name}
                            onValueChange={(value) =>
                              updateListItem(
                                'projects',
                                index,
                                { name: value }
                              )
                            }
                          />
                          <Input
                            label="Role"
                            value={item.role}
                            onValueChange={(value) =>
                              updateListItem(
                                'projects',
                                index,
                                { role: value }
                              )
                            }
                          />
                          <Input
                            label="URL"
                            value={item.url}
                            onValueChange={(value) =>
                              updateListItem(
                                'projects',
                                index,
                                { url: value }
                              )
                            }
                          />
                          <Input
                            label="Technologies"
                            value={(
                              item.technologies ||
                              []
                            ).join(', ')}
                            onValueChange={(value) =>
                              updateListItem(
                                'projects',
                                index,
                                {
                                  technologies:
                                    value
                                      .split(',')
                                      .map((entry) =>
                                        entry.trim()
                                      )
                                      .filter(Boolean),
                                }
                              )
                            }
                          />
                        </div>

                        <Textarea
                          className="mt-3"
                          label="Description"
                          minRows={3}
                          value={
                            item.description || ''
                          }
                          onValueChange={(value) =>
                            updateListItem(
                              'projects',
                              index,
                              {
                                description:
                                  value,
                              }
                            )
                          }
                        />
                      </ListItemShell>
                    )
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Certifications"
                action={
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Plus size={14} />}
                    onPress={addCertification}
                  >
                    Add
                  </Button>
                }
              >
                <div className="space-y-3">
                  {(draft.certifications || []).map(
                    (item, index) => (
                      <ListItemShell
                        key={item.id || index}
                        title={
                          item.name ||
                          `Certification ${index + 1}`
                        }
                        onDelete={() =>
                          removeListItem(
                            'certifications',
                            index
                          )
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            ['name', 'Name'],
                            ['issuer', 'Issuer'],
                            ['date', 'Date'],
                            ['url', 'Credential URL'],
                          ].map(
                            ([field, label]) => (
                              <Input
                                key={field}
                                label={label}
                                value={
                                  item[field] || ''
                                }
                                onValueChange={(
                                  value
                                ) =>
                                  updateListItem(
                                    'certifications',
                                    index,
                                    {
                                      [field]:
                                        value,
                                    }
                                  )
                                }
                              />
                            )
                          )}
                        </div>
                      </ListItemShell>
                    )
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Languages"
                action={
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Plus size={14} />}
                    onPress={addLanguage}
                  >
                    Add
                  </Button>
                }
              >
                <div className="space-y-3">
                  {(draft.languages || []).map(
                    (item, index) => (
                      <ListItemShell
                        key={item.id || index}
                        title={
                          item.language ||
                          `Language ${index + 1}`
                        }
                        onDelete={() =>
                          removeListItem(
                            'languages',
                            index
                          )
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Language"
                            value={item.language}
                            onValueChange={(value) =>
                              updateListItem(
                                'languages',
                                index,
                                {
                                  language:
                                    value,
                                }
                              )
                            }
                          />
                          <Input
                            label="Level"
                            value={item.level}
                            onValueChange={(value) =>
                              updateListItem(
                                'languages',
                                index,
                                { level: value }
                              )
                            }
                            placeholder="Native, C1, Professional..."
                          />
                        </div>
                      </ListItemShell>
                    )
                  )}
                </div>
              </SectionCard>
            </div>
          ) : (
            <Card
              shadow="none"
              className="border border-default-200/80 bg-content1"
            >
              <CardBody className="grid min-h-72 place-items-center text-center">
                <div>
                  <FileText
                    size={34}
                    className="mx-auto text-default-300"
                  />
                  <div className="mt-3 text-sm font-semibold">
                    No resume selected
                  </div>
                  <p className="mt-1 text-xs text-default-500">
                    Create a resume to start building.
                  </p>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="h-fit overflow-hidden rounded-2xl border border-default-200 bg-default-100 p-3 2xl:sticky 2xl:top-4">
            {draft ? (
              <ResumePreview resume={draft} />
            ) : (
              <div className="grid min-h-96 place-items-center text-xs text-default-400">
                Live preview
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'cover' && (
        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_minmax(360px,0.8fr)]">
          <Card
            shadow="none"
            className="h-fit border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Cover letters
                </h2>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={createCoverLetter}
                >
                  <Plus size={14} />
                </Button>
              </div>

              {coverLetters.map((letter) => (
                <button
                  type="button"
                  key={letter.id}
                  onClick={() =>
                    selectCoverLetter(letter)
                  }
                  className={
                    'w-full rounded-xl border p-3 text-left transition ' +
                    (letter.id === selectedCoverId
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-default-200 bg-default-50')
                  }
                >
                  <div className="truncate text-xs font-semibold">
                    {letter.name}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-default-400">
                    {letter.company ||
                      'No company yet'}
                  </div>
                </button>
              ))}

              {!coverLetters.length && (
                <div className="rounded-xl border border-dashed border-default-200 p-4 text-center text-xs text-default-400">
                  Create a cover letter.
                </div>
              )}
            </CardBody>
          </Card>

          {coverDraft?.id ? (
            <Card
              shadow="none"
              className="border border-default-200/80 bg-content1"
            >
              <CardBody className="gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">
                      Cover Letter Builder
                    </h2>
                    <p className="mt-1 text-xs text-default-500">
                      Keep each letter targeted to one role.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      color="danger"
                      variant="light"
                      size="sm"
                      startContent={
                        <Trash2 size={14} />
                      }
                      onPress={deleteCoverLetter}
                    >
                      Delete
                    </Button>
                    <Button
                      color="primary"
                      size="sm"
                      startContent={
                        <Save size={14} />
                      }
                      isLoading={saving}
                      onPress={saveCoverLetter}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Letter name"
                    value={coverDraft.name}
                    onValueChange={(value) =>
                      setCoverDraft({
                        ...coverDraft,
                        name: value,
                      })
                    }
                  />

                  <Select
                    label="Based on resume"
                    selectedKeys={
                      coverDraft.resume_id
                        ? new Set([
                            coverDraft.resume_id,
                          ])
                        : new Set([])
                    }
                    onSelectionChange={(keys) =>
                      setCoverDraft({
                        ...coverDraft,
                        resume_id: String(
                          Array.from(keys)[0] ||
                            ''
                        ),
                      })
                    }
                  >
                    {resumes.map((resume) => (
                      <SelectItem key={resume.id}>
                        {resume.name}
                      </SelectItem>
                    ))}
                  </Select>

                  <Input
                    label="Company"
                    value={coverDraft.company}
                    onValueChange={(value) =>
                      setCoverDraft({
                        ...coverDraft,
                        company: value,
                      })
                    }
                  />

                  <Input
                    label="Job title"
                    value={coverDraft.job_title}
                    onValueChange={(value) =>
                      setCoverDraft({
                        ...coverDraft,
                        job_title: value,
                      })
                    }
                  />

                  <Input
                    label="Recipient"
                    value={
                      coverDraft.recipient_name
                    }
                    onValueChange={(value) =>
                      setCoverDraft({
                        ...coverDraft,
                        recipient_name: value,
                      })
                    }
                  />

                  <Input
                    label="Salutation"
                    value={coverDraft.salutation}
                    onValueChange={(value) =>
                      setCoverDraft({
                        ...coverDraft,
                        salutation: value,
                      })
                    }
                  />
                </div>

                <Textarea
                  label="Letter body"
                  minRows={18}
                  value={coverDraft.body}
                  onValueChange={(value) =>
                    setCoverDraft({
                      ...coverDraft,
                      body: value,
                    })
                  }
                  placeholder="Explain the relevant evidence behind your interest and fit for the role..."
                />

                <Input
                  label="Closing"
                  value={coverDraft.closing}
                  onValueChange={(value) =>
                    setCoverDraft({
                      ...coverDraft,
                      closing: value,
                    })
                  }
                />
              </CardBody>
            </Card>
          ) : (
            <Card
              shadow="none"
              className="border border-default-200/80 bg-content1"
            >
              <CardBody className="grid min-h-72 place-items-center text-center text-xs text-default-400">
                Create a cover letter to begin.
              </CardBody>
            </Card>
          )}

          <div className="h-fit rounded-2xl border border-default-200 bg-white p-8 text-slate-900 shadow-sm xl:sticky xl:top-4">
            <div className="text-xs leading-6">
              <div>
                {coverDraft?.salutation ||
                  'Dear Hiring Manager,'}
              </div>

              <div className="mt-5 whitespace-pre-wrap">
                {coverDraft?.body ||
                  'Your cover letter preview will appear here.'}
              </div>

              <div className="mt-6">
                {coverDraft?.closing ||
                  'Sincerely,'}
              </div>

              <div className="mt-1 font-semibold">
                {draft?.profile?.full_name ||
                  selectedResume?.profile
                    ?.full_name ||
                  'Your Name'}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'ats' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-4 p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Job description match
                </h2>
                <p className="mt-1 text-xs leading-5 text-default-500">
                  Paste the full role description. Revnivo compares
                  keyword coverage and resume completeness. It does
                  not claim to reproduce an employer's ATS.
                </p>
              </div>

              <Select
                label="Resume to analyze"
                selectedKeys={
                  selectedId
                    ? new Set([selectedId])
                    : new Set([])
                }
                onSelectionChange={(keys) => {
                  const id = String(
                    Array.from(keys)[0] || ''
                  )
                  const resume = resumes.find(
                    (item) => item.id === id
                  )

                  if (resume) {
                    selectResume(resume)
                  }
                }}
              >
                {resumes.map((resume) => (
                  <SelectItem key={resume.id}>
                    {resume.name}
                  </SelectItem>
                ))}
              </Select>

              <Textarea
                minRows={18}
                label="Job description"
                value={jobDescription}
                onValueChange={setJobDescription}
                placeholder="Paste the complete job description here..."
              />

              <Button
                color="primary"
                startContent={
                  <Sparkles size={15} />
                }
                isLoading={analyzing}
                onPress={analyzeResume}
              >
                Analyze match
              </Button>
            </CardBody>
          </Card>

          <div className="space-y-4">
            {analysis ? (
              <>
                <Card
                  shadow="none"
                  className="border border-default-200/80 bg-content1"
                >
                  <CardBody className="items-center gap-4 p-5">
                    <ScoreGauge
                      score={analysis.score}
                    />

                    <div className="grid w-full grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-default-50 p-3">
                        <div className="text-lg font-semibold">
                          {analysis.keyword_score}%
                        </div>
                        <div className="text-[10px] text-default-400">
                          Keywords
                        </div>
                      </div>
                      <div className="rounded-xl bg-default-50 p-3">
                        <div className="text-lg font-semibold">
                          {analysis.phrase_score}%
                        </div>
                        <div className="text-[10px] text-default-400">
                          Phrases
                        </div>
                      </div>
                      <div className="rounded-xl bg-default-50 p-3">
                        <div className="text-lg font-semibold">
                          {
                            analysis.completeness_score
                          }%
                        </div>
                        <div className="text-[10px] text-default-400">
                          Complete
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-[10px] leading-4 text-default-400">
                      {analysis.disclaimer}
                    </p>
                  </CardBody>
                </Card>

                <SectionCard title="Matched keywords">
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.matched_keywords ||
                      []).map((keyword) => (
                      <Chip
                        key={keyword}
                        size="sm"
                        variant="flat"
                        color="success"
                      >
                        {keyword}
                      </Chip>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Missing keywords to review">
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.missing_keywords ||
                      []).map((keyword) => (
                      <Chip
                        key={keyword}
                        size="sm"
                        variant="flat"
                        color="warning"
                      >
                        {keyword}
                      </Chip>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Recommendations">
                  <div className="space-y-2">
                    {(analysis.recommendations ||
                      []).map(
                      (recommendation, index) => (
                        <div
                          key={index}
                          className="flex gap-2 rounded-xl bg-default-50 p-3 text-xs leading-5 text-default-600"
                        >
                          <Check
                            size={14}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                          {recommendation}
                        </div>
                      )
                    )}
                  </div>
                </SectionCard>
              </>
            ) : (
              <Card
                shadow="none"
                className="border border-default-200/80 bg-content1"
              >
                <CardBody className="grid min-h-72 place-items-center text-center">
                  <div>
                    <SearchCheck
                      size={34}
                      className="mx-auto text-default-300"
                    />
                    <div className="mt-3 text-sm font-semibold">
                      No analysis yet
                    </div>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-default-500">
                      Choose a resume and paste a job description to
                      compare truthful keyword coverage.
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'versions' && (
        <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
          <Card
            shadow="none"
            className="h-fit border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-4 p-5">
              <div>
                <h2 className="text-base font-semibold">
                  Create snapshot
                </h2>
                <p className="mt-1 text-xs leading-5 text-default-500">
                  Preserve a stable version before tailoring the resume for another role.
                </p>
              </div>

              <Select
                label="Resume"
                selectedKeys={
                  selectedId
                    ? new Set([selectedId])
                    : new Set([])
                }
                onSelectionChange={(keys) => {
                  const id = String(
                    Array.from(keys)[0] || ''
                  )
                  const resume = resumes.find(
                    (item) => item.id === id
                  )

                  if (resume) {
                    selectResume(resume)
                  }
                }}
              >
                {resumes.map((resume) => (
                  <SelectItem key={resume.id}>
                    {resume.name}
                  </SelectItem>
                ))}
              </Select>

              <Input
                label="Version label"
                value={versionLabel}
                onValueChange={setVersionLabel}
                placeholder="Mercor AI Engineer"
              />

              <Button
                color="primary"
                startContent={<History size={15} />}
                isDisabled={!draft}
                onPress={createVersion}
              >
                Save snapshot
              </Button>
            </CardBody>
          </Card>

          <Card
            shadow="none"
            className="border border-default-200/80 bg-content1"
          >
            <CardBody className="gap-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Version history
                  </h2>
                  <p className="mt-1 text-xs text-default-500">
                    Restore any stored snapshot into the current resume.
                  </p>
                </div>

                <Chip size="sm" variant="flat">
                  {versions.length}
                </Chip>
              </div>

              {versions.length ? (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex flex-col gap-3 rounded-xl border border-default-200 bg-default-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {version.label ||
                          `Version ${version.version}`}
                      </div>
                      <div className="mt-1 text-[10px] text-default-400">
                        Version {version.version}
                        {' · '}
                        {version.created_at
                          ? new Date(
                              version.created_at
                            ).toLocaleString()
                          : ''}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="flat"
                      startContent={
                        <RotateCcw size={14} />
                      }
                      onPress={() =>
                        restoreVersion(version)
                      }
                    >
                      Restore
                    </Button>
                  </div>
                ))
              ) : (
                <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-default-200 text-center text-xs text-default-400">
                  No saved versions for this resume yet.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
