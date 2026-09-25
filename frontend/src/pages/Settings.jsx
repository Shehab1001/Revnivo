import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
} from '@heroui/react'
import {
  Camera,
  CheckCircle2,
  Mail,
  Trash2,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

export default function Settings() {
  const { user, updateProfile } = useAuth()

  const [name, setName] = useState(user?.name || '')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(
    user?.profile_image_url || ''
  )
  const [saving, setSaving] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(user?.name || '')
    setPreview(user?.profile_image_url || '')
  }, [user?.name, user?.profile_image_url])

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  const hasChanges = useMemo(() => {
    return (
      name.trim() !== (user?.name || '').trim() ||
      Boolean(image) ||
      removeImage
    )
  }, [name, image, removeImage, user?.name])

  const chooseImage = (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    setError('')
    setMessage('')

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Please choose a PNG, JPG, or WEBP image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError('Profile image must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }

    setImage(file)
    setRemoveImage(false)
    setPreview(URL.createObjectURL(file))
  }

  const resetChanges = () => {
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }

    setName(user?.name || '')
    setImage(null)
    setRemoveImage(false)
    setPreview(user?.profile_image_url || '')
    setError('')
    setMessage('')
  }

  const submit = async (event) => {
    event.preventDefault()

    const cleanName = name.trim()

    if (!cleanName) {
      setError('Name is required.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const form = new FormData()
      form.append('name', cleanName)

      if (image) {
        form.append('profile_image', image)
      } else if (removeImage) {
        form.append('remove_profile_image', 'true')
      }

      const updated = await updateProfile(form)

      setName(updated?.name || cleanName)
      setPreview(
        updated?.profile_image_url || '/profile_logo.jpg'
      )
      setImage(null)
      setRemoveImage(false)
      setMessage('Profile updated successfully.')
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not update profile.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 text-foreground">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <ShieldCheck size={13} />
            Account settings
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Settings
          </h1>

          <p className="mt-1.5 max-w-xl text-sm leading-6 text-default-500">
            Manage your profile details and how your account appears across Revnivo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role && (
            <Chip
              size="sm"
              variant="flat"
              color={
                user.role === 'admin'
                  ? 'primary'
                  : 'default'
              }
              className="capitalize"
            >
              {user.role}
            </Chip>
          )}

          {user?.subscription_status && (
            <Chip
              size="sm"
              variant="flat"
              color="success"
              className="capitalize"
            >
              {user.subscription_status}
            </Chip>
          )}
        </div>
      </div>

      <Card
        radius="lg"
        className="
          border
          border-default-200/70
          bg-content1
          text-foreground
          shadow-sm
          dark:border-white/8
          dark:bg-content1
          dark:shadow-none
        "
      >
        <CardBody className="p-5 sm:p-6 lg:p-7">
          <form onSubmit={submit} className="space-y-7">
            {/* Feedback */}
            {error && (
              <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            {message && (
              <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                <CheckCircle2 size={16} />
                {message}
              </div>
            )}

            {/* Profile image */}
            <section>
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Profile image
                </h2>
                <p className="mt-1 text-xs text-default-500">
                  This image appears on your account and support messages.
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-default-200/70 bg-default-50/60 p-4 dark:border-white/8 dark:bg-default-100/40 sm:flex-row sm:items-center">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-default-200 bg-default-100 text-default-500 dark:border-white/10">
                  <img src={preview || '/profile_logo.jpg'} alt="Profile" className="h-full w-full object-cover" />

                  <label
                    className="
                      absolute
                      inset-0
                      grid
                      cursor-pointer
                      place-items-center
                      bg-black/55
                      text-white
                      opacity-0
                      transition-opacity
                      duration-200
                      hover:opacity-100
                    "
                    title="Change profile image"
                  >
                    <Camera size={20} />
                    <input
                      className="hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={chooseImage}
                    />
                  </label>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">
                    {user?.name || 'Your profile'}
                  </div>

                  <p className="mt-1 text-xs leading-5 text-default-500">
                    PNG, JPG, or WEBP. Maximum file size 5 MB.
                  </p>

                  {image && (
                    <p className="mt-1 truncate text-[11px] text-primary">
                      Selected: {image.name}
                    </p>
                  )}
                </div>

                <label className="inline-flex cursor-pointer">
                  <Button
                    as="span"
                    size="sm"
                    variant="flat"
                    radius="lg"
                    startContent={<Upload size={14} />}
                    className="font-medium"
                  >
                    Upload photo
                  </Button>

                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={chooseImage}
                  />
                </label>
                {user?.profile_image_url && !removeImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="light"
                    color="danger"
                    radius="lg"
                    onPress={() => {
                      setImage(null)
                      setRemoveImage(true)
                      setPreview('/profile_logo.jpg')
                    }}
                    startContent={<Trash2 size={14} />}
                  >
                    Remove photo
                  </Button>
                )}
              </div>
            </section>

            <div className="h-px bg-divider" />

            {/* Personal details */}
            <section>
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Personal details
                </h2>

                <p className="mt-1 text-xs text-default-500">
                  Keep your account information up to date.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Name"
                  placeholder="Your name"
                  isRequired
                  labelPlacement="outside"
                  variant="flat"
                  radius="lg"
                  size="md"
                  value={name}
                  onValueChange={setName}
                  classNames={{
                    base: 'gap-1.5',
                    label:
                      'text-[13px] font-semibold text-foreground',
                    inputWrapper:
                      'h-11 min-h-11 border border-transparent bg-default-100 px-3.5 shadow-none transition-all duration-200 data-[hover=true]:bg-default-200 group-data-[focus=true]:border-primary/50 group-data-[focus=true]:bg-default-100 group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/10 dark:bg-[#1b1b1f] dark:data-[hover=true]:bg-[#222226] dark:group-data-[focus=true]:bg-[#1b1b1f]',
                    input:
                      'text-sm text-foreground placeholder:text-default-400',
                  }}
                />

                <Input
                  label="Email"
                  value={user?.email || ''}
                  isReadOnly
                  labelPlacement="outside"
                  variant="flat"
                  radius="lg"
                  size="md"
                  startContent={
                    <Mail
                      size={15}
                      className="text-default-400"
                    />
                  }
                  description="Your sign-in email cannot be changed here."
                  classNames={{
                    base: 'gap-1.5',
                    label:
                      'text-[13px] font-semibold text-foreground',
                    inputWrapper:
                      'h-11 min-h-11 border border-transparent bg-default-100 px-3.5 shadow-none opacity-80 dark:bg-[#1b1b1f]',
                    input:
                      'text-sm text-default-500',
                    description:
                      'mt-1 text-[10px] text-default-400',
                  }}
                />
              </div>
            </section>

            <div className="h-px bg-divider" />

            {/* Actions */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] text-default-400">
                {hasChanges
                  ? 'You have unsaved changes.'
                  : 'Your profile is up to date.'}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="flat"
                  radius="lg"
                  size="md"
                  isDisabled={!hasChanges || saving}
                  onPress={resetChanges}
                  startContent={<RotateCcw size={14} />}
                >
                  Reset
                </Button>

                <Button
                  color="primary"
                  type="submit"
                  radius="lg"
                  size="md"
                  isLoading={saving}
                  isDisabled={!hasChanges}
                  startContent={
                    !saving ? <Save size={15} /> : null
                  }
                  className="font-semibold"
                >
                  {saving
                    ? 'Saving...'
                    : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
