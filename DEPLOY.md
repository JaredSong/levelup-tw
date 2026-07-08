# Deploy guide — Level Up

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

## Cloudflare Pages (AI + cloud sync)

Use the **Pages** product, not "Create a Worker" — our app is a static site plus
Pages Functions, so `npx wrangler deploy` (the Worker flow) does not apply.

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages tab → Connect to Git**.
3. Pick the repo, then set:
   - Build command: `npm run build`
   - Build output directory: `dist`
   (`functions/api/*.js` is auto-detected; `public/_redirects` handles SPA routing.)
4. **Settings → Environment variables** → add the vars from the table above.
5. **Cloud sync (optional):** Storage & Databases → KV → create a namespace, then
   Pages project → **Settings → Bindings → Add → KV namespace**, variable name
   **`SYNC`**, choose that namespace.
6. Re-deploy.

### Using cloud sync
In the app: **Stats → Cloud sync** → enter the same passphrase (≥6 chars) on each
device. It pulls on open and pushes after each session, merging both devices'
progress, mock history, attempts and notes. The passphrase is never stored on the
server — only its hash is used as the storage key.

---

## After deploy

- Open the site, go to **Stats → AI explanations**, pick the provider, paste your
  `AI_ACCESS_TOKEN`, then answer a question and tap **Explain this question**.
- Your study data (progress, mock history) is stored per-browser. Use
  **Stats → Your data → Export / Import backup** to move it between devices.
