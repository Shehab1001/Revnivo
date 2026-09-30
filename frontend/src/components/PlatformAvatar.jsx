export default function PlatformAvatar({ platform, size = 'md' }) {
  const box = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
  return <img src={platform?.logo_url || '/platform_logo.jpg'} alt={platform?.name || 'Platform'} className={`${box} rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700`} />
}
