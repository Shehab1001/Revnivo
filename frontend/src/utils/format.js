export const formatMoney = (value = 0, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`
  }
}

export const monthLabel = (month, year) => new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(year, month - 1, 1))

export const getUserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export const parseApiDate = (value) => {
  if (typeof value !== 'string') return new Date(value)
  const isTimezoneMissing = value.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/i.test(value)
  return new Date(isTimezoneMissing ? `${value}Z` : value)
}

export const formatDateTime = (value, locale = 'en-GB', options = {}) =>
  parseApiDate(value).toLocaleString(locale, { timeZone: getUserTimeZone(), ...options })

export const formatDate = (value, locale = 'en-GB', options = {}) =>
  parseApiDate(value).toLocaleDateString(locale, { timeZone: getUserTimeZone(), ...options })

export const formatTime = (value, locale = 'en-US', options = {}) =>
  parseApiDate(value).toLocaleTimeString(locale, { timeZone: getUserTimeZone(), ...options })

export const localDateInputValue = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getUserTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
