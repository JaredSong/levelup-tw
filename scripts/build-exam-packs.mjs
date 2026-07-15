import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseQuestionBank } from './questionParser.mjs'
import { sanitizeText } from './textCorrections.mjs'

const INACTIVE_IDS = new Set([
  '07602-01-067',
  '07602-04-009',
  '07602-10-011',
  '07700-02-071',
  '90008-03-030',
  '90008-03-047',
  '90008-03-058',
  '90008-03-072',
  '90008-03-092',
  '90010-01-100',
])

const IMAGE_OVERRIDES = {
  '90008-03-013': [
    '90008-page-2 13-1.png',
    '90008-page-2 13-2.png',
    '90008-page-2 13-3.png',
    '90008-page-2 13-4.png',
  ],
  '90009-04-002': [
    '90009-page-2 2-1.png',
    '90009-page-2 2-2.png',
    '90009-page-2 2-3.png',
    '90009-page-2 2-4.png',
  ],
  '90009-04-069': ['90009-page-7.png'],
  '90009-04-086': ['90009-04-086.png'],
  '07700-03-003': [
    '07700-03-003-1.png',
    '07700-03-003-2.png',
    '07700-03-003-3.png',
    '07700-03-003-4.png',
  ],
}

const SOURCE_PAGE_OVERRIDES = {
  '90009-04-069': 7,
  '90009-04-086': 8,
}

const QUESTION_OPTION_OVERRIDES = {
  '11800-03-054': ['Windows 鍵+Ctrl+右方向鍵', 'Windows 鍵+Ctrl+下方向鍵', 'Windows 鍵+Ctrl+L', 'Windows 鍵+Ctrl+R'],
  '11800-03-056': ['Windows 鍵+Ctrl+D', 'Windows 鍵+Ctrl+A', 'Windows 鍵+Ctrl+C', 'Windows 鍵+Ctrl+L'],
  '11800-03-071': ['Windows 鍵+Ctrl+F1', 'Windows 鍵+Ctrl+F4', 'Windows 鍵+Ctrl+F8', 'Windows 鍵+Ctrl+F9'],
  '11800-03-078': ['Windows 鍵+Tab', 'Windows 鍵+Ctrl', 'Windows 鍵+Alt', 'Windows 鍵+Shift'],
}

const NO_SOURCE_PAGE_IMAGE = new Set(['07700-03-003'])

const GENERAL_COMMON_BANKS = [
  { code: '90006', file: '900060A18-raw.txt', expected: 100, version: 'A18' },
  { code: '90007', file: '900070A17-raw.txt', expected: 100, version: 'A17' },
  { code: '90008', file: '900080A16-raw.txt', expected: 100, version: 'A16' },
  { code: '90009', file: '900090A11-latest-raw.txt', expected: 100, version: 'A11' },
]

const EXAMS = [
  {
    examId: 'man-haircut-c',
    titleZh: '男子理髮丙級',
    titleEn: 'Men Haircutting (Class C)',
    level: '丙級',
    category: '美容美髮',
    occupationCode: '06000',
    occupationFile: '060003A12-raw.txt',
    occupationExpected: 439,
    version: 'A12',
    sourceRevision: '060003A12 + 900060A18/900070A17/900080A16/900090A11/900120A10',
    extraCommonCodes: ['90012'],
    mockRules: {
      occupationQuota: 60,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90012', count: 4 }],
    },
  },
  {
    examId: 'women-hairdressing-c',
    titleZh: '女子美髮丙級',
    titleEn: 'Women Hairdressing (Class C)',
    level: '丙級',
    category: '美容美髮',
    occupationCode: '06700',
    occupationFile: '067003A13-raw.txt',
    occupationExpected: 608,
    version: 'A13',
    sourceRevision: '067003A13 + 900060A18/900070A17/900080A16/900090A11/900120A10',
    extraCommonCodes: ['90012'],
    mockRules: {
      occupationQuota: 60,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90012', count: 4 }],
    },
  },
  {
    examId: 'employment-service-b',
    titleZh: '就業服務乙級',
    titleEn: 'Employment Service (Class B)',
    level: '乙級',
    category: '商業服務',
    occupationCode: '19500',
    occupationFile: '195002A19-raw.txt',
    occupationExpected: 1214,
    version: 'A19',
    sourceRevision: '195002A19 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    mockRules: {
      occupationQuota: 64,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [],
    },
  },
  {
    examId: 'computer-software-application-c',
    titleZh: '電腦軟體應用丙級',
    titleEn: 'Computer Software Application (Class C)',
    level: '丙級',
    category: '資訊',
    occupationCode: '11800',
    occupationFile: '118003A14-raw.txt',
    occupationExpected: 748,
    version: 'A14',
    sourceRevision: '118003A14 + 900110A10 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90011'],
    mockRules: {
      occupationQuota: 60,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90011', count: 4 }],
    },
  },
  {
    examId: 'chinese-cooking-meat-c',
    titleZh: '中餐烹調－葷食丙級',
    titleEn: 'Chinese Cuisine - Meat (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '07602',
    occupationFile: '076023A13-raw.txt',
    occupationExpected: 640,
    version: 'A13',
    sourceRevision: '076023A13 + 900100A16 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90010'],
    mockRules: {
      occupationQuota: 60,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 4 }],
    },
  },
  {
    examId: 'baking-food-c',
    titleZh: '烘焙食品丙級',
    titleEn: 'Baking Food (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '07700',
    occupationFile: '077003A12-raw.txt',
    occupationExpected: 513,
    version: 'A12',
    sourceRevision: '077003A12 + 900100A16 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90010'],
    mockRules: {
      occupationQuota: 60,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 4 }],
    },
  },
]

const BEAUTY_HAIR_COMMON_BANK = {
  code: '90012',
  file: '900120A10-raw.txt',
  expected: 300,
  version: 'A10',
  quota: 4,
}

const FOOD_COMMON_BANK = {
  code: '90010',
  file: '900100A16-raw.txt',
  expected: 281,
  version: 'A16',
  quota: 4,
}

const INFORMATION_COMMON_BANK = {
  code: '90011',
  file: '900110A10-raw.txt',
  expected: 119,
  version: 'A10',
  quota: 4,
}

const OFFICIAL_LINKS = {
  registration: 'https://skill.tcte.edu.tw/notice.php',
  scoreLookup: 'https://eservice.wdasec.gov.tw/',
  handbook: 'https://skill.tcte.edu.tw/download.php',
  questionBank: 'https://techbank.wdasec.gov.tw/',
}

function questionImagePath(fileName) {
  return `/question-images/${encodeURIComponent(fileName)}`
}

function sourcePageImageFor(question) {
  if (!question.hasFigure || NO_SOURCE_PAGE_IMAGE.has(question.id)) return undefined
  return `/question-pages/${question.subjectCode}-page-${question.sourcePage}.jpg`
}

async function loadParsed(bank) {
  const source = await readFile(new URL(`../source/${bank.file}`, import.meta.url), 'utf8')
  const parsed = parseQuestionBank(source)
  if (parsed.length !== bank.expected) {
    throw new Error(`${bank.code}: expected ${bank.expected} questions, received ${parsed.length}`)
  }
  return parsed
}

function normalizeQuestion(question, examId) {
  const sourcePage = SOURCE_PAGE_OVERRIDES[question.id] ?? question.sourcePage
  const repaired = {
    ...question,
    examId,
    sourcePage,
    prompt: sanitizeText(question.prompt),
    options: QUESTION_OPTION_OVERRIDES[question.id] ?? question.options.map(sanitizeText),
    ...(INACTIVE_IDS.has(question.id) ? { active: false } : {}),
  }
  if (!repaired.hasFigure) {
    return { ...repaired, sourceImage: undefined, sourceImages: undefined, sourcePageImage: undefined }
  }
  return {
    ...repaired,
    sourceImage: IMAGE_OVERRIDES[question.id]?.map(questionImagePath)[0] ?? `/question-images/${question.id}.png`,
    sourceImages: IMAGE_OVERRIDES[question.id]?.map(questionImagePath),
    sourcePageImage: sourcePageImageFor(repaired),
  }
}

function buildSections(questions) {
  const sections = new Map()
  for (const question of questions) {
    const existing = sections.get(question.section) ?? {
      id: question.section,
      subjectCode: question.subjectCode,
      sourceGroup: question.sourceGroup,
      titleZh: question.sectionTitle ?? question.section,
      questionCount: 0,
      activeQuestionCount: 0,
    }
    existing.questionCount += 1
    if (question.active !== false) existing.activeQuestionCount += 1
    sections.set(question.section, existing)
  }
  return [...sections.values()]
}

function buildMockRules(exam) {
  return {
    totalQuestions: 80,
    singleCount: exam.mockRules.singleCount,
    multipleCount: exam.mockRules.multipleCount,
    durationMinutes: 100,
    passScore: 60,
    maxScore: 100,
    weightSingle: exam.mockRules.weightSingle,
    weightMultiple: exam.mockRules.weightMultiple,
    subjectQuota: [
      { subjectCode: exam.occupationCode, count: exam.mockRules.occupationQuota },
      ...exam.mockRules.extraSubjectQuota,
      ...GENERAL_COMMON_BANKS.map((bank) => ({ subjectCode: bank.code, count: 4 })),
    ],
  }
}

async function writeExamPack(exam, commonQuestions, extraQuestionsByCode) {
  const occupation = await loadParsed({ code: exam.occupationCode, file: exam.occupationFile, expected: exam.occupationExpected })
  const extraQuestions = (exam.extraCommonCodes ?? []).flatMap((code) => extraQuestionsByCode.get(code) ?? [])
  const questions = [...occupation, ...extraQuestions, ...commonQuestions]
    .map((question) => normalizeQuestion(question, exam.examId))
  const active = questions.filter((question) => question.active !== false)
  const figures = active.filter((question) => question.hasFigure)
  const manifest = {
    examId: exam.examId,
    level: exam.level,
    titleZh: exam.titleZh,
    titleEn: exam.titleEn,
    category: exam.category,
    version: exam.version,
    sourceUrl: 'https://techbank.wdasec.gov.tw/',
    officialLinks: OFFICIAL_LINKS,
    sourceRevision: exam.sourceRevision,
    questionCount: questions.length,
    activeQuestionCount: active.length,
    sections: buildSections(questions),
    mockRules: buildMockRules(exam),
    integrity: {
      status: 'unchecked',
      inactiveQuestionCount: questions.length - active.length,
      imageQuestionCount: figures.length,
      note: 'Official PDFs parsed locally; answer keys should be spot-checked before public release.',
    },
  }

  const examDir = new URL(`../public/data/exams/${exam.examId}/`, import.meta.url)
  await mkdir(examDir, { recursive: true })
  await writeFile(new URL('questions.json', examDir), `${JSON.stringify(questions)}\n`)
  await writeFile(new URL('manifest.json', examDir), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

async function main() {
  const commonQuestions = (await Promise.all(GENERAL_COMMON_BANKS.map(loadParsed))).flat()
  const extraQuestionsByCode = new Map([
    [BEAUTY_HAIR_COMMON_BANK.code, await loadParsed(BEAUTY_HAIR_COMMON_BANK)],
    [FOOD_COMMON_BANK.code, await loadParsed(FOOD_COMMON_BANK)],
    [INFORMATION_COMMON_BANK.code, await loadParsed(INFORMATION_COMMON_BANK)],
  ])
  const manifests = []
  for (const exam of EXAMS) manifests.push(await writeExamPack(exam, commonQuestions, extraQuestionsByCode))

  const webQuestions = await readFile(new URL('../source/questions.json', import.meta.url), 'utf8')
  await mkdir(new URL('../public/data/exams/web-design-b/', import.meta.url), { recursive: true })
  await writeFile(new URL('../public/data/exams/web-design-b/questions.json', import.meta.url), webQuestions)

  const generated = `import type { ExamManifest } from '../core/exam'\n\nexport const GENERATED_EXAM_MANIFESTS = ${JSON.stringify(manifests, null, 2)} as ExamManifest[]\n`
  await writeFile(new URL('../src/app/generatedExamManifests.ts', import.meta.url), generated)

  console.log(JSON.stringify(manifests.map((manifest) => ({
    examId: manifest.examId,
    total: manifest.questionCount,
    active: manifest.activeQuestionCount,
    figures: manifest.integrity.imageQuestionCount,
    sections: manifest.sections.length,
  }))))
}

await main()
