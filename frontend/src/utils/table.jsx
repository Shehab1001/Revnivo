import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export function SortableHeader({ label, column, sort, onSort, className = '' }) {
  const Icon = sort.key !== column ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <th className={`sortable-header ${className}`.trim()}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1.5 font-inherit hover:text-primary"
        title={`Sort by ${label}`}
      >
        {label}
        <Icon size={13} />
      </button>
    </th>
  )
}
