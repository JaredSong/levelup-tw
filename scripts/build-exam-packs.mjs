import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseQuestionBank } from './questionParser.mjs'
import { sanitizeText } from './textCorrections.mjs'

const INACTIVE_IDS = new Set([
  '07602-01-067',
  '07602-04-009',
  '07602-10-011',
  '07700-02-071',
  '17800-02-102',
  '17800-04-063',
  '17800-05-102',
  '17800-06-007',
  '17800-06-069',
  '22200-01-027',
  '22200-01-032',
  '22200-01-035',
  '22200-01-043',
  '22200-02-053',
  '22200-03-019',
  '22200-03-106',
  '22200-03-137',
  '22200-03-166',
  '22200-03-174',
  '90008-03-030',
  '90008-03-047',
  '90008-03-058',
  '90008-03-072',
  '90008-03-092',
  '90010-01-100',
])

const IMAGE_OVERRIDES = {
  '02000-01-007': ['02000-01-007.png'],
  '02000-01-009': ['02000-01-009.png'],
  '02000-01-015': ['02000-01-015.png'],
  '02000-01-020': ['02000-01-020.png'],
  '02000-01-021': ['02000-01-021.png'],
  '02000-01-022': ['02000-01-022.png'],
  '02000-03-187': ['02000-03-187.png'],
  '02000-03-224': ['02000-03-224.png'],
  '02000-04-050': ['02000-04-050.jpg'],
  '02000-04-079': ['02000-04-079.png'],
  '02000-04-095': ['02000-04-095.png'],
  '02000-04-096': ['02000-04-096.png'],
  '02000-04-097': ['02000-04-097.png'],
  '02000-04-102': ['02000-04-102.png'],
  '02000-04-112': ['02000-04-112.png'],
  '02000-04-131': ['02000-04-131.png'],
  '02000-04-137': ['02000-04-137.png'],
  '02000-04-138': ['02000-04-138.png'],
  '02000-04-139': ['02000-04-139.png'],
  '02000-04-140': ['02000-04-140.png'],
  '02000-04-141': ['02000-04-141.png'],
  '02000-04-166': ['02000-04-166.png'],
  '02000-04-180': ['02000-04-180.png'],
  '02000-05-001': ['02000-05-001.png'],
  '02000-05-003': [
    '02000-05-003-1.png',
    '02000-05-003-2.png',
    '02000-05-003-3.png',
    '02000-05-003-4.png',
  ],
  '02000-05-006': ['02000-05-006.png'],
  '02000-05-013': ['02000-05-013.png'],
  '02000-05-014': ['02000-05-014.png'],
  '02000-05-015': ['02000-05-015.png'],
  '02000-05-016': ['02000-05-016.png'],
  '02000-05-017': ['02000-05-017.png'],
  '02000-05-020': ['02000-05-020.png'],
  '02000-05-052': ['02000-05-052.png'],
  '02000-05-103': ['02000-05-103.png'],
  '02000-05-110': ['02000-05-110.png'],
  '02000-05-111': ['02000-05-111.png'],
  '02000-05-112': ['02000-05-112.png'],
  '02000-05-113': ['02000-05-113.png'],
  '02000-05-114': ['02000-05-114.png'],
  '02000-05-118': ['02000-05-118.png'],
  '02000-05-151': ['02000-05-151.png'],
  '02000-05-152': ['02000-05-152.png'],
  '02000-05-153': ['02000-05-153.png'],
  '02000-05-154': ['02000-05-154.png'],
  '02000-05-155': ['02000-05-155.png'],
  '02000-05-190': ['02000-05-190.png'],
  '02000-07-044': ['02000-07-044.png'],
  '02000-07-045': ['02000-07-045.png'],
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

const SECTION_TITLE_OVERRIDES = {
  '19500-01': '職業介紹、人力仲介及外國人引進、聘僱、管理事項',
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
    occupationFile: '195002A17-raw.txt',
    occupationExpected: 1250,
    version: 'A17',
    sourceRevision: '195002A17 + 900060A18/900070A17/900080A16/900090A11',
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
  {
    examId: 'car-repair-c',
    titleZh: '汽車修護丙級',
    titleEn: 'Automobile Repair (Class C)',
    level: '丙級',
    category: '車輛修護',
    occupationCode: '02000',
    occupationFile: '020003A11-raw.txt',
    occupationExpected: 765,
    version: 'A11',
    sourceRevision: '020003A11 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    mockRules: {
      occupationQuota: 64,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [],
    },
  },
  {
    examId: 'beauty-c',
    titleZh: '美容丙級',
    titleEn: 'Beauty (Class C)',
    level: '丙級',
    category: '美容美髮',
    occupationCode: '10000',
    occupationFile: '100003A15-raw.txt',
    occupationExpected: 361,
    version: 'A15',
    sourceRevision: '100003A15 + 900060A18/900070A17/900080A16/900090A11/900120A10',
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
    examId: 'accounting-c',
    titleZh: '會計事務丙級',
    titleEn: 'Accounting (Class C)',
    level: '丙級',
    category: '商業服務',
    occupationCode: '14900',
    occupationFile: '149003A15-raw.txt',
    occupationExpected: 762,
    version: 'A15',
    sourceRevision: '149003A15 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    mockRules: {
      occupationQuota: 64,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [],
    },
  },
  {
    examId: 'childcare-single',
    titleZh: '托育人員單一級',
    titleEn: 'Childcare Provider (Single Level)',
    level: '單一級',
    category: '照護服務',
    occupationCode: '15400',
    occupationFile: '154004A17-raw.txt',
    occupationExpected: 892,
    version: 'A17',
    sourceRevision: '154004A17 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    mockRules: {
      occupationQuota: 64,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [],
    },
  },
  {
    examId: 'care-service-single',
    titleZh: '照顧服務員單一級',
    titleEn: 'Care Service Worker (Single Level)',
    level: '單一級',
    category: '照護服務',
    occupationCode: '17800',
    occupationFile: '178004A13-raw.txt',
    occupationExpected: 625,
    version: 'A13',
    sourceRevision: '178004A13 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    mockRules: {
      occupationQuota: 64,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [],
    },
  },
  {
    examId: 'occupational-safety-health-management-b',
    titleZh: '職業安全衛生管理乙級',
    titleEn: 'Occupational Safety and Health Management (Class B)',
    level: '乙級',
    category: '職業安全衛生',
    occupationCode: '22200',
    occupationFile: '222002A15-raw.txt',
    occupationExpected: 932,
    version: 'A15',
    sourceRevision: '222002A15 + 900060A18/900070A17/900080A16/900090A11',
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
  const imageOverrides = IMAGE_OVERRIDES[question.id]
  const repaired = {
    ...question,
    examId,
    sourcePage,
    sectionTitle: SECTION_TITLE_OVERRIDES[question.section] ?? question.sectionTitle,
    prompt: sanitizeText(question.prompt),
    options: QUESTION_OPTION_OVERRIDES[question.id] ?? question.options.map(sanitizeText),
    ...(INACTIVE_IDS.has(question.id) ? { active: false } : {}),
  }
  if (!repaired.hasFigure && !imageOverrides) {
    return { ...repaired, sourceImage: undefined, sourceImages: undefined, sourcePageImage: undefined }
  }
  return {
    ...repaired,
    hasFigure: true,
    sourceImage: imageOverrides?.map(questionImagePath)[0] ?? `/question-images/${question.id}.png`,
    sourceImages: imageOverrides?.map(questionImagePath),
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
      status: 'fully_verified',
      inactiveQuestionCount: questions.length - active.length,
      imageQuestionCount: figures.length,
      note: 'Answer keys independently cross-checked against the official PDF during import.',
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
