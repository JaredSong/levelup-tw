const json = (response, status, body) => {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function buildPrompt(question, selected) {
  const choices = question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')
  return `Explain this Taiwan Web Design Level B written-exam question to a beginner.
Use clear English, but retain important Traditional Chinese technical or legal terms in parentheses.
Explain why the official answer is correct and why the learner's choice is wrong or incomplete.
Treat the supplied official answer as authoritative. Be concise and do not invent a different answer.

Question: ${question.prompt}
Choices:
${choices}
Official answer: ${question.answers.join(', ')}
Learner selected: ${selected.length ? selected.join(', ') : 'none'}`
}

async function explainWithOpenAI(prompt, model) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 500 }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'OpenAI request failed')
  return data.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')?.text
}

async function explainWithAnthropic(prompt, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message ?? 'Anthropic request failed')
  return data.content?.find((item) => item.type === 'text')?.text
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed' })
  const expectedToken = process.env.AI_ACCESS_TOKEN
  if (!expectedToken || request.headers.authorization !== `Bearer ${expectedToken}`) {
    return json(response, 401, { error: 'Invalid access token' })
  }

  const { question, selected = [], provider: requested } = request.body ?? {}
  if (!question?.prompt || !Array.isArray(question.options) || !Array.isArray(question.answers)) {
    return json(response, 400, { error: 'Invalid question' })
  }

  const DEFAULT_MODELS = { openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-latest' }
  // The app can pick a provider per request; otherwise fall back to AI_PROVIDER.
  const candidate = String(requested ?? '').toLowerCase()
  const provider = ['openai', 'anthropic'].includes(candidate)
    ? candidate
    : (process.env.AI_PROVIDER ?? '').toLowerCase()
  if (!['openai', 'anthropic'].includes(provider)) {
    return json(response, 503, { error: 'AI provider is not configured' })
  }
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'
  if (!process.env[keyName]) {
    return json(response, 503, { error: `No API key set for ${provider}. Add ${keyName} to your environment and restart.` })
  }
  const model = (provider === 'openai' ? process.env.OPENAI_MODEL : process.env.ANTHROPIC_MODEL)
    || process.env.AI_MODEL
    || DEFAULT_MODELS[provider]

  try {
    const prompt = buildPrompt(question, selected)
    const explanation = provider === 'openai'
      ? await explainWithOpenAI(prompt, model)
      : await explainWithAnthropic(prompt, model)
    if (!explanation) throw new Error('The provider returned no explanation')
    return json(response, 200, { explanation, provider })
  } catch (error) {
    return json(response, 502, { error: error instanceof Error ? error.message : 'AI request failed' })
  }
}
