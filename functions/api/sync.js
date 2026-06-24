// Cloudflare Pages Function — cross-device study-log sync via Workers KV.
// Bind a KV namespace named SYNC in the Pages project settings.
// The passphrase is never stored: its SHA-256 hash is the KV key.

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

async function keyFor(passphrase) {
  const bytes = new TextEncoder().encode(`level-b-study::${passphrase}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return 'sync:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequest(context) {
  const { request, env } = context
  if (!env.SYNC) return json(503, { error: 'Sync storage is not configured (bind a KV namespace named SYNC).' })

  const passphrase = request.headers.get('x-sync-pass') ?? ''
  if (passphrase.length < 8) return json(400, { error: 'Sync passphrase must be at least 8 characters.' })
  const key = await keyFor(passphrase)

  if (request.method === 'GET') {
    const stored = await env.SYNC.get(key)
    return json(200, { data: stored ? JSON.parse(stored) : null })
  }

  if (request.method === 'PUT' || request.method === 'POST') {
    const body = await request.text()
    if (body.length > 4_000_000) return json(413, { error: 'Backup too large.' })
    await env.SYNC.put(key, body)
    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
