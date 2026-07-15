// Cloudflare Pages Function — cross-device study-log sync via Workers KV.
// Bind a KV namespace named SYNC in the Pages project settings.
// The passphrase (and name, see below) is never stored: its SHA-256 hash is
// the KV key.
//
// The record is keyed by passphrase + profile name, not passphrase alone.
// Short human-typeable passphrases collide across strangers (the whole design
// point is "no account, no password rules"), and a collision here isn't a
// login error — it silently merges two people's exam history into one record
// with no warning either side. Name is already collected in the same
// onboarding step as the passphrase, so this is free entropy, not new typing.
// It doesn't eliminate collisions (a blank name, or a common name + common
// passphrase, still can), but it closes the overwhelmingly common case.

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

async function keyFor(passphrase, name) {
  const normalizedName = (name ?? '').trim().toLowerCase()
  return 'sync:' + await digestHex(`level-b-study::${normalizedName}::${passphrase}`)
}

// Pre-name scheme, kept only so a device that synced before this change isn't
// orphaned. Never written to again once a record exists under the new key.
async function legacyKeyFor(passphrase) {
  return 'sync:' + await digestHex(`level-b-study::${passphrase}`)
}

export async function onRequest(context) {
  const { request, env } = context
  if (!env.SYNC) return json(503, { error: 'Sync storage is not configured (bind a KV namespace named SYNC).' })

  const passphrase = request.headers.get('x-sync-pass') ?? ''
  if (passphrase.length < 8) return json(400, { error: 'Sync passphrase must be at least 8 characters.' })
  const name = request.headers.get('x-sync-name') ?? ''
  const key = await keyFor(passphrase, name)

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
    // First read under the new name+passphrase key: nothing there yet, so check
    // the pre-name key once. If it has data, hand it back as this device's
    // starting point; the next PUT (below) always targets the new key, so the
    // record migrates forward on its own without the learner doing anything.
    if (!record.data) {
      const legacy = readRecord(await env.SYNC.get(await legacyKeyFor(passphrase)))
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
