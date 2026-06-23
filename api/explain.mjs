import { explain } from './_explain-core.mjs'

// Node/Vercel-style handler, also used by the Vite dev middleware.
export default async function handler(request, response) {
  const send = (status, body) => {
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(body))
  }
  if (request.method !== 'POST') return send(405, { error: 'Method not allowed' })
  const { status, payload } = await explain({
    body: request.body,
    authorization: request.headers.authorization ?? null,
    env: process.env,
  })
  return send(status, payload)
}
