import { explain } from '../../api/_explain-core.mjs'

// Netlify Functions v2 (Web Request/Response). Routed at /api/explain via config.
export default async (request) => {
  const send = (status, payload) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })

  if (request.method !== 'POST') return send(405, { error: 'Method not allowed' })

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { status, payload } = await explain({
    body,
    authorization: request.headers.get('authorization'),
    env: process.env,
  })
  return send(status, payload)
}

export const config = { path: '/api/explain' }
