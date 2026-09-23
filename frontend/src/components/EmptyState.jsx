export default function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-default-200 bg-default-50/40 p-10 text-center dark:border-default-100/15 dark:bg-default-100/5">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-default-500">{text}</p>
    </div>
  )
}
