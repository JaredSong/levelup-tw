// Tell IndexNow engines (Bing, and through it Yahoo 奇摩, plus Yandex, Naver,
// Seznam) which public URLs exist or changed. Google does not use IndexNow;
// it reads the sitemap.
//
// The key is public by design: IndexNow proves ownership by fetching
// https://levelup.tw/<key>.txt, which ships from public/. Run this only after
// that file is live, or the submission is rejected (403).
//
//   node scripts/indexnow.mjs              # submit every URL in the live sitemap
//   node scripts/indexnow.mjs --dry-run    # print what would be sent
//   node scripts/indexnow.mjs /exam/x/ ... # submit only these paths
import { readdirSync } from 'node:fs'

const HOST = 'levelup.tw'
const ORIGIN = `https://${HOST}`

export function findKey(files = readdirSync(new URL('../public/', import.meta.url))) {
  const keys = files.filter((file) => /^[a-f0-9]{32}\.txt$/.test(file))
  if (keys.length !== 1) throw new Error(`expected exactly one IndexNow key file in public/, found ${keys.length}`)
  return keys[0].slice(0, -4)
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

export function buildPayload(key, urls) {
  const outside = urls.filter((url) => !url.startsWith(`${ORIGIN}/`))
  if (outside.length) throw new Error(`refusing to submit URLs outside ${ORIGIN}: ${outside.join(', ')}`)
  // IndexNow accepts up to 10,000 URLs per request; the site is far below that.
  if (!urls.length || urls.length > 10_000) throw new Error(`unexpected URL count ${urls.length}`)
  return { host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: urls }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const paths = args.filter((arg) => !arg.startsWith('--'))
  const key = findKey()
  const urls = paths.length
    ? paths.map((path) => new URL(path, ORIGIN).toString())
    : sitemapUrls(await (await fetch(`${ORIGIN}/sitemap.xml`)).text())
  const payload = buildPayload(key, urls)
  if (dryRun) {
    console.log(JSON.stringify({ ...payload, urlList: `${payload.urlList.length} URLs`, first: payload.urlList.slice(0, 3) }, null, 2))
    return
  }
  const live = await fetch(payload.keyLocation)
  if (!live.ok || (await live.text()).trim() !== key) {
    throw new Error(`${payload.keyLocation} is not live with the key yet — deploy first`)
  }
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })
  // 200 = accepted, 202 = accepted and the key is still being checked.
  console.log(`IndexNow: HTTP ${response.status} for ${payload.urlList.length} URLs`)
  if (response.status !== 200 && response.status !== 202) process.exitCode = 1
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname
if (isMain) await main()
