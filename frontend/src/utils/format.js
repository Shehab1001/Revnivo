export const formatMoney = (value = 0, currency = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`
  }
}

export const monthLabel = (month, year) => new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(year, month - 1, 1))
