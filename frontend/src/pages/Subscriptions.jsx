import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Switch,
} from '@heroui/react'
import {
  CreditCard,
  Pencil,
  Plus,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import ProfileAvatar from '../components/ProfileAvatar'
import api from '../services/api'
import { formatDate } from '../utils/format'
import { useSortableData } from '../utils/useSortableData.js'

const emptyPlan = {
  name: '',
  price: '',
  currency: 'USD',
  trial_days: '0',
  active: true,
}

const emptyMethod = {
  name: '',
  code: '',
  provider: 'custom',
  description: '',
  active: true,
}

const fieldClassNames = {
  inputWrapper:
    'h-12 rounded-xl border border-default-200 bg-default-100 dark:border-white/10 dark:bg-[#24262b]',
}

export default function Subscriptions() {
  const [users, setUsers] = useState([])
  const [plans, setPlans] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [planModal, setPlanModal] = useState(false)
  const [planForm, setPlanForm] = useState(emptyPlan)
  const [editingPlan, setEditingPlan] = useState(null)
  const [savingPlan, setSavingPlan] = useState(false)

  const [methodModal, setMethodModal] = useState(false)
  const [methodForm, setMethodForm] = useState(emptyMethod)
  const [editingMethod, setEditingMethod] = useState(null)
  const [savingMethod, setSavingMethod] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const pageSize = 8

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const [subscriptionsResponse, plansResponse, methodsResponse] =
        await Promise.all([
          api.get('/admin/subscriptions/'),
          api.get('/admin/plans/'),
          api.get('/admin/payment-methods/'),
        ])

      setUsers(
        subscriptionsResponse.data.users ||
          subscriptionsResponse.data
      )
      setPlans(plansResponse.data.plans || [])
      setPaymentMethods(
        methodsResponse.data.payment_methods || []
      )
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not load subscription settings.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredUsers = useMemo(
    () =>
      users
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
        ),
    [users, search]
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

  const openNewPlan = () => {
    setEditingPlan(null)
    setPlanForm(emptyPlan)
    setPlanModal(true)
  }

  const openEditPlan = (plan) => {
    setEditingPlan(plan)
    setPlanForm({
      name: plan.name || '',
      price: String(plan.price ?? ''),
      currency: plan.currency || 'USD',
      trial_days: String(plan.trial_days ?? 0),
      active: plan.active !== false,
    })
    setPlanModal(true)
  }

  const savePlan = async (event) => {
    event.preventDefault()
    setSavingPlan(true)
    setError('')

    try {
      const payload = {
        ...(editingPlan ? { id: editingPlan.id } : {}),
        name: planForm.name,
        price: Number(planForm.price),
        currency: planForm.currency.toUpperCase(),
        trial_days: Number(planForm.trial_days || 0),
        active: planForm.active,
      }

      if (editingPlan) {
        await api.patch('/admin/plans/', payload)
      } else {
        await api.post('/admin/plans/', payload)
      }

      setPlanModal(false)
      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not save plan.'
      )
    } finally {
      setSavingPlan(false)
    }
  }

  const togglePlan = async (plan) => {
    try {
      await api.patch('/admin/plans/', {
        id: plan.id,
        active: !plan.active,
      })
      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not update plan.'
      )
    }
  }

  const openNewMethod = () => {
    setEditingMethod(null)
    setMethodForm(emptyMethod)
    setMethodModal(true)
  }

  const openEditMethod = (method) => {
    setEditingMethod(method)
    setMethodForm({
      name: method.name || '',
      code: method.code || '',
      provider: method.provider || 'custom',
      description: method.description || '',
      active: method.active !== false,
    })
    setMethodModal(true)
  }

  const saveMethod = async (event) => {
    event.preventDefault()
    setSavingMethod(true)
    setError('')

    try {
      const payload = {
        ...(editingMethod ? { id: editingMethod.id } : {}),
        name: methodForm.name,
        code: methodForm.code,
        provider: methodForm.provider,
        description: methodForm.description,
        active: methodForm.active,
      }

      if (editingMethod) {
        await api.patch(
          '/admin/payment-methods/',
          payload
        )
      } else {
        await api.post(
          '/admin/payment-methods/',
          payload
        )
      }

      setMethodModal(false)
      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not save payment method.'
      )
    } finally {
      setSavingMethod(false)
    }
  }

  const toggleMethod = async (method) => {
    try {
      await api.patch('/admin/payment-methods/', {
        id: method.id,
        active: !method.active,
      })
      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not update payment method.'
      )
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      await api.delete(
        '/admin/payment-methods/',
        {
          data: { id: deleteTarget.item.id },
        }
      )

      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not delete this item.'
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <Loading label="Loading subscriptions..." />
    )
  }

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Administration
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Subscriptions
        </h1>

        <p className="mt-1 text-sm text-default-500">
          Manage plans, payment methods, and user subscription status.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          radius="lg"
          className="border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
        >
          <CardBody className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-divider p-5">
              <div>
                <div className="flex items-center gap-2">
                  <WalletCards
                    size={18}
                    className="text-primary"
                  />
                  <h2 className="font-semibold">
                    Subscription plans
                  </h2>
                </div>
                <p className="mt-1 text-xs text-default-500">
                  Active plans are shown immediately on the user Payments page.
                </p>
              </div>

              {plans.length ? (
                <Button
                  color="primary"
                  size="sm"
                  startContent={<Pencil size={16} />}
                  onPress={() => openEditPlan(plans[0])}
                >
                  Edit plan
                </Button>
              ) : (
                <Button
                  color="primary"
                  size="sm"
                  startContent={<Plus size={16} />}
                  onPress={openNewPlan}
                >
                  Add plan
                </Button>
              )}
            </div>

            <div className="divide-y divide-divider">
              {plans.slice(0, 1).map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {plan.name}
                      </span>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={
                          plan.active
                            ? 'success'
                            : 'default'
                        }
                      >
                        {plan.active
                          ? 'Active'
                          : 'Hidden'}
                      </Chip>
                    </div>

                    <div className="mt-1 text-xs text-default-500">
                      {plan.price} {plan.currency || 'USD'}
                      {' · '}
                      {plan.trial_days || 0} trial days
                    </div>
                  </div>

                  <Switch
                    size="sm"
                    isSelected={plan.active}
                    onValueChange={() =>
                      togglePlan(plan)
                    }
                    aria-label={`Toggle ${plan.name}`}
                  />


                </div>
              ))}

              {!plans.length && (
                <div className="p-8 text-center text-sm text-default-500">
                  No plans yet.
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card
          radius="lg"
          className="border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
        >
          <CardBody className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-divider p-5">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard
                    size={18}
                    className="text-primary"
                  />
                  <h2 className="font-semibold">
                    Payment methods
                  </h2>
                </div>
                <p className="mt-1 text-xs text-default-500">
                  Active methods are shown immediately to users.
                </p>
              </div>

              <Button
                color="primary"
                size="sm"
                startContent={<Plus size={16} />}
                onPress={openNewMethod}
              >
                Add method
              </Button>
            </div>

            <div className="divide-y divide-divider">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {method.name}
                      </span>

                      <Chip
                        size="sm"
                        variant="flat"
                        color={
                          method.active
                            ? 'success'
                            : 'default'
                        }
                      >
                        {method.active
                          ? 'Active'
                          : 'Hidden'}
                      </Chip>

                      <Chip
                        size="sm"
                        variant="flat"
                        color={
                          method.configured
                            ? 'primary'
                            : 'warning'
                        }
                      >
                        {method.configured
                          ? 'Configured'
                          : 'Setup required'}
                      </Chip>
                    </div>

                    <div className="mt-1 truncate text-xs text-default-500">
                      {method.description ||
                        method.provider ||
                        method.code}
                    </div>
                  </div>

                  <Switch
                    size="sm"
                    isSelected={method.active}
                    onValueChange={() =>
                      toggleMethod(method)
                    }
                    aria-label={`Toggle ${method.name}`}
                  />

                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() =>
                      openEditMethod(method)
                    }
                    aria-label="Edit payment method"
                  >
                    <Pencil size={15} />
                  </Button>

                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() =>
                      setDeleteTarget({
                        type: 'method',
                        item: method,
                      })
                    }
                    aria-label="Delete payment method"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card
        radius="lg"
        className="overflow-hidden border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
      >
        <CardBody className="p-0">
          <div className="border-b border-divider p-5">
            <div className="text-xs text-default-400">
              {filteredUsers.length}{' '}
              {filteredUsers.length === 1
                ? 'user'
                : 'users'}
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left">
              <thead className="border-b border-divider bg-default-100/60 text-[10px] uppercase tracking-wider text-default-500">
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
                    className="text-sm transition-colors hover:bg-default-100/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <ProfileAvatar
                          user={user}
                          className="h-9 w-9 ring-1 ring-inset ring-primary/10"
                          alt=""
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {user.name ||
                              'Unnamed user'}
                          </div>
                          <div className="truncate text-xs text-default-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

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

                    <td className="px-5 py-4 text-xs text-default-500">
                      {user.trial_ends_at
                        ? formatDate(
                            user.trial_ends_at
                          )
                        : '—'}
                    </td>

                    <td className="px-5 py-4 text-xs text-default-500">
                      {user.payment_method || '—'}
                    </td>

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
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-center border-t border-divider pt-4">
        <Pagination
          showControls
          color="primary"
          page={page}
          total={pageCount}
          onChange={setPage}
        />
      </div>

      <Modal
        open={planModal}
        onClose={() => setPlanModal(false)}
        title={
          editingPlan
            ? 'Edit plan'
            : 'Add plan'
        }
      >
        <form
          onSubmit={savePlan}
          className="space-y-4"
        >
          <Input
            label="Plan name"
            isRequired
            value={planForm.name}
            onValueChange={(value) =>
              setPlanForm({
                ...planForm,
                name: value,
              })
            }
            classNames={fieldClassNames}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Price"
              type="number"
              min="0.01"
              step="0.01"
              isRequired
              value={planForm.price}
              onValueChange={(value) =>
                setPlanForm({
                  ...planForm,
                  price: value,
                })
              }
              classNames={fieldClassNames}
            />

            <Input
              label="Currency"
              maxLength={3}
              isRequired
              value={planForm.currency}
              onValueChange={(value) =>
                setPlanForm({
                  ...planForm,
                  currency: value
                    .toUpperCase()
                    .slice(0, 3),
                })
              }
              classNames={fieldClassNames}
            />
          </div>

          <Input
            label="Trial days"
            type="number"
            min="0"
            value={planForm.trial_days}
            onValueChange={(value) =>
              setPlanForm({
                ...planForm,
                trial_days: value,
              })
            }
            classNames={fieldClassNames}
          />

          <Switch
            isSelected={planForm.active}
            onValueChange={(active) =>
              setPlanForm({
                ...planForm,
                active,
              })
            }
          >
            Visible to users
          </Switch>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="light"
              onPress={() =>
                setPlanModal(false)
              }
            >
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={savingPlan}
            >
              Save plan
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={methodModal}
        onClose={() => setMethodModal(false)}
        title={
          editingMethod
            ? 'Edit payment method'
            : 'Add payment method'
        }
      >
        <form
          onSubmit={saveMethod}
          className="space-y-4"
        >
          <Input
            label="Display name"
            isRequired
            value={methodForm.name}
            onValueChange={(value) =>
              setMethodForm({
                ...methodForm,
                name: value,
              })
            }
            placeholder="Paymob"
            classNames={fieldClassNames}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Code"
              value={methodForm.code}
              onValueChange={(value) =>
                setMethodForm({
                  ...methodForm,
                  code: value,
                })
              }
              placeholder="paymob"
              description="Leave blank when adding to generate it from the name."
              classNames={fieldClassNames}
            />

            <Select
              label="Provider"
              selectedKeys={
                new Set([
                  methodForm.provider,
                ])
              }
              onSelectionChange={(keys) =>
                setMethodForm({
                  ...methodForm,
                  provider:
                    Array.from(keys)[0] ||
                    'custom',
                })
              }
              variant="flat"
              radius="lg"
              classNames={{
                trigger:
                  'h-12 rounded-xl border border-default-200 bg-default-100 dark:border-white/10 dark:bg-[#24262b]',
              }}
            >
              <SelectItem key="paymob">
                Paymob
              </SelectItem>
              <SelectItem key="fawry">
                Fawry
              </SelectItem>
              <SelectItem key="paypal">
                PayPal
              </SelectItem>
              <SelectItem key="kashier">
                Kashier
              </SelectItem>
              <SelectItem key="custom">
                Custom
              </SelectItem>
            </Select>
          </div>

          <Input
            label="Description"
            value={methodForm.description}
            onValueChange={(value) =>
              setMethodForm({
                ...methodForm,
                description: value,
              })
            }
            classNames={fieldClassNames}
          />

          <Switch
            isSelected={methodForm.active}
            onValueChange={(active) =>
              setMethodForm({
                ...methodForm,
                active,
              })
            }
          >
            Visible to users
          </Switch>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="light"
              onPress={() =>
                setMethodModal(false)
              }
            >
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={savingMethod}
            >
              Save method
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() =>
          setDeleteTarget(null)
        }
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete payment method?"
        message={`Delete ${deleteTarget?.item?.name || 'this payment method'}? It will disappear from the user Payments page.`}
      />
    </div>
  )
}
