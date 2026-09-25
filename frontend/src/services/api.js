import axios from 'axios'

const CSRF_STORAGE_KEY = 'revnivo_csrf'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 30000,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
})

api.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toLowerCase()

  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = sessionStorage.getItem(CSRF_STORAGE_KEY)
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    const csrf = response.headers?.['x-csrf-token']
    if (csrf) {
      sessionStorage.setItem(CSRF_STORAGE_KEY, csrf)
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem(CSRF_STORAGE_KEY)

      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register') &&
        !window.location.pathname.startsWith('/forgot-password')
      ) {
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
