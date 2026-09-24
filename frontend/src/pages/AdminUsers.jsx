import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
} from '@heroui/react'

import {
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react'

import { useEffect, useMemo, useState } from 'react'

import Loading from '../components/Loading'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import api from '../services/api'
import { formatDate } from '../utils/format'

const SUPERADMIN_EMAIL = 'dev.shehabsaid@gmail.com'

function Stat({ label, value, icon: Icon, accent = 'primary' }) {
  const accents = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    secondary: 'bg-secondary/10 text-secondary',
    warning: 'bg-warning/10 text-warning',
  }

  return (
    <Card
      radius="lg"
      className="
        border
        border-default-200/60
        bg-content1
        text-foreground
        shadow-sm
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:shadow-md
        dark:border-white/5
        dark:shadow-none
      "
    >
      <CardBody className="flex flex-row items-center gap-4 p-5">
        <span
          className={`
            grid
            h-11
            w-11
            shrink-0
            place-items-center
            rounded-xl
            ${accents[accent]}
          `}
        >
          <Icon size={19} />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-medium text-default-500">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

export default function AdminUsers() {
  const [data, setData] = useState({
    stats: {},
    users: [],
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const pageSize = 8

  const load = () => {
    setLoading(true)
    setError('')

    return api
      .get('/admin/users/')
      .then(({ data: response }) =>
        setData(
          Array.isArray(response)
            ? {
                stats: {
                  total: response.length,
                },
                users: response,
              }
            : response
        )
      )
      .catch((err) =>
        setError(
          err.response?.data?.detail ||
            'Could not load users.'
        )
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () =>
      data.users
        .filter((user) =>
          `${user.name || ''} ${user.email || ''} ${user.role || ''}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort((a, b) =>
          (a.name || a.email || '').localeCompare(
            b.name || b.email || '',
            undefined,
            {
              sensitivity: 'base',
            }
          )
        ),
    [data.users, search]
  )

  const pages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  )

  const users = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  const protectedUser = (user) =>
    user.email?.toLowerCase() === SUPERADMIN_EMAIL

  const changeRole = async (user) => {
    if (protectedUser(user)) return

    try {
      await api.patch('/admin/users/', {
        id: user.id,
        role: user.role === 'admin' ? 'user' : 'admin',
      })

      load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not update this user.'
      )
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete('/admin/users/', {
        data: {
          id: deleteTarget.id,
        },
      })
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not delete this user.'
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <Loading label="Loading users..." />
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Users dashboard
        </h1>

        <p className="mt-1 text-sm text-default-500">
          Manage users, permissions and free trials.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="
            rounded-xl
            border
            border-danger/25
            bg-danger/10
            p-4
            text-sm
            text-danger
          "
        >
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total users"
          value={data.stats.total || 0}
          icon={UsersIcon}
          accent="primary"
        />

        <Stat
          label="Regular users"
          value={data.stats.users || 0}
          icon={UserCheck}
          accent="secondary"
        />

        <Stat
          label="Admins"
          value={data.stats.admins || 0}
          icon={ShieldCheck}
          accent="success"
        />

        <Stat
          label="Active free trials"
          value={data.stats.active_trials || 0}
          icon={UserCheck}
          accent="warning"
        />
      </div>

      {/* Users table */}
      <Card
        radius="lg"
        className="
          overflow-hidden
          border
          border-default-200/60
          bg-content1
          text-foreground
          shadow-sm
          dark:border-white/5
          dark:shadow-none
        "
      >
        <CardBody className="p-0">
          {/* Search */}
          <div className="flex items-center justify-between gap-4 border-b border-divider p-4">
            <Input
              aria-label="Search users"
              value={search}
              onValueChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder="Search users..."
              startContent={
                <Search
                  size={16}
                  className="text-default-400"
                />
              }
              className="max-w-sm"
              variant="bordered"
              radius="lg"
            />

            <span className="hidden text-xs text-default-400 sm:block">
              {filtered.length} users
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left">
              <thead
                className="
                  border-b
                  border-divider
                  bg-default-100/60
                  text-[11px]
                  uppercase
                  tracking-wider
                  text-default-500
                "
              >
                <tr>
                  <th className="px-5 py-4 font-semibold">
                    Name
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Email
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Role
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Trial
                  </th>

                  <th className="px-5 py-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-divider">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="
                      text-sm
                      transition-colors
                      hover:bg-default-100/60
                    "
                  >
                    {/* User */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="
                            grid
                            h-9
                            w-9
                            shrink-0
                            place-items-center
                            overflow-hidden
                            rounded-full
                            bg-primary/10
                            font-semibold
                            text-primary
                            ring-1
                            ring-inset
                            ring-primary/10
                          "
                        >
                          {user.profile_image_url ? (
                            <img
                              src={user.profile_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (user.name || '?')
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>

                        <span className="font-semibold text-foreground">
                          {user.name || 'Unnamed user'}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4 text-default-500">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <Chip
                        size="sm"
                        radius="full"
                        color={
                          protectedUser(user)
                            ? 'primary'
                            : user.role === 'admin'
                              ? 'success'
                              : 'default'
                        }
                        variant="flat"
                      >
                        {protectedUser(user)
                          ? 'Super admin'
                          : user.role}
                      </Chip>
                    </td>

                    {/* Trial */}
                    <td className="px-5 py-4 text-default-500">
                      {user.trial_ends_at
                        ? formatDate(user.trial_ends_at)
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {protectedUser(user) ? (
                          <Chip
                            size="sm"
                            color="primary"
                            variant="flat"
                          >
                            Protected
                          </Chip>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="flat"
                              radius="lg"
                              onPress={() =>
                                changeRole(user)
                              }
                            >
                              {user.role === 'admin'
                                ? 'Make user'
                                : 'Make admin'}
                            </Button>

                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              radius="lg"
                              onPress={() => setDeleteTarget(user)}
                              aria-label="Delete user"
                            >
                              <Trash2 size={15} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!users.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center"
                    >
                      <div className="text-sm font-medium text-default-500">
                        No users found
                      </div>

                      <div className="mt-1 text-xs text-default-400">
                        Try another search term.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className="
              flex
              items-center
              justify-center
              border-t
              border-divider
              px-4
              py-4
            "
          >
            <Pagination
              showControls
              color="primary"
              page={page}
              total={pages}
              onChange={setPage}
            />
          </div>
        </CardBody>
      </Card>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete user?"
        message={`Delete ${deleteTarget?.email || 'this user'}? This action cannot be undone.`}
      />
    </div>
  )
}
