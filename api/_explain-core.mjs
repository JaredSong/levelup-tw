// Runtime-agnostic explanation logic shared by the Vite dev handler,
// the Vercel-style handler, and the Netlify function. No req/res coupling:
// callers pass plain data and get back { status, payload }.

const PROVIDERS = ['openai', 'anthropic', 'gemini']
const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-latest', gemini: 'gemini-2.5-flash' }
const KEY_NAMES = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }
const MODEL_ENV = { openai: 'OPENAI_MODEL', anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL' }

// Per-style instruction blocks. Default is a structured exam-oriented answer.
const STYLES = {
  default: `Structure your answer:
- State the correct answer first.
- Explain the governing rule or concept in 1-2 sentences.
- Briefly say why each other option is wrong or incomplete.
- End with one short memory cue (a hook or 口訣) to remember it.`,
  simpler: `Write 80-120 words. Use very short sentences and beginner words.
Define every technical Chinese term in plain English and add its pinyin.
Do not use jargon without immediately defining it.`,
  metaphor: `Start with a vivid everyday analogy, then connect it to the literal exam rule and the correct answer.
If this is a legal, numerical, or precise-definition question where an analogy could mislead, skip the analogy and explain directly.`,
  deeper: `Give the underlying concept, the common exam trap for this item, and at most two closely related facts worth knowing.
Stay focused; do not wander.`,
  reading: `Focus on understanding the QUESTION itself, not test strategy:
- Restate the question stem in plain English, with pinyin for key Chinese terms.
- If the stem contains a negation or odd-one-out phrase (不正確, 不包括, 何者為非, 不屬於, 下列何者錯誤, etc.), flag it clearly and state that the task is to find the FALSE or excluded item.
- Give a one-line plain-English gloss of each option (pinyin for key terms).
- Then state the correct answer.`,
}

function buildPrompt(question, selected, style) {
  const choices = question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')
  const styleBlock = STYLES[style] ?? STYLES.default

  const isMultiple = question.kind === 'multiple'
  const isImage = question.hasFigure || question.options.some((option) => option.includes('圖示'))
  const conditionals = []
  if (isMultiple) {
    conditionals.push('This is a MULTIPLE-answer question. Explain why each correct option is required, and explicitly address any correct option the learner missed or any wrong option they added.')
  }
  if (isImage) {
    conditionals.push('You were NOT given the figure/image for this question, and the options may be image-only placeholders. Do not describe, guess, or pretend to see any image. Explain the underlying concept and tell the learner to read the official figure to match the correct option.')
  }
  const conditionalBlock = conditionals.length ? `\n${conditionals.join('\n')}\n` : ''

  return `You are tutoring an English-speaking learner (who reads pinyin) for Taiwan's 網頁設計乙級 (Web Design Level B) written exam.
Write in clear English, but keep important Traditional Chinese technical or legal terms and add pinyin for them.
Treat the supplied official answer as authoritative; never invent a different answer.
Format as short paragraphs. Use **bold** for key terms and start list items with "- ". Do not use Markdown headings, tables, or backticks.
${conditionalBlock}
${styleBlock}

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
