export default function Loading({ label = 'Loading...' }) {
  return <div className="flex min-h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">{label}</div>
}
