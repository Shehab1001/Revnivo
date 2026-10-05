import axios from 'axios'

const CSRF_STORAGE_KEY = 'revnivo_csrf'
const CSRF_COOKIE_NAME = 'revnivo_csrf'


export function getApiErrorMessage(error, fallback = 'Request failed.') {
  const data = error?.response?.data

  const flattenMessages = (value) => {
    if (value == null) return []

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return [String(value)]
    }

    if (Array.isArray(value)) {
      return value.flatMap(flattenMessages)
    }

    if (typeof value === 'object') {
      return Object.values(value).flatMap(flattenMessages)
    }

    return []
  }

  const detail = flattenMessages(data?.detail).filter(Boolean)

  if (detail.length) {
    return detail.join(' ')
  }

  const messages = flattenMessages(data).filter(Boolean)

  return messages.length
    ? messages.join(' ')
    : fallback
}

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
  const configured = String(
    import.meta.env.VITE_API_URL || ''
  ).trim()

  // Local development keeps using Vite's same-origin /api proxy.
  if (!configured) {
    return '/api'
  }

  return configured.replace(/\/+$/, '')
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
