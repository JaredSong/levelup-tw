// Cloudflare Pages Function — cross-device study-log sync via Workers KV.
// Bind a KV namespace named SYNC in the Pages project settings.
// The secret is never stored: its SHA-256 hash is the KV key.
//
// Key history, all read on GET so no device is ever orphaned, with writes
// always going to the canonical scheme so records migrate forward by use:
//
//   canonical  hash(secret)            — a generated ~58-bit sync code
//   legacy v2  hash(name::secret)      — brief attempt to shore up weak
//                                        passphrases with the profile name
//   (v1 was hash(secret) too, so canonical also covers pre-v2 devices.)
//
// The name is gone from the key. It was only ever propping up a passphrase
// short enough to guess, and it made a cosmetic field into an un-editable
// credential — a name is not a secret, and a secret should not be a greeting.
// A generated code carries its own entropy, so neither crutch is needed.

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

async function digestHex(input) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function keyFor(secret) {
  return 'sync:' + await digestHex(`level-b-study::${secret}`)
}

async function legacyNameKeyFor(secret, name) {
  const normalizedName = (name ?? '').trim().toLowerCase()
  return 'sync:' + await digestHex(`level-b-study::${normalizedName}::${secret}`)
}

export async function onRequest(context) {
  const { request, env } = context
  if (!env.SYNC) return json(503, { error: 'Sync storage is not configured (bind a KV namespace named SYNC).' })

  const secret = request.headers.get('x-sync-pass') ?? ''
  if (secret.length < 8) return json(400, { error: 'Sync passphrase must be at least 8 characters.' })
  const name = request.headers.get('x-sync-name') ?? ''
  // Writes always land here; reads fall back through older schemes.
  const key = await keyFor(secret)

  // Older clients stored the BackupData directly (no { version, data } wrapper).
  // Treat such a record as version 0 data so legacy cloud copies still load.
  const readRecord = (stored) => {
    if (!stored) return { version: 0, data: null }
    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed.version === 'number' && 'data' in parsed) return { version: parsed.version, data: parsed.data }
    return { version: 0, data: parsed }
  }

  if (request.method === 'GET') {
    let record = readRecord(await env.SYNC.get(key))
    // Nothing under the canonical key yet — this device may predate it. Check the
    // name-scoped scheme and hand back whatever is there as the starting point;
    // the next PUT targets the canonical key, so the record migrates forward on
    // its own without the learner doing anything.
    if (!record.data && name) {
      const legacy = readRecord(await env.SYNC.get(await legacyNameKeyFor(secret, name)))
      if (legacy.data) record = legacy
    }
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
