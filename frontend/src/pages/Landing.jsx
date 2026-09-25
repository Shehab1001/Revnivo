import { Button } from '@heroui/react'
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleDollarSign,
  FileText,
  Globe2,
  Layers3,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const features = [
  {
    icon: Layers3,
    title: 'All your platforms',
    text: 'Add every platform you work with, upload its logo, set its currency, and keep its status organized.',
  },
  {
    icon: CircleDollarSign,
    title: 'Track every earning',
    text: 'Record payments with dates, categories, notes, and currencies so your income history stays complete.',
  },
  {
    icon: BarChart3,
    title: 'See the bigger picture',
    text: 'Use clear charts and filters to understand revenue, monthly performance, platform mix, and trends over time.',
  },
  {
    icon: Globe2,
    title: 'Multi-currency workspace',
    text: 'Work across different currencies while keeping one consistent dashboard for your income.',
  },
  {
    icon: FileText,
    title: 'Notes that stay close',
    text: 'Keep useful work notes inside the same workspace instead of spreading context across separate tools.',
  },
  {
    icon: MessageCircle,
    title: 'Built-in support chat',
    text: 'Send text, images, voice messages, videos, and files without leaving your Revnivo workspace.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Add your platforms',
    text: 'Create the sources you earn from and organize them with status, currency, logo, and website details.',
  },
  {
    number: '02',
    title: 'Record your earnings',
    text: 'Add each payment as it arrives. Revnivo keeps the amount, platform, category, date, and description together.',
  },
  {
    number: '03',
    title: 'Understand your income',
    text: 'Filter your dashboard by platform, time, and currency to see where your money is coming from.',
  },
]

function MetricCard({ label, value, note, accent = 'primary' }) {
  const accentClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    secondary: 'bg-secondary/10 text-secondary',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  }[accent]

  return (
    <div className="rounded-2xl border border-default-200/70 bg-content1/85 p-4 shadow-sm backdrop-blur dark:border-white/8 dark:bg-content1/75">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-default-500">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-[10px] text-default-400">{note}</p>
        </div>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${accentClass}`}>
          <TrendingUp size={15} />
        </span>
      </div>
    </div>
  )
}

export default function Landing() {
  const { isAuthenticated } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 [background-image:linear-gradient(to_right,rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.055)_1px,transparent_1px)] [background-size:24px_24px] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 [background-image:linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:120px_120px] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)]"
      />
      <div aria-hidden="true" className="pointer-events-none fixed -left-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none fixed -bottom-56 -right-48 h-[36rem] w-[36rem] rounded-full bg-secondary/10 blur-3xl" />

      <header className="sticky top-0 z-40 border-b border-default-200/70 bg-background/80 backdrop-blur-xl dark:border-white/8">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center">
            <img src="/logo.svg" alt="Revnivo" className="brand-logo h-8 w-auto sm:h-9" />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-default-500 md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#workspace" className="transition-colors hover:text-foreground">Workspace</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-xl border border-default-200 bg-content1/70 text-default-600 transition hover:bg-default-100 hover:text-foreground dark:border-white/8"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {isAuthenticated ? (
              <Button
                as={Link}
                to="/dashboard"
                color="primary"
                radius="lg"
                endContent={<ArrowRight size={15} />}
                className="font-semibold"
              >
                Open dashboard
              </Button>
            ) : (
              <>
                <Button
                  as={Link}
                  to="/login"
                  variant="light"
                  radius="lg"
                  className="hidden font-semibold sm:flex"
                >
                  Sign in
                </Button>
                <Button
                  as={Link}
                  to="/register"
                  color="primary"
                  radius="lg"
                  endContent={<ArrowRight size={15} />}
                  className="font-semibold"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-28 lg:pt-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles size={13} />
              One workspace for your income
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-[64px]">
              Every platform.
              <br />
              Every payment.
              <br />
              <span className="text-primary">One clear view.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-default-500 sm:text-lg">
              Revnivo gives multi-platform professionals one place to record earnings,
              organize income sources, understand trends, and keep work details under control.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                as={Link}
                to={isAuthenticated ? '/dashboard' : '/register'}
                color="primary"
                radius="lg"
                size="lg"
                endContent={<ArrowRight size={17} />}
                className="h-12 px-6 font-semibold shadow-[0_12px_30px_rgba(0,111,238,0.22)]"
              >
                {isAuthenticated ? 'Open your dashboard' : 'Start organizing your income'}
              </Button>

              {!isAuthenticated && (
                <Button
                  as={Link}
                  to="/login"
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  className="h-12 border-default-300 bg-content1/50 px-6 font-semibold backdrop-blur"
                >
                  Sign in
                </Button>
              )}
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-default-500">
              {['Multi-platform tracking', 'Clear analytics', 'Light & dark mode'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-success/10 text-success">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div id="workspace" className="relative">
            <div aria-hidden="true" className="absolute -inset-8 rounded-[3rem] bg-primary/8 blur-3xl" />

            <div className="relative overflow-hidden rounded-[28px] border border-default-200/80 bg-content1/80 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111216]/85 dark:shadow-[0_30px_90px_rgba(0,0,0,0.36)] sm:p-4">
              <div className="flex items-center justify-between border-b border-divider px-2 pb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Overview</p>
                  <p className="mt-1 text-sm font-semibold">Income dashboard</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-default-500">
                  <span className="live-income-dot h-2 w-2 rounded-full bg-success" />
                  Live workspace
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MetricCard label="Revenue" value="$12,858" note="Across all time" />
                <MetricCard label="This month" value="$756" note="+134.2%" accent="success" />
                <MetricCard label="Transactions" value="43" note="Recorded" accent="secondary" />
                <MetricCard label="Platforms" value="9" note="Active sources" accent="cyan" />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.15fr_.85fr]">
                <div className="rounded-2xl border border-default-200/70 bg-content1/80 p-4 dark:border-white/8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold">Sales performance</p>
                      <p className="mt-1 text-[10px] text-default-400">Monthly income overview</p>
                    </div>
                    <BarChart3 size={16} className="text-primary" />
                  </div>

                  <div className="mt-6 flex h-40 items-end gap-2">
                    {[22, 43, 31, 64, 28, 80, 37, 55, 94, 48, 70, 100].map((height, index) => (
                      <div key={index} className="flex h-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-md bg-primary/90 transition-all"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] text-default-400">
                    <span>Oct</span><span>Jan</span><span>Apr</span><span>Jul</span><span>Sep</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-default-200/70 bg-content1/80 p-4 dark:border-white/8">
                  <p className="text-xs font-semibold">Income by platform</p>
                  <p className="mt-1 text-[10px] text-default-400">Your strongest sources at a glance</p>

                  <div className="mt-5 space-y-4">
                    {[
                      ['Upwork', '42%', 'bg-primary'],
                      ['DataAnnotation', '28%', 'bg-secondary'],
                      ['Outlier', '18%', 'bg-cyan-500'],
                      ['Other', '12%', 'bg-success'],
                    ].map(([name, value, color]) => (
                      <div key={name}>
                        <div className="mb-1.5 flex items-center justify-between text-[10px]">
                          <span className="font-medium">{name}</span>
                          <span className="text-default-400">{value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-default-200/70">
                          <div className={`h-full rounded-full ${color}`} style={{ width: value }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-default-200/70 bg-content1/45 py-20 backdrop-blur-sm dark:border-white/8 dark:bg-content1/20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Everything in one place</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Built around the way you actually earn
              </h2>
              <p className="mt-4 text-sm leading-6 text-default-500 sm:text-base">
                Revnivo connects the daily details of freelance and multi-platform income
                with the bigger picture you need to make sense of it.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="group rounded-2xl border border-default-200/70 bg-background/70 p-6 transition duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg dark:border-white/8 dark:bg-background/35"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-default-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Simple by design</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                From scattered payments to a clear income system.
              </h2>
              <p className="mt-4 text-sm leading-6 text-default-500 sm:text-base">
                No spreadsheet maze. Add your sources, record what you earn, and let the
                dashboard turn those entries into a useful view of your work.
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="grid gap-4 rounded-2xl border border-default-200/70 bg-content1/60 p-5 backdrop-blur-sm dark:border-white/8 sm:grid-cols-[64px_1fr] sm:p-6"
                >
                  <div className="text-2xl font-bold tracking-tight text-primary/55">{step.number}</div>
                  <div>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-default-500">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative overflow-hidden rounded-[28px] border border-primary/15 bg-primary px-6 py-12 text-white shadow-[0_24px_70px_rgba(0,111,238,0.25)] sm:px-10 lg:px-14 lg:py-14">
            <div aria-hidden="true" className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-black/10 blur-3xl" />

            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <ShieldCheck size={14} />
                  Your workspace, organized
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Make your income easier to understand.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
                  Start with your first platform and build one clean record of the work that pays you.
                </p>
              </div>

              <Button
                as={Link}
                to={isAuthenticated ? '/dashboard' : '/register'}
                radius="lg"
                size="lg"
                className="h-12 shrink-0 bg-white px-6 font-semibold text-primary shadow-lg"
                endContent={<ArrowRight size={17} />}
              >
                {isAuthenticated ? 'Go to dashboard' : 'Create your workspace'}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-default-200/70 bg-content1/35 dark:border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Revnivo" className="brand-logo h-7 w-auto" />
            <span className="text-xs text-default-400">Income, organized.</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-default-500">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            {!isAuthenticated && <Link to="/login" className="hover:text-foreground">Sign in</Link>}
          </div>
        </div>
      </footer>
    </div>
  )
}
