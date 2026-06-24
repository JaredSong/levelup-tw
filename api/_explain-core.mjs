// Runtime-agnostic explanation logic shared by the Vite dev handler,
// the Vercel-style handler, and the Netlify function. No req/res coupling:
// callers pass plain data and get back { status, payload }.

const PROVIDERS = ['openai', 'anthropic', 'gemini']
const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-latest', gemini: 'gemini-2.5-flash' }
const KEY_NAMES = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }
const MODEL_ENV = { openai: 'OPENAI_MODEL', anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL' }

const BASE = `You are tutoring an English-speaking learner (who reads pinyin) for Taiwan's 網頁設計乙級 (Web Design Level B) written exam.
Write in clear English, but keep important Traditional Chinese technical or legal terms and add pinyin for them.
Format as short paragraphs. Use **bold** for key terms and start list items with "- ". Do not use Markdown headings, tables, or backticks.`

// Explanation styles all keep the default structure and only ADD their specialization.
const STYLE_EXTRAS = {
  simpler: 'Keep it to about 80-120 words, with very short sentences and beginner words; define each technical Chinese term and add pinyin.',
  metaphor: 'Open with a vivid everyday analogy before stating the rule, then tie the analogy back. If the item is legal, numerical, or a precise definition where an analogy could mislead, skip the analogy and explain directly.',
  deeper: 'Add the common exam trap for this item and at most two closely related facts worth knowing. Stay focused.',
}

// Reading mode is translation-only and never sees or reveals the answer.
const READING = `Translate and explain the question so a learner who reads pinyin can understand it. This is reading help only: do NOT reveal, hint at, or eliminate any option, and do not say which answer is correct.
- Restate the question stem in plain English, with pinyin for key Chinese terms.
- If the stem has a negation or odd-one-out phrase (不正確, 不包括, 何者為非, 不屬於, 下列何者錯誤, etc.), flag it clearly and explain the task is to find the FALSE or excluded item.
- Give a one-line plain-English gloss of each option, with pinyin for key terms.`

function buildPrompt(question, selected, style) {
  const choices = question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')

  if (style === 'reading') {
    return `${BASE}

${READING}

Question: ${question.prompt}
Choices:
${choices}`
  }

  const isMultiple = question.kind === 'multiple'
  const isImage = question.hasFigure || question.options.some((option) => option.includes('圖示'))

  // For image-only options the model can't see the choices, so it must not try
  // to reject them — that step is replaced with a pointer to the figure.
  const structure = isImage
    ? `Structure your answer:
- State the correct answer first, by its option number.
- Explain the governing rule or concept in 1-2 sentences.
- You were NOT given the figure and the options may be image-only, so do NOT describe, guess, or evaluate the individual options. Tell the learner to read the official figure to match the correct option.
- End with one short memory cue.`
    : `Structure your answer:
- State the correct answer first.
- Explain the governing rule or concept in 1-2 sentences.
- Briefly say why each other option is wrong or incomplete.
- End with one short memory cue (a hook or 口訣).`

  const extras = []
  if (STYLE_EXTRAS[style]) extras.push(STYLE_EXTRAS[style])
  if (isMultiple) extras.push('This is a MULTIPLE-answer question: explain why each correct option is required, and address any correct option the learner missed or any wrong option they added.')
  const extraBlock = extras.length ? `\n${extras.map((e) => `Also: ${e}`).join('\n')}` : ''

  return `${BASE}
Treat the supplied official answer as authoritative; never invent or override it.

${structure}${extraBlock}

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
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 800 }),
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
    body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
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
