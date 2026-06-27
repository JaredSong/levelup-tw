import { access, mkdir, readFile, writeFile } from 'node:fs/promises'

const questions = JSON.parse(
  await readFile(new URL('../public/data/questions.json', import.meta.url), 'utf8'),
)

const imageQuestions = questions
  .filter((question) => question.active !== false && question.hasFigure)
  .sort((a, b) => a.id.localeCompare(b.id))

const generatedAt = new Date().toISOString()
const lines = [
  '# Image Question Map',
  '',
  `Generated: ${generatedAt}`,
  '',
  'These are the questions that currently need a figure, graph, code screenshot, or image-option reference.',
  '',
  'Replacement workflow:',
  '1. Crop or redraw only the figure/code/options needed for the question.',
  '2. Save it as PNG with the exact filename shown below.',
  '3. Put it in `public/question-images/`.',
  '4. Refresh the app. The app tries that crop first and falls back to the masked official page if the PNG is missing.',
  '',
  'Do not include the official answer-key column in replacement images.',
  '',
  `Total active image questions: ${imageQuestions.length}`,
  '',
]

async function fileExists(path) {
  try {
    await access(new URL(`../public${decodeURI(path)}`, import.meta.url))
    return true
  } catch {
    return false
  }
}

for (const question of imageQuestions) {
  const answer = question.answers.join(',')
  const linkedImages = question.sourceImages?.length ? question.sourceImages : question.sourceImage ? [question.sourceImage] : []
  const existingLinkedImages = []
  for (const image of linkedImages) {
    if (await fileExists(image)) existingLinkedImages.push(image)
  }
  lines.push(`## ${question.id}`)
  lines.push('')
  lines.push(`- Replacement PNG: \`public/question-images/${question.id}.png\``)
  lines.push(`- App path: \`/question-images/${question.id}.png\``)
  if (existingLinkedImages.length) {
    lines.push(`- Linked uploaded image${existingLinkedImages.length > 1 ? 's' : ''}:`)
    existingLinkedImages.forEach((image) => lines.push(`  - \`${image}\``))
  } else {
    lines.push('- Linked uploaded images: none yet')
  }
  lines.push(`- Current fallback page: \`${question.sourcePageImage ?? question.sourceImage ?? ''}\``)
  lines.push(`- Kind: ${question.kind}`)
  lines.push(`- Official answer: ${answer}`)
  lines.push(`- Prompt: ${question.prompt}`)
  lines.push('- Options:')
  question.options.forEach((option, index) => {
    lines.push(`  - ${index + 1}. ${option}`)
  })
  lines.push('')
}

await mkdir(new URL('../docs', import.meta.url), { recursive: true })
await writeFile(new URL('../docs/image-question-map.md', import.meta.url), `${lines.join('\n')}\n`)
console.log(JSON.stringify({ imageQuestions: imageQuestions.length, output: 'docs/image-question-map.md' }, null, 2))
