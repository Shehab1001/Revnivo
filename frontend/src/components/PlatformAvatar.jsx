export default function PlatformAvatar({ platform, size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
  if (platform?.logo_url) return <img src={platform.logo_url} alt={platform.name} className={`${box} rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700`} />
  return <div className={`${box} grid place-items-center rounded-xl bg-[#e8f8ed] font-bold text-[#16843d] dark:bg-[#23462e] dark:text-[#7bea9d]`}>{platform?.name?.slice(0, 2).toUpperCase() || 'PL'}</div>
}
