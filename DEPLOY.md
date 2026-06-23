# Deploy guide — Level B Study

The app is a static site (`dist/`) plus one serverless function for AI explanations.
Everything except AI runs fully in the browser.

## Environment variables (set these on the host)

| Variable | Required | Example / note |
|---|---|---|
| `AI_ACCESS_TOKEN` | for AI | A passphrase you invent. Paste the same value into the app: Stats → AI explanations. |
| `AI_PROVIDER` | for AI | `openai` (default) · `gemini` · `anthropic` |
| `OPENAI_API_KEY` | if using OpenAI | your key |
| `OPENAI_MODEL` | optional | `gpt-5.5` |
| `OPENAI_BASE_URL` | if using a proxy | `https://api.sublyx.org` (omit for real OpenAI) |
| `GEMINI_API_KEY` | if using Gemini | your Google AI Studio key |
| `GEMINI_MODEL` | optional | `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | if using Claude | your key |
| `ANTHROPIC_MODEL` | optional | `claude-3-5-haiku-latest` |

Never commit real keys. `.env` is gitignored; on hosts use their dashboard.

---

## Option A — Netlify (recommended; AI works)

Connect via Git so the function deploys too.

1. Push this repo to GitHub.
2. app.netlify.com → **Add new site → Import from Git** → pick the repo.
3. Netlify reads `netlify.toml` automatically (build `npm run build`, publish `dist`,
   functions in `netlify/functions`). Click **Deploy**.
4. **Site settings → Environment variables** → add the vars from the table above.
5. **Deploys → Trigger deploy** (so the new vars take effect).

Manual alternative (no AI): `npm run build`, then drag the `dist` folder onto
Netlify's "Deploy manually" area. The function will not run this way.

---

## Option B — Cloudflare Pages (AI works)

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build command: `npm run build` · Output directory: `dist`.
   (`functions/api/explain.js` is auto-detected; `public/_redirects` handles SPA routing.)
4. **Settings → Environment variables** → add the vars from the table above.
5. Re-deploy.

---

## After deploy

- Open the site, go to **Stats → AI explanations**, pick the provider, paste your
  `AI_ACCESS_TOKEN`, then answer a question and tap **Explain this question**.
- Your study data (progress, mock history) is stored per-browser. Use
  **Stats → Your data → Export / Import backup** to move it between devices.
