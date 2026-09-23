import { Spinner } from '@heroui/react'

export default function Loading({ label = 'Loading...' }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-default-500"><Spinner color="primary" size="sm"/><span>{label}</span></div>
}
