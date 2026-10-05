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
    // Timezone is a better signal for where the browser is currently being used
    // than navigator.language (which may stay en-US regardless of residence).
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''

    const timezoneCurrencies = {
      'Africa/Cairo': 'EGP',
      'Asia/Riyadh': 'SAR',
      'Asia/Dubai': 'AED',
      'Asia/Qatar': 'QAR',
      'Asia/Kuwait': 'KWD',
      'Asia/Muscat': 'OMR',
      'Asia/Amman': 'JOD',
      'Asia/Istanbul': 'TRY',
      'Asia/Tokyo': 'JPY',
      'Asia/Seoul': 'KRW',
      'Asia/Kolkata': 'INR',
      'Asia/Shanghai': 'CNY',
      'Asia/Hong_Kong': 'HKD',
      'Asia/Singapore': 'SGD',
      'Europe/London': 'GBP',
      'Europe/Zurich': 'CHF',
      'Europe/Oslo': 'NOK',
      'Europe/Stockholm': 'SEK',
      'Europe/Warsaw': 'PLN',
      'America/New_York': 'USD',
      'America/Chicago': 'USD',
      'America/Denver': 'USD',
      'America/Los_Angeles': 'USD',
      'America/Toronto': 'CAD',
      'America/Vancouver': 'CAD',
      'America/Mexico_City': 'MXN',
      'America/Sao_Paulo': 'BRL',
      'Australia/Sydney': 'AUD',
      'Pacific/Auckland': 'NZD',
      'Africa/Johannesburg': 'ZAR',
    }

    if (timezoneCurrencies[timezone]) return timezoneCurrencies[timezone]
    if (timezone.startsWith('Europe/')) return 'EUR'

    const locales = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || '']

    for (const locale of locales) {
      const region = new Intl.Locale(locale).region?.toUpperCase()
      if (region && countryCurrencies[region]) return countryCurrencies[region]
    }
  } catch { /* Keep the local default when browser locale data is unavailable. */ }

  return 'EGP'
}

export function getCurrencyOptions(extra = []) {
  return Array.from(new Set([...extra, ...supportedCurrencyCodes])).sort().map(currencyOption)
}
