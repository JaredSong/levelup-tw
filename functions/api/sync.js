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

  // Older clients stored the BackupData directly (no { version, data } wrapper).
  // Treat such a record as version 0 data so legacy cloud copies still load.
  const readRecord = (stored) => {
    if (!stored) return { version: 0, data: null }
    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed.version === 'number' && 'data' in parsed) return { version: parsed.version, data: parsed.data }
    return { version: 0, data: parsed }
  }

  if (request.method === 'GET') {
    const record = readRecord(await env.SYNC.get(key))
    return json(200, { version: record.version, data: record.data })
  }

  if (request.method === 'PUT' || request.method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'Invalid body.' })
    }
    if (JSON.stringify(body.data ?? null).length > 4_000_000) return json(413, { error: 'Backup too large.' })

    // Optimistic concurrency: reject if the cloud copy moved since the client read
    // it, so a concurrent device cannot blindly overwrite the other's merge.
    const stored = await env.SYNC.get(key)
    const current = readRecord(stored)
    if (stored && current.version !== body.baseVersion) {
      return json(409, { error: 'conflict', version: current.version, data: current.data })
    }
    const next = { version: current.version + 1, data: body.data }
    await env.SYNC.put(key, JSON.stringify(next))
    return json(200, { ok: true, version: next.version })
  }

  return json(405, { error: 'Method not allowed' })
}
