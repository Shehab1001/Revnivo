import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'

const valueOf = (item, key) => typeof key === 'function' ? key(item) : item[key]

export function useSortableData(items, defaultKey = '') {
  const [sort, setSort] = useState({ key: defaultKey, direction: 'desc' })
  const sortedItems = useMemo(() => [...items].sort((left, right) => {
    if (!sort.key) return 0
    const a = valueOf(left, sort.key)
    const b = valueOf(right, sort.key)
    const aNumber = typeof a === 'number' ? a : Number(a)
    const bNumber = typeof b === 'number' ? b : Number(b)
    const bothNumeric = a !== '' && b !== '' && Number.isFinite(aNumber) && Number.isFinite(bNumber)
    const comparison = bothNumeric ? aNumber - bNumber : String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' })
    return sort.direction === 'asc' ? comparison : -comparison
  }), [items, sort])

  const requestSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }))
  return { sortedItems, sort, requestSort }
}

export function SortableHeader({ label, column, sort, onSort, className = '' }) {
  const Icon = sort.key !== column ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
  return <th className={className}><button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1.5 font-inherit hover:text-primary" title={`Sort by ${label}`}>{label}<Icon size={13} /></button></th>
}
