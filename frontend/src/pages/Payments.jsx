import {
  Button,
  Card,
  CardBody,
  Chip,
  Radio,
  RadioGroup,
} from '@heroui/react'
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import api from '../services/api'
import { formatDate } from '../utils/format'

const gatewayIcons = {
  paymob: CreditCard,
  fawry: Smartphone,
  paypal: WalletCards,
  kashier: Landmark,
}

function formatPrice(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`
  }
}

export default function Payments() {
  const [data, setData] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedGateway, setSelectedGateway] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api
      .get('/payments/')
      .then(({ data: response }) => {
        setData(response)
        setSelectedPlan(response.plans?.[0]?.id || '')
        setSelectedGateway(
          response.gateways?.find((gateway) => gateway.configured)?.id ||
            response.gateways?.[0]?.id ||
            ''
        )
      })
      .catch((error) => {
        setMessage(
          error.response?.data?.detail ||
            'Could not load payment information.'
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const plan = useMemo(
    () =>
      data?.plans?.find(
        (item) => String(item.id) === String(selectedPlan)
      ) ||
      data?.plans?.[0],
    [data?.plans, selectedPlan]
  )

  const gateway = useMemo(
    () =>
      data?.gateways?.find(
        (item) => item.id === selectedGateway
      ),
    [data?.gateways, selectedGateway]
  )

  if (loading) {
    return <Loading label="Loading payment center..." />
  }

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Billing
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Payments
        </h1>

        <p className="mt-1 text-sm text-default-500">
          Manage your subscription and choose how you want to pay.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning-700 dark:text-warning-300">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Card
          radius="lg"
          className="border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
        >
          <CardBody className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-default-400">
                  Subscription
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {data?.subscription?.status === 'active'
                    ? 'Active subscription'
                    : data?.subscription?.status === 'trial'
                      ? 'Trial period'
                      : 'Subscription required'}
                </h2>
              </div>

              <Chip
                size="sm"
                color={
                  data?.subscription?.status === 'active'
                    ? 'success'
                    : data?.subscription?.status === 'trial'
                      ? 'primary'
                      : 'default'
                }
                variant="flat"
              >
                {data?.subscription?.status || 'inactive'}
              </Chip>
            </div>

            <div className="mt-5 rounded-2xl bg-default-100/70 p-4 dark:bg-white/[0.04]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck size={20} />
                </span>

                <div>
                  <div className="text-sm font-semibold">
                    Secure checkout
                  </div>
                  <div className="mt-0.5 text-xs text-default-500">
                    Choose a payment gateway before checkout.
                  </div>
                </div>
              </div>
            </div>

            {data?.subscription?.payment_method && (
              <div className="mt-4 text-sm text-default-500">
                Current payment method:{' '}
                <span className="font-semibold text-foreground">
                  {data.subscription.payment_method}
                </span>
              </div>
            )}
          </CardBody>
        </Card>

        <Card
          radius="lg"
          className="border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
        >
          <CardBody className="p-5">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-default-400">
                Plan
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Choose your plan
              </h2>
            </div>

            <RadioGroup
              value={selectedPlan}
              onValueChange={setSelectedPlan}
              classNames={{ wrapper: 'grid gap-3 sm:grid-cols-2' }}
            >
              {(data?.plans || []).map((item) => (
                <Radio
                  key={item.id}
                  value={String(item.id)}
                  classNames={{
                    base:
                      'm-0 max-w-none rounded-2xl border border-default-200 bg-default-50 p-4 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5 dark:border-white/10 dark:bg-white/[0.03]',
                    labelWrapper: 'w-full',
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="mt-1 text-xs text-default-500">
                        {item.trial_days
                          ? `${item.trial_days} trial days`
                          : 'Subscription plan'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {formatPrice(item.price, item.currency)}
                      </div>
                    </div>
                  </div>
                </Radio>
              ))}
            </RadioGroup>
          </CardBody>
        </Card>
      </div>

      <Card
        radius="lg"
        className="border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
      >
        <CardBody className="p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-default-400">
                Payment gateway
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Select payment method
              </h2>
            </div>

            {plan && (
              <div className="text-sm text-default-500">
                Amount:{' '}
                <span className="font-bold text-foreground">
                  {formatPrice(plan.price, plan.currency)}
                </span>
              </div>
            )}
          </div>

          <RadioGroup
            value={selectedGateway}
            onValueChange={setSelectedGateway}
            classNames={{
              wrapper:
                'grid gap-3 sm:grid-cols-2 xl:grid-cols-4',
            }}
          >
            {(data?.gateways || []).map((item) => {
              const Icon = gatewayIcons[item.id] || CreditCard

              return (
                <Radio
                  key={item.id}
                  value={item.id}
                  classNames={{
                    base:
                      'm-0 max-w-none rounded-2xl border border-default-200 bg-default-50 p-4 data-[selected=true]:border-primary data-[selected=true]:bg-primary/5 dark:border-white/10 dark:bg-white/[0.03]',
                    labelWrapper: 'w-full',
                  }}
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon size={20} />
                      </span>

                      <Chip
                        size="sm"
                        color={item.configured ? 'success' : 'default'}
                        variant="flat"
                      >
                        {item.configured ? 'Available' : 'Setup required'}
                      </Chip>
                    </div>

                    <div className="mt-4 font-semibold">
                      {item.name}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-default-500">
                      {item.description}
                    </div>
                  </div>
                </Radio>
              )
            })}
          </RadioGroup>

          <div className="mt-5 flex flex-col gap-3 border-t border-divider pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-default-500">
              {gateway?.configured
                ? 'You will be redirected to the secure payment gateway.'
                : 'This gateway needs merchant API credentials before live payments can be accepted.'}
            </div>

            <Button
              color="primary"
              size="lg"
              isDisabled={!gateway?.configured || !plan}
              startContent={<CreditCard size={18} />}
              onPress={() =>
                setMessage(
                  'The payment gateway UI is ready. Add the provider API credentials and webhook to enable live checkout.'
                )
              }
            >
              Pay {plan ? formatPrice(plan.price, plan.currency) : ''}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card
        radius="lg"
        className="border border-default-200/60 bg-content1 shadow-sm dark:border-white/5 dark:shadow-none"
      >
        <CardBody className="p-0">
          <div className="flex items-center gap-3 border-b border-divider p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <ReceiptText size={18} />
            </span>
            <div>
              <h2 className="font-semibold">Payment history</h2>
              <p className="text-xs text-default-500">
                Your subscription payments will appear here.
              </p>
            </div>
          </div>

          {data?.payments?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-default-100/60 text-xs uppercase tracking-wide text-default-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Gateway</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {data.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-5 py-4 text-default-500">
                        {payment.created_at
                          ? formatDate(payment.created_at, 'en-GB')
                          : '—'}
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {payment.gateway}
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {formatPrice(payment.amount, payment.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <Chip
                          size="sm"
                          color={
                            payment.status === 'paid'
                              ? 'success'
                              : payment.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                          variant="flat"
                        >
                          {payment.status}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No payments yet"
                text="Your completed and pending subscription payments will appear here."
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
