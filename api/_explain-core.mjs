// Runtime-agnostic explanation logic shared by API handlers. No req/res coupling:
// callers pass plain data and get back { status, payload }.

const PROVIDERS = ['openai', 'anthropic', 'gemini']
const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.5-flash' }
const KEY_NAMES = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }
const MODEL_ENV = { openai: 'OPENAI_MODEL', anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL' }

const BASE = `You are tutoring a learner for Taiwan's 網頁設計乙級 (Web Design Level B) written exam.
Write the explanation primarily in Traditional Chinese, because the exam is in Chinese. You may add a short English meaning in parentheses after difficult technical terms when it helps, but do not make English the main language. Do NOT add pinyin.
Any memory cue, memory hook, 口訣, or 記憶點 must be written in Traditional Chinese, not English, and must explain the exam trap in plain words.
Format as short paragraphs. Use **bold** for key terms and start list items with "- ". Do not use Markdown headings, tables, or backticks.`

// Per-style length and emphasis. Default stays tight; only Deeper goes option by option.
const STYLE = {
  default: { words: '55-85 words', extra: 'Use exactly 3 short bullets labelled "為什麼:", "規則:", and "記憶點:". The 記憶點 must be a short Traditional Chinese cue that says what to remember for the exam.' },
  simpler: { words: '60-90 words', extra: 'Use very short Traditional Chinese sentences and beginner words; define each technical term simply.' },
  metaphor: { words: '100-140 words', extra: 'Open with a vivid everyday analogy in Traditional Chinese, then the rule and the correct answer. Skip the analogy for legal, numerical, or precise-definition items where it could mislead.' },
  deeper: { words: '180-250 words', extra: 'Also go through each option in Traditional Chinese, explaining why the wrong ones are wrong, and add the underlying concept plus at most two closely related facts.' },
  cue: { words: '35-55 words', extra: 'Write exactly two short bullets labelled "答案:" and "記憶點:". The 記憶點 must be Traditional Chinese, compact, and useful for recall-card study.' },
  commute: { words: '90-130 words', extra: '' },
}

// Reading mode is translation-only and never sees or reveals the answer.
const READING = `Explain the question only — reading help. Do NOT reveal, hint at, or eliminate any option, and do not say which answer is correct.
- Restate the question stem in plain Traditional Chinese. Add short English meanings in parentheses only for difficult technical terms.
- If the stem has a negation or odd-one-out phrase (不正確, 不包括, 何者為非, 不屬於, 下列何者錯誤, etc.), flag it clearly in Traditional Chinese and explain the task is to find the false or excluded item.
- Give a one-line Traditional Chinese gloss of each option without judging it.
Keep it to about 60-100 words.`

function buildPrompt(question, selected, style) {
  const formatOption = (option, index) => {
    const code = question.optionCodeBlocks?.[index]
    return code ? `${index + 1}. ${option}\n${code}` : `${index + 1}. ${option}`
  }
  const choices = question.options.map(formatOption).join('\n')
  const codeContext = question.codeBlock ? `\nCode:\n${question.codeBlock}` : ''
  const numbering = 'Use the option numbers exactly as listed in Choices below. Do not refer to any other ordering.'
  const formatRefs = (values) => values.length
    ? values.map((value) => {
      const option = question.options[value - 1] ?? '(missing option text)'
      const code = question.optionCodeBlocks?.[value - 1]
      return code ? `${value}. ${option}\n${code}` : `${value}. ${option}`
    }).join('\n')
    : 'none'
  const officialRefs = formatRefs(question.answers)
  const selectedRefs = formatRefs(selected)

  if (style === 'reading') {
    return `${BASE}

${READING}
${numbering}

Question: ${question.prompt}
${codeContext}
Choices:
${choices}`
  }

  if (style === 'cue') {
    return `${BASE}
Treat the supplied official answer as authoritative; never invent or override it.
Create a recall-card back side, not a full explanation.
Keep the whole answer to about ${STYLE.cue.words}. ${STYLE.cue.extra}
${numbering}

Question: ${question.prompt}
${codeContext}
Choices:
${choices}
Official answer:
${officialRefs}`
  }

  if (style === 'commute') {
    return `${BASE}
Treat the supplied official answer as authoritative; never invent or override it.
Write ONE short spoken study note in Traditional Chinese for a learner reviewing a wrong answer on their commute.
${numbering}
Write in clear, natural spoken Chinese — flowing sentences, no bullets, headings, tables, or speaker labels, so it sounds good read aloud. Keep it to about ${STYLE.commute.words}.
Say, conversationally and briefly:
- what the question is really asking,
- which option text is correct and the simple reason it is right,
- why the learner's choice is wrong if it was wrong,
- one Chinese 記憶點 that locks in the trap.
Do NOT add an English memory hook. Do NOT use pinyin. Refer to options by their number only when needed. Do not read out every choice. If there is a figure, tell the learner what visual cue to remember without inventing details.

Question: ${question.prompt}
${codeContext}
Choices:
${choices}
Correct answer:
${officialRefs}
Learner selected:
${selectedRefs}`
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
- one short 記憶點 in Traditional Chinese.`
    : `Cover only, concisely:
- the correct answer and the rule behind it,
- focus on the learner's selected option(s): why that selection is wrong, or why it is right if correct,
${isMultiple ? '- which options are required, and any the learner missed or wrongly added,\n' : ''}
- one short 記憶點 in Traditional Chinese.
Do not analyse unselected options unless they are needed to explain the learner's mistake or the learner asked to go deeper.`

  const extraLine = variant.extra ? `\n${variant.extra}` : ''

  return `${BASE}
Treat the supplied official answer as authoritative; never invent or override it.
${numbering}

${cover}
Keep the whole answer to about ${variant.words}.${extraLine}

Question: ${question.prompt}
${codeContext}
Choices:
${choices}
Correct answer:
${officialRefs}
Learner selected:
${selectedRefs}`
}

// Token caps sized to each style's word limit, so calls are short and cheap.
const STYLE_TOKENS = { default: 180, simpler: 220, metaphor: 300, deeper: 540, reading: 240, cue: 160, commute: 240 }
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
