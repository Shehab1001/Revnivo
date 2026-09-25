import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react'
import {
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import Modal from '../components/Modal'
import PlatformAvatar from '../components/PlatformAvatar'
import api from '../services/api'
import { formatMoney, localDateInputValue } from '../utils/format'
import {
  currencyCountry,
  getCurrencyOptions,
} from '../utils/currencies'
import 'flag-icons/css/flag-icons.min.css'

const today = () => localDateInputValue()

const emptyForm = {
  platform_id: '',
  amount: '',
  platform_fee: '0',
  payment_fee: '0',
  currency: 'USD',
  status: 'paid',
  earned_at: today(),
  expected_at: '',
  category: '',
  note: '',
}

const currencyOptions = getCurrencyOptions()

const modalDropdownClassNames = {
  trigger:
    'h-14 min-h-14 rounded-xl border border-default-300/70 bg-default-100 px-4 shadow-none transition-colors data-[hover=true]:bg-default-200 dark:border-white/12 dark:bg-[#24262b] dark:data-[hover=true]:bg-[#2c2f35]',
  label:
    'text-xs font-medium text-default-500 dark:text-zinc-400',
  value:
    'text-sm font-semibold text-foreground dark:text-white',
  selectorIcon:
    'right-4 text-default-500 dark:text-zinc-300',
  popoverContent:
    'rounded-2xl border border-default-200 bg-content1 p-1 shadow-xl dark:border-white/10 dark:bg-[#202226]',
}

const modalAutocompleteInputClassNames = {
  inputWrapper:
    'h-14 min-h-14 rounded-xl border border-default-300/70 bg-default-100 px-4 shadow-none transition-colors data-[hover=true]:bg-default-200 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:bg-default-100 dark:border-white/12 dark:bg-[#24262b] dark:data-[hover=true]:bg-[#2c2f35] dark:group-data-[focus=true]:bg-[#24262b]',
  label:
    'text-xs font-medium text-default-500 dark:text-zinc-400',
  input:
    'text-sm font-semibold text-foreground placeholder:text-default-500 dark:text-white',
  innerWrapper: 'gap-2',
}

const statusChip = {
  paid: { color: 'success', label: 'Paid' },
  pending: { color: 'primary', label: 'Pending' },
  overdue: { color: 'danger', label: 'Overdue' },
}

export default function Earnings() {
  const [items, setItems] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedEarning, setSelectedEarning] = useState(null)
  const fileInputRef = useRef(null)

  const load = async (nextPage = page) => {
    setLoading(true)

    try {
      const params = {
        page: nextPage,
        search,
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      const [earningsResponse, platformsResponse] =
        await Promise.all([
          api.get('/earnings/', { params }),
          api.get('/platforms/'),
        ])

      setItems(earningsResponse.data.results)
      setPagination(earningsResponse.data.pagination)
      setPlatforms(platformsResponse.data)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not load earnings.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page)
  }, [page, search, statusFilter])

  const platformMap = useMemo(
    () =>
      Object.fromEntries(
        platforms.map((platform) => [
          platform.id,
          platform,
        ])
      ),
    [platforms]
  )

  const openNew = () => {
    const platform = platforms[0]

    setEditing(null)
    setForm({
      ...emptyForm,
      platform_id: platform?.id || '',
      currency:
        platform?.default_currency || 'USD',
    })
    setError('')
    setMessage('')
    setModal(true)
  }

  const openEdit = (earning) => {
    setEditing(earning)
    setForm({
      platform_id: earning.platform_id,
      amount: String(earning.gross_amount ?? earning.amount ?? ''),
      platform_fee: String(earning.platform_fee || 0),
      payment_fee: String(earning.payment_fee || 0),
      currency: earning.currency,
      status:
        earning.status === 'overdue'
          ? 'pending'
          : earning.status || 'paid',
      earned_at: earning.earned_at,
      expected_at: earning.expected_at || '',
      category: earning.category || '',
      note: earning.note || '',
    })
    setError('')
    setMessage('')
    setModal(true)
  }

  const changePlatform = (id) => {
    const platform = platformMap[id]

    setForm({
      ...form,
      platform_id: id,
      currency:
        platform?.default_currency ||
        form.currency,
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        ...form,
        expected_at:
          form.status === 'pending'
            ? form.expected_at
            : null,
      }

      if (editing) {
        await api.patch(
          `/earnings/${editing.id}/`,
          payload
        )
      } else {
        await api.post('/earnings/', payload)
      }

      setModal(false)
      setMessage(
        editing
          ? 'Income entry updated.'
          : form.status === 'pending'
            ? 'Pending payment added.'
            : 'Earning added.'
      )
      await load(page)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          Object.values(
            err.response?.data || {}
          )
            .flat()
            .join(' ') ||
          'Could not save earning.'
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (earning) => {
    if (
      !window.confirm(
        'Delete this income entry?'
      )
    ) {
      return
    }

    await api.delete(
      `/earnings/${earning.id}/`
    )
    await load(page)
  }

  const exportCsv = async () => {
    setError('')

    try {
      const response = await api.get(
        '/earnings/export/',
        {
          responseType: 'blob',
        }
      )

      const url = URL.createObjectURL(
        response.data
      )
      const link =
        document.createElement('a')

      link.href = url
      link.download = 'revnivo-earnings.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not export earnings.')
    }
  }

  const importCsv = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setImporting(true)
    setError('')
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await api.post(
        '/earnings/import/',
        formData,
        {
          headers: {
            'Content-Type':
              'multipart/form-data',
          },
        }
      )

      setMessage(
        `Imported ${data.inserted} entr${data.inserted === 1 ? 'y' : 'ies'}${data.skipped ? `; ${data.skipped} skipped` : ''}.`
      )

      await load(1)
      setPage(1)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not import CSV.'
      )
    } finally {
      setImporting(false)
    }
  }

  if (loading && !items.length) {
    return (
      <Loading label="Loading earnings..." />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1688ff]">
            Transactions
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Earnings
          </h1>

          <p className="mt-1 text-sm text-default-500">
            Track paid and expected income,
            fees, and what you actually keep.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={importCsv}
          />

          <Button
            variant="flat"
            radius="lg"
            isLoading={importing}
            startContent={
              !importing ? (
                <Upload size={16} />
              ) : null
            }
            onPress={() =>
              fileInputRef.current?.click()
            }
          >
            Import CSV
          </Button>

          <Button
            variant="flat"
            radius="lg"
            startContent={<Download size={16} />}
            onPress={exportCsv}
          >
            Export CSV
          </Button>

          <Button
            color="primary"
            radius="lg"
            onPress={openNew}
            isDisabled={!platforms.length}
            startContent={<Plus size={18} />}
          >
            Add income
          </Button>
        </div>
      </div>

      {!platforms.length && (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
          Add at least one platform before
          recording income.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-success/25 bg-success/10 p-3 text-sm text-success">
          {message}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-divider bg-content1 p-4 sm:flex-row sm:items-center">
          <Input
            className="max-w-sm"
            startContent={<Search size={17} />}
            value={search}
            onValueChange={(value) => {
              setPage(1)
              setSearch(value)
            }}
            placeholder="Search earnings..."
          />

          <Select
            aria-label="Status"
            className="w-full sm:w-40"
            selectedKeys={new Set([statusFilter])}
            onSelectionChange={(keys) => {
              setPage(1)
              setStatusFilter(
                Array.from(keys)[0] || 'all'
              )
            }}
            radius="lg"
            variant="flat"
          >
            <SelectItem key="all">
              All statuses
            </SelectItem>
            <SelectItem key="paid">Paid</SelectItem>
            <SelectItem key="pending">
              Pending
            </SelectItem>
          </Select>
        </div>

        {items.length ? (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-[1180px] text-left text-[12px]">
              <thead className="bg-content2/60 text-[10px] font-bold uppercase tracking-wide text-default-500">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Platform
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Gross
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Fees
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Net
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Date
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Category
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-divider">
                {items.map((earning) => {
                  const chip =
                    statusChip[
                      earning.status || 'paid'
                    ] || statusChip.paid

                  const feeTotal =
                    Number(
                      earning.platform_fee || 0
                    ) +
                    Number(
                      earning.payment_fee || 0
                    )

                  return (
                    <tr
                      key={earning.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEarning(earning)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedEarning(earning)
                        }
                      }}
                      className="cursor-pointer text-[12px] transition-colors hover:bg-primary/[0.045] focus:bg-primary/[0.06] focus:outline-none dark:hover:bg-white/[0.035]"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <PlatformAvatar
                            platform={
                              platformMap[
                                earning.platform_id
                              ] || {
                                name:
                                  earning.platform_name,
                              }
                            }
                          />
                          <span className="font-semibold">
                            {earning.platform_name}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-foreground">
                        {formatMoney(
                          earning.gross_amount ??
                            earning.amount,
                          earning.currency
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-default-500">
                        {feeTotal
                          ? `-${formatMoney(
                              feeTotal,
                              earning.currency
                            )}`
                          : '—'}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 font-bold text-success">
                        {formatMoney(
                          earning.net_amount ??
                            earning.amount,
                          earning.currency
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Chip
                          size="sm"
                          variant="bordered"
                          color={chip.color}
                          className="capitalize"
                        >
                          {chip.label}
                        </Chip>
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-default-600">
                        <div>
                          {earning.earned_at}
                        </div>
                        {earning.status !==
                          'paid' &&
                          earning.expected_at && (
                            <div className="mt-0.5 text-[10px] text-default-400">
                              Expected{' '}
                              {
                                earning.expected_at
                              }
                            </div>
                          )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5 text-default-600">
                        {earning.category || '—'}
                      </td>

                      <td className="max-w-[260px] truncate px-3 py-2.5 text-default-500">
                        {earning.description ||
                          earning.note ||
                          '—'}
                      </td>

                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() =>
                              openEdit(earning)
                            }
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Edit income"
                          >
                            <Pencil size={16} />
                          </Button>

                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() =>
                              remove(earning)
                            }
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Delete income"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No income found"
              text={
                search ||
                statusFilter !== 'all'
                  ? 'Try different filters.'
                  : 'Record your first payment to start tracking income.'
              }
            />
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex justify-center border-t border-divider p-3">
            <Pagination
              showControls
              page={page}
              total={pagination.pages}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selectedEarning)}
        onClose={() => setSelectedEarning(null)}
        title="Income details"
      >
        {selectedEarning && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-default-200/70 bg-default-50/60 p-4 dark:border-white/8 dark:bg-white/[0.02]">
              <PlatformAvatar
                platform={
                  platformMap[selectedEarning.platform_id] || {
                    name: selectedEarning.platform_name,
                  }
                }
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedEarning.platform_name}
                </p>
                <p className="mt-0.5 text-xs text-default-400">
                  {selectedEarning.category || 'Uncategorized'}
                </p>
              </div>
              <div className="ml-auto">
                <Chip
                  size="sm"
                  variant="bordered"
                  color={(statusChip[selectedEarning.status || 'paid'] || statusChip.paid).color}
                >
                  {(statusChip[selectedEarning.status || 'paid'] || statusChip.paid).label}
                </Chip>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Gross amount', formatMoney(selectedEarning.gross_amount ?? selectedEarning.amount, selectedEarning.currency)],
                ['Platform fee', formatMoney(selectedEarning.platform_fee || 0, selectedEarning.currency)],
                ['Payment fee', formatMoney(selectedEarning.payment_fee || 0, selectedEarning.currency)],
                ['Net amount', formatMoney(selectedEarning.net_amount ?? selectedEarning.amount, selectedEarning.currency)],
                ['Currency', selectedEarning.currency || '—'],
                ['Date earned', selectedEarning.earned_at || '—'],
                ['Expected date', selectedEarning.expected_at || '—'],
                ['Category', selectedEarning.category || '—'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-default-200/70 bg-content1 p-3 dark:border-white/8"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-default-400">
                    {label}
                  </p>
                  <p className="mt-1.5 break-words text-sm font-medium text-foreground">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-default-200/70 bg-content1 p-4 dark:border-white/8">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-default-400">
                Description
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-default-600">
                {selectedEarning.description || selectedEarning.note || 'No description.'}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="light"
                onPress={() => setSelectedEarning(null)}
              >
                Close
              </Button>
              <Button
                color="primary"
                startContent={<Pencil size={15} />}
                onPress={() => {
                  const current = selectedEarning
                  setSelectedEarning(null)
                  openEdit(current)
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={
          editing
            ? 'Edit income'
            : 'Add income'
        }
      >
        {error && (
          <div className="mb-4 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          className="space-y-5"
        >
          <Select
            label="Platform"
            isRequired
            size="md"
            variant="flat"
            radius="lg"
            classNames={modalDropdownClassNames}
            selectedKeys={
              new Set([form.platform_id])
            }
            onSelectionChange={(keys) =>
              changePlatform(
                Array.from(keys)[0] || ''
              )
            }
          >
            <SelectItem key="">
              Select platform
            </SelectItem>
            {platforms.map((platform) => (
              <SelectItem key={platform.id}>
                {platform.name}
              </SelectItem>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Gross amount"
              isRequired
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  amount: value,
                })
              }
            />

            <Autocomplete
              label="Currency"
              size="md"
              variant="flat"
              radius="lg"
              selectedKey={form.currency}
              onSelectionChange={(key) =>
                key &&
                setForm({
                  ...form,
                  currency: String(key),
                })
              }
              allowsCustomValue={false}
              placeholder="Currency"
              inputProps={{
                classNames:
                  modalAutocompleteInputClassNames,
              }}
              classNames={{
                selectorButton:
                  modalDropdownClassNames.selectorIcon,
                popoverContent:
                  modalDropdownClassNames.popoverContent,
              }}
            >
              {currencyOptions.map((item) => (
                <AutocompleteItem
                  key={item.code}
                  textValue={`${item.code} ${item.name}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`fi fi-${currencyCountry(
                        item.code
                      )} dashboard-currency-flag`}
                    />
                    {item.code}
                  </span>
                </AutocompleteItem>
              ))}
            </Autocomplete>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Platform fee"
              type="number"
              min="0"
              step="0.01"
              value={form.platform_fee}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  platform_fee: value,
                })
              }
            />

            <Input
              label="Payment fee"
              type="number"
              min="0"
              step="0.01"
              value={form.payment_fee}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  payment_fee: value,
                })
              }
            />
          </div>

          <Select
            label="Payment status"
            selectedKeys={
              new Set([form.status])
            }
            onSelectionChange={(keys) => {
              const value =
                Array.from(keys)[0] || 'paid'
              setForm({
                ...form,
                status: value,
                expected_at:
                  value === 'pending'
                    ? form.expected_at
                    : '',
              })
            }}
            classNames={modalDropdownClassNames}
          >
            <SelectItem key="paid">
              Paid
            </SelectItem>
            <SelectItem key="pending">
              Pending
            </SelectItem>
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={
                form.status === 'pending'
                  ? 'Work / invoice date'
                  : 'Date earned'
              }
              isRequired
              type="date"
              value={form.earned_at}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  earned_at: value,
                })
              }
            />

            {form.status === 'pending' && (
              <Input
                label="Expected payment date"
                isRequired
                type="date"
                value={form.expected_at}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    expected_at: value,
                  })
                }
              />
            )}
          </div>

          <Input
            label="Category"
            isRequired
            value={form.category}
            onValueChange={(value) =>
              setForm({
                ...form,
                category: value,
              })
            }
            placeholder="Project, Bonus, Referral..."
          />

          <Textarea
            label="Description"
            value={form.note}
            onValueChange={(value) =>
              setForm({
                ...form,
                note: value,
              })
            }
            placeholder="Optional details"
          />

          <div className="rounded-xl border border-default-200 bg-default-50/60 p-3 text-xs text-default-500 dark:border-white/8 dark:bg-white/[0.02]">
            Estimated net:{' '}
            <span className="font-semibold text-foreground">
              {formatMoney(
                Math.max(
                  Number(form.amount || 0) -
                    Number(
                      form.platform_fee || 0
                    ) -
                    Number(
                      form.payment_fee || 0
                    ),
                  0
                ),
                form.currency
              )}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="light"
              onPress={() => setModal(false)}
            >
              Cancel
            </Button>

            <Button
              color="primary"
              type="submit"
              isLoading={saving}
            >
              {saving
                ? 'Saving...'
                : editing
                  ? 'Save changes'
                  : form.status === 'pending'
                    ? 'Add pending payment'
                    : 'Save earning'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
