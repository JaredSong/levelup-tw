import { execSync } from 'node:child_process'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// A short build id (date · commit) so the running app can show which build it is.
function buildId(): string {
  const sha = process.env.CF_PAGES_COMMIT_SHA
    ?? (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' } })()
  return `${new Date().toISOString().slice(0, 10)} · ${sha.slice(0, 7)}`
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
        name: 'Level B Study',
        short_name: 'Level B',
        description: 'Offline practice for Taiwan Web Design Level B written exam.',
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
        globPatterns: ['**/*.{js,css,html,svg,json,jpg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
