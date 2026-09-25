import axios from 'axios'

const CSRF_STORAGE_KEY = 'revnivo_csrf'
const CSRF_COOKIE_NAME = 'revnivo_csrf'

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`
  const value = document.cookie
    .split('; ')
    .find((item) => item.startsWith(prefix))

  return value
    ? decodeURIComponent(value.slice(prefix.length))
    : ''
}

function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  const hostname = window.location.hostname

  // In local development always use Vite's same-origin proxy. This avoids
  // localhost/127.0.0.1 cookie mismatches while keeping the JWT HttpOnly.
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    return '/api'
  }

  return configured || '/api'
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  timeout: 30000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
})

api.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toLowerCase()

  if (!['get', 'head', 'options'].includes(method)) {
    const csrf =
      getCookie(CSRF_COOKIE_NAME) ||
      sessionStorage.getItem(CSRF_STORAGE_KEY)

    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    const csrf =
      response.headers?.['x-csrf-token'] ||
      getCookie(CSRF_COOKIE_NAME)

    if (csrf) {
      sessionStorage.setItem(CSRF_STORAGE_KEY, csrf)
    }

    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem(CSRF_STORAGE_KEY)

      const path = window.location.pathname
      const isPublicAuthPage =
        path.startsWith('/login') ||
        path.startsWith('/register') ||
        path.startsWith('/forgot-password')

      // Let the initial /auth/me/ check decide routing. Other authenticated
      // requests can still send the user to login when the session is invalid.
      const isSessionCheck =
        error.config?.url?.includes('/auth/me/')

      if (!isPublicAuthPage && !isSessionCheck) {
        localStorage.removeItem('revnivo_token')
        localStorage.removeItem('incomeflow_token')
        localStorage.removeItem('revnivo_user')
        localStorage.removeItem('incomeflow_user')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
