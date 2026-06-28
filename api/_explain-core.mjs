// Runtime-agnostic explanation logic shared by API handlers. No req/res coupling:
// callers pass plain data and get back { status, payload }.

const PROVIDERS = ['openai', 'anthropic', 'gemini']
const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.5-flash' }
const KEY_NAMES = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }
const MODEL_ENV = { openai: 'OPENAI_MODEL', anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL' }

const BASE = `You are tutoring an English-speaking learner for Taiwan's 網頁設計乙級 (Web Design Level B) written exam.
Write in clear English. When you mention a Traditional Chinese technical or legal term, follow it with a concise English meaning. Do NOT add pinyin.
Format as short paragraphs. Use **bold** for key terms and start list items with "- ". Do not use Markdown headings, tables, or backticks.`

// Per-style length and emphasis. Default stays tight; only Deeper goes option by option.
const STYLE = {
  default: { words: '100-150 words', extra: '' },
  simpler: { words: '60-90 words', extra: 'Use very short sentences and beginner words; define each technical term in plain English.' },
  metaphor: { words: '100-140 words', extra: 'Open with a vivid everyday analogy, then the rule and the correct answer. Skip the analogy for legal, numerical, or precise-definition items where it could mislead.' },
  deeper: { words: '180-250 words', extra: 'Also go through each option, explaining why the wrong ones are wrong, and add the underlying concept plus at most two closely related facts.' },
}

// Reading mode is translation-only and never sees or reveals the answer.
const READING = `Translate and explain the question only — reading help. Do NOT reveal, hint at, or eliminate any option, and do not say which answer is correct.
- Restate the question stem in plain English. When you mention a Chinese term, give a short English meaning (no pinyin).
- If the stem has a negation or odd-one-out phrase (不正確, 不包括, 何者為非, 不屬於, 下列何者錯誤, etc.), flag it clearly and explain the task is to find the FALSE or excluded item.
- Give a one-line plain-English gloss of each option.
Keep it to about 60-100 words.`

function buildPrompt(question, selected, style) {
  const choices = question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')

  if (style === 'reading') {
    return `${BASE}

${READING}

Question: ${question.prompt}
Choices:
${choices}`
  }

  const variant = STYLE[style] ?? STYLE.default
  const isMultiple = question.kind === 'multiple'
  const isImage = question.hasFigure || question.options.some((option) => option.includes('圖示'))

  // Default covers only the essentials; image questions can't evaluate options.
  const cover = isImage
    ? `Cover only, concisely:
- the correct answer (by option number) and the rule behind it,
- focus on the learner's selected option(s): why that selection does not match the official answer, or why it matches if correct,
- you were NOT given the figure and options may be image-only, so do NOT describe or evaluate options — tell the learner to read the official figure,
- one common exam trap,
- one short memory cue (a hook or 口訣).`
    : `Cover only, concisely:
- the correct answer and the rule behind it,
- focus on the learner's selected option(s): why that selection is wrong, or why it is right if correct,
${isMultiple ? '- which options are required, and any the learner missed or wrongly added,\n' : ''}- one common exam trap,
- one short memory cue (a hook or 口訣).
Do not analyse unselected options unless they are needed to explain the learner's mistake or the learner asked to go deeper.`

  const extraLine = variant.extra ? `\n${variant.extra}` : ''

  return `${BASE}
Treat the supplied official answer as authoritative; never invent or override it.

${cover}
Keep the whole answer to about ${variant.words}.${extraLine}

Question: ${question.prompt}
Choices:
${choices}
Official answer: ${question.answers.join(', ')}
Learner selected: ${selected.length ? selected.join(', ') : 'none'}`
}

// Token caps sized to each style's word limit, so calls are short and cheap.
const STYLE_TOKENS = { default: 320, simpler: 220, metaphor: 300, deeper: 540, reading: 240 }
function tokensFor(style) {
  return STYLE_TOKENS[style] ?? STYLE_TOKENS.default
}

async function explainWithOpenAI(prompt, model, env, maxTokens) {
  // Base URL is configurable so OpenAI-compatible proxies can be used.
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${base}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: maxTokens }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'OpenAI request failed')
  return data.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')?.text
}

async function explainWithAnthropic(prompt, model, env, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'Anthropic request failed')
  return data.content?.find((item) => item.type === 'text')?.text
}

async function explainWithGemini(prompt, model, env, maxTokens) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Disable "thinking" so the token budget goes to the answer, not hidden
      // reasoning (2.5/3.x are thinking models and otherwise starve the output).
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
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
    const normalizedStyle = String(style ?? '').toLowerCase()
    const prompt = buildPrompt(question, selected, normalizedStyle)
    const explanation = await RUNNERS[provider](prompt, model, env, tokensFor(normalizedStyle))
    if (!explanation) throw new Error('The provider returned no explanation')
    return { status: 200, payload: { explanation, provider } }
  } catch (error) {
    return { status: 502, payload: { error: error instanceof Error ? error.message : 'AI request failed' } }
  }
}
