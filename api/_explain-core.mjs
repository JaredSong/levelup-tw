// Runtime-agnostic explanation logic shared by the Vite dev handler,
// the Vercel-style handler, and the Netlify function. No req/res coupling:
// callers pass plain data and get back { status, payload }.

const PROVIDERS = ['openai', 'anthropic', 'gemini']
const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-latest', gemini: 'gemini-2.5-flash' }
const KEY_NAMES = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }
const MODEL_ENV = { openai: 'OPENAI_MODEL', anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL' }

const STYLE_NOTES = {
  metaphor: 'Use a vivid everyday metaphor or analogy to make the concept intuitive, then connect the analogy back to why the official answer is correct.',
  simpler: 'Explain as if to a complete beginner: very simple words, short sentences, no jargon unless you immediately define it.',
  deeper: 'Add more depth: the underlying concept, relevant background, and closely related ideas worth knowing for the exam.',
}

function buildPrompt(question, selected, style) {
  const choices = question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')
  const styleNote = STYLE_NOTES[style] ? `\nExtra instruction: ${STYLE_NOTES[style]}` : ''
  return `Explain this Taiwan Web Design Level B written-exam question to a beginner.
Use clear English, but retain important Traditional Chinese technical or legal terms in parentheses.
Explain why the official answer is correct and why the learner's choice is wrong or incomplete.
Treat the supplied official answer as authoritative. Be concise and do not invent a different answer.
Format as short paragraphs. You may use **bold** for key terms and "- " to start list items. Do not use Markdown headings, tables, or backticks.${styleNote}

Question: ${question.prompt}
Choices:
${choices}
Official answer: ${question.answers.join(', ')}
Learner selected: ${selected.length ? selected.join(', ') : 'none'}`
}

async function explainWithOpenAI(prompt, model, env) {
  // Base URL is configurable so OpenAI-compatible proxies can be used.
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 500 }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'OpenAI request failed')
  return data.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')?.text
}

async function explainWithAnthropic(prompt, model, env) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'Anthropic request failed')
  return data.content?.find((item) => item.type === 'text')?.text
}

async function explainWithGemini(prompt, model, env) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Disable "thinking" so the token budget goes to the answer, not hidden
      // reasoning (2.5/3.x are thinking models and otherwise starve the output).
      generationConfig: { maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'Gemini request failed')
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('')
}

const RUNNERS = { openai: explainWithOpenAI, anthropic: explainWithAnthropic, gemini: explainWithGemini }

/**
 * @param {object} args
 * @param {object} args.body parsed JSON request body
 * @param {string|null} args.authorization the Authorization header value
 * @param {Record<string,string|undefined>} args.env environment variables
 * @returns {Promise<{status:number, payload:object}>}
 */
export async function explain({ body, authorization, env }) {
  const expectedToken = env.AI_ACCESS_TOKEN
  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    return { status: 401, payload: { error: 'Invalid access token' } }
  }

  const { question, selected = [], provider: requested, style } = body ?? {}
  if (!question?.prompt || !Array.isArray(question.options) || !Array.isArray(question.answers)) {
    return { status: 400, payload: { error: 'Invalid question' } }
  }

  // The app can pick a provider per request; otherwise fall back to AI_PROVIDER.
  const candidate = String(requested ?? '').toLowerCase()
  const provider = PROVIDERS.includes(candidate)
    ? candidate
    : (env.AI_PROVIDER ?? '').toLowerCase()
  if (!PROVIDERS.includes(provider)) {
    return { status: 503, payload: { error: 'AI provider is not configured' } }
  }
  const keyName = KEY_NAMES[provider]
  if (!env[keyName]) {
    return { status: 503, payload: { error: `No API key set for ${provider}. Add ${keyName} to your environment.` } }
  }
  const model = env[MODEL_ENV[provider]] || env.AI_MODEL || DEFAULT_MODELS[provider]

  try {
    const prompt = buildPrompt(question, selected, String(style ?? '').toLowerCase())
    const explanation = await RUNNERS[provider](prompt, model, env)
    if (!explanation) throw new Error('The provider returned no explanation')
    return { status: 200, payload: { explanation, provider } }
  } catch (error) {
    return { status: 502, payload: { error: error instanceof Error ? error.message : 'AI request failed' } }
  }
}
