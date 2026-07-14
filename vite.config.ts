import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// A readable build label (app version + build date) shown in the app, so it's
// easy to tell at a glance whether the installed PWA is up to date.
function buildId(): string {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  // Cloudflare builds in UTC; show the date in Taiwan time so it always
  // matches "today" for the learner instead of sometimes reading a day early.
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Taipei' })
  return `v${version} · ${date}`
}

// Serves /api/explain during `npm run dev` so AI explanations work locally,
// mirroring how the same handler runs as a serverless function in production.
function devExplainApi(): Plugin {
  return {
    name: 'dev-explain-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use('/api/explain', async (req, res) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')
          ;(req as typeof req & { body: unknown }).body = raw ? JSON.parse(raw) : {}
        } catch {
          ;(req as typeof req & { body: unknown }).body = {}
        }
        const { default: handler } = await import('./api/explain.mjs')
        await handler(req, res)
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildId()),
  },
  plugins: [
    devExplainApi(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg'],
      manifest: {
        name: 'Level Up · 升級吧',
        short_name: 'Level Up',
        description: 'Offline practice for Taiwan skill certification exams.',
        theme_color: '#111713',
        background_color: '#f3f1eb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'level-up-data-packs',
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/question-(?:images|pages)\/.*\.(?:png|jpe?g|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'level-up-question-media',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
