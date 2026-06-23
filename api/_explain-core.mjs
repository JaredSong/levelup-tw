// Runtime-agnostic explanation logic shared by the Vite dev handler,
// the Vercel-style handler, and the Netlify function. No req/res coupling:
// callers pass plain data and get back { status, payload }.

const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-latest' }

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
Treat the supplied official answer as authoritative. Be concise and do not invent a different answer.${styleNote}

Question: ${question.prompt}
Choices:
${choices}
Official answer: ${question.answers.join(', ')}
Learner selected: ${selected.length ? selected.join(', ') : 'none'}`
}

async function explainWithOpenAI(prompt, model, env) {
  const response = await fetch('https://api.openai.com/v1/responses', {
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
  const provider = ['openai', 'anthropic'].includes(candidate)
    ? candidate
    : (env.AI_PROVIDER ?? '').toLowerCase()
  if (!['openai', 'anthropic'].includes(provider)) {
    return { status: 503, payload: { error: 'AI provider is not configured' } }
  }
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'
  if (!env[keyName]) {
    return { status: 503, payload: { error: `No API key set for ${provider}. Add ${keyName} to your environment.` } }
  }
  const model = (provider === 'openai' ? env.OPENAI_MODEL : env.ANTHROPIC_MODEL)
    || env.AI_MODEL
    || DEFAULT_MODELS[provider]

  try {
    const prompt = buildPrompt(question, selected, String(style ?? '').toLowerCase())
    const explanation = provider === 'openai'
      ? await explainWithOpenAI(prompt, model, env)
      : await explainWithAnthropic(prompt, model, env)
    if (!explanation) throw new Error('The provider returned no explanation')
    return { status: 200, payload: { explanation, provider } }
  } catch (error) {
    return { status: 502, payload: { error: error instanceof Error ? error.message : 'AI request failed' } }
  }
}
