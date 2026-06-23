import { explain } from '../../api/_explain-core.mjs'

// Cloudflare Pages Function — serves POST /api/explain. Env vars come from
// context.env (set in the Pages dashboard), not process.env.
export async function onRequestPost(context) {
  const { request, env } = context
  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const { status, payload } = await explain({
    body,
    authorization: request.headers.get('authorization'),
    env,
  })
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
