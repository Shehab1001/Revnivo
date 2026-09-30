import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Spinner,
} from '@heroui/react'
import {
  BriefcaseBusiness,
  Building2,
  DollarSign,
  ExternalLink,
  Globe2,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import api from '../services/api'

const ALL = 'all'

const statusLabel = {
  live: 'Live listings',
  browse: 'Browse official site',
  directory: 'Account-matched roles',
  account_only: 'Sign in to view matched jobs',
  api_key_needed: 'API key needed for full sync',
  partial: 'Partial public sync',
  syncing: 'Syncing roles...',
  unavailable: 'Temporarily unavailable',
}

const statusColor = {
  live: 'success',
  browse: 'primary',
  directory: 'secondary',
  account_only: 'secondary',
  api_key_needed: 'warning',
  partial: 'warning',
  syncing: 'primary',
  unavailable: 'warning',
}

function SourceMark({ name }) {
  const initials = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-default-200 bg-default-100 text-sm font-bold text-foreground">
      {initials || 'AI'}
    </div>
  )
}

function JobCard({ job }) {
  return (
    <Card
      shadow="none"
      className="border border-default-200/80 bg-content1"
    >
      <CardBody className="gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <SourceMark name={job.platform} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-default-400">
                {job.platform}
              </p>

              {job.remote && (
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

            <h3 className="mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
              {job.title}
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-default-500">
          {job.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {job.location}
            </span>
          )}

          {job.pay && (
            <span className="inline-flex items-center gap-1.5">
              <DollarSign size={14} />
              {job.pay}
            </span>
          )}

          {job.employment_type && (
            <span className="inline-flex items-center gap-1.5">
              <BriefcaseBusiness size={14} />
              {job.employment_type}
            </span>
          )}

          {job.category && (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={14} />
              {job.category}
            </span>
          )}
        </div>

        {job.summary && (
          <p className="line-clamp-3 text-sm leading-6 text-default-500">
            {job.summary}
          </p>
        )}

        <div className="mt-auto flex items-center justify-end border-t border-divider pt-3">
          <Button
            as="a"
            href={job.url}
            target="_blank"
            rel="noreferrer"
            color="primary"
            radius="lg"
            size="sm"
            endContent={<ExternalLink size={14} />}
          >
            View role
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function PlatformCard({ source }) {
  return (
    <Card
      shadow="none"
      className="border border-default-200/80 bg-content1"
    >
      <CardBody className="gap-3 p-4">
        <div className="flex items-center gap-3">
          <SourceMark name={source.name} />

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">
              {source.name}
            </div>
            <div className="mt-0.5 text-xs text-default-400">
              {source.job_count
                ? source.reported_total > source.job_count
                  ? `${source.job_count.toLocaleString()} loaded of ${source.reported_total.toLocaleString()} reported`
                  : `${source.job_count.toLocaleString()} public roles loaded`
                : source.status === 'account_only'
                  ? 'Jobs are personalized after sign-in'
                  : source.status === 'api_key_needed'
                    ? 'Add the platform API key for exhaustive sync'
                    : 'No public roles detected right now'}
            </div>
          </div>
        </div>

        <p className="min-h-10 text-xs leading-5 text-default-500">
          {source.description}
        </p>

        <div className="flex items-center justify-between gap-2">
          <Chip
            size="sm"
            variant="flat"
            color={statusColor[source.status] || 'default'}
            className="max-w-[70%] text-[10px]"
          >
            {statusLabel[source.status] || source.status}
          </Chip>

          <Button
            as="a"
            href={source.browse_url}
            target="_blank"
            rel="noreferrer"
            isIconOnly
            size="sm"
            variant="light"
            aria-label={`Open ${source.name}`}
          >
            <ExternalLink size={15} />
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export default function Jobs() {
  const [payload, setPayload] = useState({
    jobs: [],
    sources: [],
    total: 0,
    live_sources: 0,
    refreshing: false,
    sync_completed_sources: 0,
    sync_total_sources: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [sortBy, setSortBy] = useState('platform')
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 60

  const loadJobs = async (
    refresh = false,
    silent = false
  ) => {
    if (refresh) {
      setRefreshing(true)
    } else if (!silent) {
      setLoading(true)
    }

    if (!silent) {
      setError('')
    }

    try {
      const { data } = await api.get('/jobs/', {
        params: refresh ? { refresh: 1 } : {},
      })

      setPayload(data)
      setRefreshing(Boolean(data.refreshing))

      if (data.sync_error) {
        setError(data.sync_error)
      }
    } catch (requestError) {
      const detail =
        requestError.response?.data?.detail

      setError(
        detail ||
        (requestError.code === 'ECONNABORTED'
          ? 'The jobs request timed out.'
          : 'Could not load the jobs feed right now.')
      )

      if (refresh) {
        setRefreshing(false)
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  useEffect(() => {
    if (!payload.refreshing) return undefined

    const timer = window.setTimeout(
      () => loadJobs(false, true),
      3000
    )

    return () => window.clearTimeout(timer)
  }, [
    payload.refreshing,
    payload.sync_completed_sources,
  ])

  const categories = useMemo(
    () =>
      [...new Set(
        payload.jobs
          .map((job) => job.category)
          .filter(Boolean)
      )].sort(),
    [payload.jobs]
  )

  const filteredJobs = useMemo(() => {
    const needle = search.trim().toLowerCase()

    const items = payload.jobs.filter((job) => {
      if (
        platform !== ALL &&
        job.platform_key !== platform
      ) {
        return false
      }

      if (
        category !== ALL &&
        job.category !== category
      ) {
        return false
      }

      if (remoteOnly && !job.remote) {
        return false
      }

      if (!needle) return true

      return [
        job.title,
        job.platform,
        job.location,
        job.pay,
        job.category,
        job.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })

    return [...items].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title)
      }

      if (sortBy === 'category') {
        return String(a.category || '').localeCompare(
          String(b.category || '')
        )
      }

      return (
        a.platform.localeCompare(b.platform) ||
        a.title.localeCompare(b.title)
      )
    })
  }, [
    payload.jobs,
    search,
    platform,
    category,
    remoteOnly,
    sortBy,
  ])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredJobs.length / PAGE_SIZE)
  )

  const visibleJobs = useMemo(
    () =>
      filteredJobs.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
      ),
    [filteredJobs, page]
  )

  useEffect(() => {
    setPage(1)
  }, [
    search,
    platform,
    category,
    remoteOnly,
    sortBy,
  ])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const clearFilters = () => {
    setSearch('')
    setPlatform(ALL)
    setCategory(ALL)
    setRemoteOnly(false)
    setSortBy('platform')
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-default-200/80 bg-content1">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <BriefcaseBusiness size={15} />
              Opportunity hub
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              AI Training Jobs
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-default-500">
              Browse the individual public roles currently exposed by
              AI training and expert-work platforms in one place. Revnivo
              loads each role as its own listing; platforms that only reveal
              personalized jobs after sign-in are clearly marked below.
            </p>

            {payload.refreshing && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
                Syncing job sources
                {payload.sync_total_sources
                  ? ` — ${payload.sync_completed_sources}/${payload.sync_total_sources} sources completed`
                  : '...'}
              </div>
            )}
          </div>

          <Button
            color="primary"
            variant="flat"
            radius="lg"
            isLoading={refreshing || payload.refreshing}
            startContent={
              refreshing
                ? null
                : <RefreshCw size={16} />
            }
            onPress={() => loadJobs(true)}
          >
            Refresh listings
          </Button>
        </div>

        <div className="grid border-t border-divider sm:grid-cols-3">
          <div className="p-4 sm:p-5">
            <div className="text-2xl font-semibold text-foreground">
              {(payload.total || 0).toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-default-500">
              Public roles loaded
            </div>
          </div>

          <div className="border-t border-divider p-4 sm:border-l sm:border-t-0 sm:p-5">
            <div className="text-2xl font-semibold text-foreground">
              {payload.sources.length}
            </div>
            <div className="mt-1 text-xs text-default-500">
              Platforms tracked
            </div>
          </div>

          <div className="border-t border-divider p-4 sm:border-l sm:border-t-0 sm:p-5">
            <div className="text-2xl font-semibold text-foreground">
              {payload.live_sources || 0}
            </div>
            <div className="mt-1 text-xs text-default-500">
              Sources with live roles
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-default-200/80 bg-content1 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal size={16} />
          Filter opportunities
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.5fr)_1fr_1fr_1fr_auto]">
          <Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search role, skill, platform..."
            startContent={
              <Search
                size={16}
                className="text-default-400"
              />
            }
            classNames={{
              inputWrapper:
                'border border-default-200 bg-default-100/60',
            }}
          />

          <Select
            disableAnimation
            aria-label="Platform"
            selectedKeys={[platform]}
            onSelectionChange={(keys) =>
              setPlatform(
                String([...keys][0] || ALL)
              )
            }
            classNames={{
              trigger:
                'border border-default-200 bg-default-100/60',
            }}
          >
            <SelectItem key={ALL}>
              All platforms
            </SelectItem>
            {payload.sources.map((source) => (
              <SelectItem key={source.key}>
                {source.name}
              </SelectItem>
            ))}
          </Select>

          <Select
            disableAnimation
            aria-label="Category"
            selectedKeys={[category]}
            onSelectionChange={(keys) =>
              setCategory(
                String([...keys][0] || ALL)
              )
            }
            classNames={{
              trigger:
                'border border-default-200 bg-default-100/60',
            }}
          >
            <SelectItem key={ALL}>
              All categories
            </SelectItem>
            {categories.map((item) => (
              <SelectItem key={item}>
                {item}
              </SelectItem>
            ))}
          </Select>

          <Select
            disableAnimation
            aria-label="Sort jobs"
            selectedKeys={[sortBy]}
            onSelectionChange={(keys) =>
              setSortBy(
                String([...keys][0] || 'platform')
              )
            }
            classNames={{
              trigger:
                'border border-default-200 bg-default-100/60',
            }}
          >
            <SelectItem key="platform">
              Sort by platform
            </SelectItem>
            <SelectItem key="title">
              Sort by title
            </SelectItem>
            <SelectItem key="category">
              Sort by category
            </SelectItem>
          </Select>

          <Button
            radius="lg"
            variant={remoteOnly ? 'solid' : 'flat'}
            color={remoteOnly ? 'primary' : 'default'}
            startContent={<Globe2 size={16} />}
            onPress={() => setRemoteOnly((value) => !value)}
          >
            Remote only
          </Button>
        </div>

        {(search ||
          platform !== ALL ||
          category !== ALL ||
          remoteOnly ||
          sortBy !== 'platform') && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="light"
              onPress={clearFilters}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Open opportunities
            </h2>
            <p className="mt-0.5 text-xs text-default-500">
              {filteredJobs.length.toLocaleString()} matching roles
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-default-200/80 bg-content1">
            <div className="flex flex-col items-center gap-3 text-sm text-default-500">
              <Spinner size="lg" />
              Checking official job sources...
            </div>
          </div>
        ) : filteredJobs.length ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-default-300 bg-content1 px-5 py-14 text-center">
            <BriefcaseBusiness
              size={30}
              className="mx-auto text-default-300"
            />
            <div className="mt-3 text-sm font-semibold text-foreground">
              No matching public roles
            </div>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-default-500">
              Try clearing filters or refreshing the feed. If a platform
              only reveals jobs after sign-in or profile matching, use its
              official access card below.
            </p>
          </div>
        )}

        {!loading && filteredJobs.length > PAGE_SIZE && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Pagination
              showControls
              page={page}
              total={totalPages}
              onChange={setPage}
              color="primary"
              variant="flat"
            />
            <div className="text-xs text-default-400">
              Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
              {Math.min(page * PAGE_SIZE, filteredJobs.length).toLocaleString()}
              {' '}of {filteredJobs.length.toLocaleString()} roles
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            AI training platforms
          </h2>
          <p className="mt-0.5 text-xs text-default-500">
            Source status, loaded role counts, and direct access for
            platforms whose jobs are account-only.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {payload.sources.map((source) => (
            <PlatformCard
              key={source.key}
              source={source}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
