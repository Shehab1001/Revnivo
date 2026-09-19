export default function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  )
}
