export default function ProfileAvatar({ user, className = 'h-10 w-10', alt = 'Profile' }) {
  return (
    <img
      src={user?.profile_image_url || '/profile_logo.jpg'}
      alt={alt}
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  )
}


