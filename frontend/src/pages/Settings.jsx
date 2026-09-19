import { Camera, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(user?.profile_image_url || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const chooseImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImage(file); setPreview(URL.createObjectURL(file))
  }

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      const form = new FormData()
      form.append('name', name)
      if (image) form.append('profile_image', image)
      const updated = await updateProfile(form)
      setPreview(updated.profile_image_url || preview)
      setMessage('Profile updated successfully.')
    } catch (err) { setError(err.response?.data?.detail || 'Could not update profile.') }
    finally { setSaving(false) }
  }

  return <div className="max-w-2xl space-y-6">
    <div><p className="text-sm font-semibold text-[#16843d] dark:text-[#7bea9d]">Account</p><h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your name and profile image.</p></div>
    <form className="card space-y-6 p-6" onSubmit={submit}>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
      <div className="flex items-center gap-5"><div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-[#e8f8ed] text-[#16843d] dark:bg-[#23462e] dark:text-[#7bea9d]">{preview ? <img src={preview} alt="Profile" className="h-full w-full object-cover"/> : <UserRound size={38}/>}<label className="absolute inset-0 grid cursor-pointer place-items-center bg-black/45 text-white opacity-0 transition hover:opacity-100"><Camera size={20}/><input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/></label></div><div><h2 className="font-bold text-slate-900 dark:text-white">Profile image</h2><p className="text-sm text-slate-500">PNG, JPG, or WEBP.</p></div></div>
      <div><label className="label">Name</label><input className="input" required value={name} onChange={(event) => setName(event.target.value)}/></div>
      <div><label className="label">Email</label><input className="input" value={user?.email || ''} disabled/></div>
      <div className="flex justify-end"><button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button></div>
    </form>
  </div>
}
