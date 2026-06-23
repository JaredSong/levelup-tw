const SECTION_PATTERN = /^(\d{5})\s+(.+?)\s+(?:乙級|不分級)\s+工作項目\s+(\d{2})：(.+)$/
const QUESTION_PATTERN = /^(\d+)\.\s*\(([1-4]+)\)\s*(.*)$/
const PAGE_PATTERN = /^@@PAGE:(\d+)@@$/
const OPTION_MARKERS = ['①', '②', '③', '④']

function joinWrappedLines(lines) {
  let output = ''
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const needsSpace = /[A-Za-z0-9]$/.test(output) && /^[A-Za-z0-9]/.test(line)
    output += `${needsSpace ? ' ' : ''}${line}`
  }

  return output
    .replace(/\b([A-Z]{1,3})\s+([A-Z]{1,3})\b/g, '$1$2')
    .replace(/\s+([，。？！；：、])/g, '$1')
    .replace(/([（【「])\s+/g, '$1')
    .replace(/\s+([）】」])/g, '$1')
    .trim()
}

function splitPromptAndOptions(id, content) {
  const positions = OPTION_MARKERS.map((marker) => content.indexOf(marker))
  const present = positions.filter((position) => position >= 0).length
  if (present !== 4) {
    throw new Error(`${id} has ${present} options; expected 4`)
  }
  if (!positions.every((position, index) => index === 0 || position > positions[index - 1])) {
    throw new Error(`${id} has options in an invalid order`)
  }

  const prompt = content.slice(0, positions[0]).trim()
  const options = positions.map((position, index) => {
    const end = index === positions.length - 1 ? content.length : positions[index + 1]
    const text = content.slice(position + 1, end).trim().replace(/[。.]\s*$/, '').trim()
    return text || `圖示選項 ${index + 1}`
  })

  return { prompt, options }
}

export function parseQuestionBank(source) {
  const prepared = source
    .replace(/Page\s+(\d+)\s+of\s+\d+\s*\f/g, (_, page) => `\n@@PAGE:${Number(page) + 1}@@\n`)
    .replace(/\f/g, '\n@@PAGE_BREAK@@\n')

  const questions = []
  let subjectCode = null
  let subjectTitle = null
  let sourceGroup = null
  let section = null
  let sectionTitle = null
  let sourcePage = 1
  let current = null

  const flush = () => {
    if (!current || !section || !sectionTitle) return
    const id = `${subjectCode}-${section}-${String(current.number).padStart(3, '0')}`
    const content = joinWrappedLines(current.lines)
    const { prompt, options } = splitPromptAndOptions(id, content)
    const answers = current.answerKey.split('').map(Number)
    questions.push({
      id,
      subjectCode,
      subjectTitle,
      sourceGroup,
      section: `${subjectCode}-${section}`,
      sectionTitle,
      number: current.number,
      kind: answers.length > 1 ? 'multiple' : 'single',
      prompt,
      options,
      answers,
      sourcePage: current.sourcePage,
      hasFigure: /(如圖|下圖|附圖|下列流程圖|程式片段|下列\s*C\/C\+\+程式|圖示選項)/.test(`${prompt}${options.join('')}`),
    })
    current = null
  }

  for (const rawLine of prepared.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const pageMatch = line.match(PAGE_PATTERN)
    if (pageMatch) {
      sourcePage = Number(pageMatch[1])
      continue
    }

    if (line === '@@PAGE_BREAK@@') {
      sourcePage += 1
      continue
    }

    const sectionMatch = line.match(SECTION_PATTERN)
    if (sectionMatch) {
      flush()
      subjectCode = sectionMatch[1]
      subjectTitle = sectionMatch[2].trim()
      sourceGroup = subjectCode === '17300'
        ? 'occupation'
        : subjectCode === '90011'
          ? 'information-common'
          : 'general-common'
      section = sectionMatch[3]
      sectionTitle = sectionMatch[4].trim()
      continue
    }

    const questionMatch = line.match(QUESTION_PATTERN)
    if (questionMatch) {
      flush()
      current = {
        number: Number(questionMatch[1]),
        answerKey: questionMatch[2],
        sourcePage,
        lines: [questionMatch[3]],
      }
      continue
    }

    if (current) current.lines.push(line)
  }

  flush()
  return questions
}
