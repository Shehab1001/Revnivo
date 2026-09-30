const DEFAULT_PROFILE_IMAGE = '/profile_logo.jpg'

export default function ProfileAvatar({ user, className = 'h-10 w-10', alt = 'Profile' }) {
  return (
    <img
      src={user?.profile_image_url || DEFAULT_PROFILE_IMAGE}
      alt={alt}
      className={`${className} shrink-0 rounded-full border border-default-300/80 object-cover dark:border-white/15`}
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = DEFAULT_PROFILE_IMAGE
      }}
    />
  )
}
