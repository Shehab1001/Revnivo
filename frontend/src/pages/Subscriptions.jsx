import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
} from '@heroui/react'

import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import Loading from '../components/Loading'
import api from '../services/api'
import { formatDate } from '../utils/format'
import { useSortableData } from '../utils/useSortableData.js'

export default function Subscriptions() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 8

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const subscriptionsResponse = await api.get('/admin/subscriptions/')

      setUsers(
        subscriptionsResponse.data.users ||
          subscriptionsResponse.data
      )
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not load subscriptions.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredUsers = users
    .filter((user) =>
      `${user.name || ''} ${user.email || ''} ${
        user.subscription_status || ''
      }`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) =>
      (a.name || a.email || '').localeCompare(
        b.name || b.email || '',
        undefined,
        { sensitivity: 'base' }
      )
    )

  const pageCount = Math.max(
    1,
    Math.ceil(filteredUsers.length / pageSize)
  )

  const visibleUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  const { sortedItems: sortedVisibleUsers } =
    useSortableData(visibleUsers, 'name')

  const activate = async (user) => {
    try {
      await api.patch('/admin/subscriptions/', {
        user_id: user.id,
        subscription_status: 'active',
        payment_method:
          user.payment_method || 'manual',
      })

      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not update subscription.'
      )
    }
  }

  if (loading) {
    return (
      <Loading label="Loading subscriptions..." />
    )
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Subscriptions
        </h1>

        <p className="mt-1 text-sm text-default-500">
          Manage users and subscription status.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Main table card */}
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
          {/* Card heading + search */}
          <div className="border-b border-divider p-5">
            <div className=" ">

              <span className="text-xs text-default-400">
                {filteredUsers.length}{' '}
                {filteredUsers.length === 1
                  ? 'user'
                  : 'users'}
              </span>
            </div>

            <Input
              aria-label="Search subscription users"
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
              className="mt-4 max-w-sm"
              variant="bordered"
              radius="lg"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left">
              <thead
                className="
                  border-b
                  border-divider
                  bg-default-100/60
                  text-[10px]
                  uppercase
                  tracking-wider
                  text-default-500
                "
              >
                <tr>
                  <th className="px-5 py-4 font-medium">
                    User
                  </th>

                  <th className="px-5 py-4 font-medium">
                    Status
                  </th>

                  <th className="px-5 py-4 font-medium">
                    Trial
                  </th>

                  <th className="px-5 py-4 font-medium">
                    Payment
                  </th>

                  <th className="px-5 py-4 text-right font-medium">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-divider">
                {sortedVisibleUsers.map((user) => (
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
                              src={
                                user.profile_image_url
                              }
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (user.name || '?')
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">
                            {user.name ||
                              'Unnamed user'}
                          </div>

                          <div className="truncate text-xs text-default-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <Chip
                        size="sm"
                        radius="full"
                        color={
                          user.subscription_status ===
                          'active'
                            ? 'success'
                            : 'default'
                        }
                        variant="flat"
                      >
                        {user.subscription_status ||
                          'trial'}
                      </Chip>
                    </td>

                    {/* Trial */}
                    <td className="px-5 py-4 text-xs text-default-500">
                      {user.trial_ends_at
                        ? formatDate(user.trial_ends_at)
                        : '—'}
                    </td>

                    {/* Payment */}
                    <td className="px-5 py-4 text-xs text-default-500">
                      {user.payment_method || '—'}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        radius="lg"
                        onPress={() =>
                          activate(user)
                        }
                      >
                        {user.subscription_status ===
                        'active'
                          ? 'Renew'
                          : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}

                {!sortedVisibleUsers.length && (
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
        </CardBody>
      </Card>

      {/* Pagination */}
      <div className="flex justify-center border-t border-divider pt-4">
        <Pagination
          showControls
          color="primary"
          page={page}
          total={pageCount}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
