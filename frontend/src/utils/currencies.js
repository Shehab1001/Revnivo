export const fallbackCurrencies = ['USD', 'AED', 'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'EGP', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'KRW', 'MXN', 'NOK', 'NZD', 'PLN', 'QAR', 'SAR', 'SEK', 'SGD', 'TRY', 'ZAR']

export const supportedCurrencyCodes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : fallbackCurrencies
export const currencyNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null

export const currencyCountries = {
  USD: 'US', AED: 'AE', AUD: 'AU', BGN: 'BG', BRL: 'BR', CAD: 'CA', CHF: 'CH', CNY: 'CN', CZK: 'CZ', DKK: 'DK', EGP: 'EG', EUR: 'EU', GBP: 'GB', HKD: 'HK', HUF: 'HU', IDR: 'ID', ILS: 'IL', INR: 'IN', JPY: 'JP', KRW: 'KR', KWD: 'KW', MAD: 'MA', MXN: 'MX', MYR: 'MY', NGN: 'NG', NOK: 'NO', NZD: 'NZ', PHP: 'PH', PKR: 'PK', PLN: 'PL', QAR: 'QA', RON: 'RO', RUB: 'RU', SAR: 'SA', SEK: 'SE', SGD: 'SG', THB: 'TH', TRY: 'TR', UAH: 'UA', VND: 'VN', ZAR: 'ZA', XAF: 'CM', XOF: 'SN', XPF: 'PF', BHD: 'BH', OMR: 'OM', JOD: 'JO', TWD: 'TW', CLP: 'CL', COP: 'CO', PEN: 'PE', ARS: 'AR', ISK: 'IS', KES: 'KE', GHS: 'GH', TZS: 'TZ', UGX: 'UG', ETB: 'ET', DZD: 'DZ', TND: 'TN', LKR: 'LK', BDT: 'BD', NPR: 'NP', MMK: 'MM', KHR: 'KH', LAK: 'LA', MNT: 'MN', BOB: 'BO', PYG: 'PY', UYU: 'UY', CRC: 'CR', DOP: 'DO', GTQ: 'GT', HNL: 'HN', NIO: 'NI', PAB: 'PA', JMD: 'JM', TTD: 'TT', BSD: 'BS', BBD: 'BB', XCD: 'AG', FJD: 'FJ', WST: 'WS', TOP: 'TO', VUV: 'VU', SBD: 'SB', PGK: 'PG', MUR: 'MU', SCR: 'SC', NAD: 'NA', BWP: 'BW', SZL: 'SZ', MZN: 'MZ', ZMW: 'ZM', RWF: 'RW', SOS: 'SO', SDG: 'SD', LYD: 'LY', IQD: 'IQ', IRR: 'IR', AFN: 'AF', KZT: 'KZ', UZS: 'UZ', AZN: 'AZ', GEL: 'GE', AMD: 'AM', BYN: 'BY', MDL: 'MD', ALL: 'AL', BAM: 'BA', RSD: 'RS', MKD: 'MK', AWG: 'AW', ANG: 'CW', BND: 'BN', BTN: 'BT', GYD: 'GY', KGS: 'KG', KPW: 'KP', LBP: 'LB', MOP: 'MO', MVR: 'MV', SYP: 'SY', TJS: 'TJ', TMT: 'TM', YER: 'YE', SRD: 'SR', XCG: 'CW', XDR: 'UN', BZD: 'BZ', CVE: 'CV', DJF: 'DJ', ERN: 'ER', GMD: 'GM', GNF: 'GN', HTG: 'HT', JPY: 'JP', KMF: 'KM', LSL: 'LS', MGA: 'MG', MWK: 'MW', MRU: 'MR', MOP: 'MO', PYG: 'PY', SLL: 'SL', TWD: 'TW', VES: 'VE', XOF: 'SN'
}

export const countryCurrencies = { AE: 'AED', AU: 'AUD', BR: 'BRL', CA: 'CAD', CH: 'CHF', CN: 'CNY', EG: 'EGP', EU: 'EUR', GB: 'GBP', HK: 'HKD', IN: 'INR', JP: 'JPY', KR: 'KRW', MA: 'MAD', MX: 'MXN', NG: 'NGN', NO: 'NOK', NZ: 'NZD', PK: 'PKR', PL: 'PLN', QA: 'QAR', RU: 'RUB', SA: 'SAR', SE: 'SEK', SG: 'SGD', TR: 'TRY', UA: 'UAH', US: 'USD', ZA: 'ZAR' }

export function currencyOption(code) {
  let name = code
  try { name = currencyNames?.of(code) || code } catch { name = code }
  return { code, name }
}

export function currencyCountry(code) {
  return (currencyCountries[code] || 'UN').toLowerCase()
}

export function detectLocalCurrency() {
  try {
    const region = new Intl.Locale(navigator.language || '').region?.toUpperCase()
    if (region && countryCurrencies[region]) return countryCurrencies[region]
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (timezone === 'Africa/Cairo') return 'EGP'
    if (timezone.includes('Tokyo')) return 'JPY'
    if (timezone.includes('London')) return 'GBP'
    if (timezone.includes('New_York') || timezone.includes('Los_Angeles')) return 'USD'
    if (timezone.includes('Europe/')) return 'EUR'
  } catch { /* Keep the local default when locale data is unavailable. */ }
  return 'EGP'
}

export function getCurrencyOptions(extra = []) {
  return Array.from(new Set([...extra, ...supportedCurrencyCodes])).sort().map(currencyOption)
}
