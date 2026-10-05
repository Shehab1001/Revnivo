const BACKEND_ORIGIN = 'https://revnivo-production.up.railway.app'

function first(value) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeBody(req) {
  if (['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase())) {
    return undefined
  }

  if (req.body == null) {
    return undefined
  }

  if (
    typeof req.body === 'string' ||
    req.body instanceof Uint8Array
  ) {
    return req.body
  }

  const contentType = String(req.headers['content-type'] || '')

  if (contentType.includes('application/json')) {
    return JSON.stringify(req.body)
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(req.body).toString()
  }

  return JSON.stringify(req.body)
}

export default async function handler(req, res) {
  const rawPath = first(req.query?.path)

  if (!rawPath) {
    res.status(400).json({ detail: 'Missing backend API path.' })
    return
  }

  const cleanPath = String(rawPath)
    .replace(/^\/+/, '')
    .replace(/^api\//, '')

  const target = new URL(
    `/api/${cleanPath}`,
    BACKEND_ORIGIN
  )

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path' || value == null) continue

    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      target.searchParams.append(key, String(item))
    }
  }

  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue

    const lower = key.toLowerCase()

    if (
      [
        'host',
        'connection',
        'content-length',
        'transfer-encoding',
        'origin',
        'referer',
      ].includes(lower)
    ) {
      continue
    }

    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  }

  headers.set('x-forwarded-host', req.headers.host || '')
  headers.set('x-forwarded-proto', 'https')

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: normalizeBody(req),
      redirect: 'manual',
    })

    const setCookies =
      typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : []

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()

      if (
        [
          'set-cookie',
          'content-length',
          'content-encoding',
          'transfer-encoding',
          'connection',
        ].includes(lower)
      ) {
        return
      }

      res.setHeader(key, value)
    })

    if (setCookies.length) {
      res.setHeader('Set-Cookie', setCookies)
    } else {
      const setCookie = upstream.headers.get('set-cookie')
      if (setCookie) {
        res.setHeader('Set-Cookie', setCookie)
      }
    }

    res.setHeader('Cache-Control', 'no-store')

    const body = Buffer.from(await upstream.arrayBuffer())
    res.status(upstream.status).send(body)
  } catch (error) {
    console.error('Revnivo API proxy failed', error)
    res.status(502).json({
      detail: 'Could not reach the Revnivo backend.',
    })
  }
}
