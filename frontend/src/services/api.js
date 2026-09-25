import axios from 'axios'

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`
  const item = document.cookie
    .split('; ')
    .find((value) => value.startsWith(prefix))

  return item
    ? decodeURIComponent(item.slice(prefix.length))
    : ''
}

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
    const csrf = readCookie('revnivo_csrf')
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
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

    return Promise.reject(error)
  }
)

export default api
