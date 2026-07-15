import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseQuestionBank } from './questionParser.mjs'
import { sanitizeText } from './textCorrections.mjs'

const EXAM_ID = 'web-design-b'
const EXAM_TITLE_ZH = '網頁設計乙級'

// Questions the official 900080A16 (rev V115041316) marks 本題刪題 (deleted).
// Kept as source records for provenance but flagged inactive so they are
// excluded from queues, mocks, readiness, and active counts.
const INACTIVE_IDS = new Set([
  '90008-03-030',
  '90008-03-047',
  '90008-03-058',
  '90008-03-072',
  '90008-03-092',
])

// A few official PDF questions contain angle-bracket/code fragments that are
// dropped by text extraction. Keep these repairs at import time so generated
// data stays reproducible.
const QUESTION_OVERRIDES = {
  '17300-02-150': {
    options: [
      '以<%@符號開頭，以 %>結尾',
      '以<body符號開頭，以 /body>結尾',
      '以<?php符號開頭，以 ?>結尾',
      '以<html符號開頭，以 /html>結尾',
    ],
  },
  '17300-02-156': {
    prompt: 'PHP 程式「$x="Hello"; $y="World"; echo $x+$y;」其輸出為何？',
  },
  '17300-02-003': {
    options: ['REMOVE TABLE Books', 'DROP TABLE Books', 'DELETE TABLE Books', 'ALTER TABLE Books'],
    hasFigure: false,
  },
  '17300-02-043': {
    options: [
      'header("Content-type:image/png");',
      'header("Meta http-equiv=html/png");',
      'header("image-type:html/image");',
      'header("Http-content:png/bin");',
    ],
    hasFigure: false,
  },
  '17300-02-045': {
    options: [
      'mysql_query("SET NAMES \'BIG5\'");',
      'mysql_codec("BIG5");',
      'mysql_set_var("CharacterSet","BIG5")',
      'mysql_set_var("BIG5")',
    ],
    hasFigure: false,
  },
  '17300-02-091': {
    options: ['&', '.', '?', '#'],
    hasFigure: false,
  },
  '17300-02-236': {
    prompt: 'JavaScript 程式「<Script>document.write(9 >> 2);</Script>」執行結果為何？',
  },
  '17300-02-237': {
    prompt: 'HTML 語法「<body link="#0000FF" vlink="#FF0000" alink="#FFFF00">」，其功能表示尚未點選超連結過的物件顏色為何？',
  },
  '17300-02-238': {
    prompt: 'HTML 語法標籤 <frameset> 其作用為何？',
  },
  '17300-02-253': {
    prompt: '關於 PHP 程式『<?php phpinfo(); ?>』的意義為何？',
  },
  '17300-02-273': {
    prompt: '在 XHTML 中，<form> 標籤的屬性何者用來指定接收表單資料之伺服器端的程式？',
  },
  '17300-02-157': {
    prompt: 'PHP 程式「echo "\\"escaped character\\"";」其輸出為何？',
    options: ['""escaped character""', '"escaped character"', '\\escaped character\\', 'escaped character'],
    hasFigure: false,
  },
  '17300-02-158': {
    prompt: "PHP 程式「$a='abcdefg'; echo strlen($a);」其輸出為何？",
    options: ['strlen($a)', 'abcdefg', '7', "'abcdefg'"],
    hasFigure: false,
  },
  '17300-02-205': {
    options: ['<HEAD>...</HEAD>', '<P>...</P>', '<BODY>...</BODY>', '<TITLE>...</TITLE>'],
    hasFigure: false,
  },
  '17300-02-227': {
    options: ['<style>', '<img>', '<link>', '<p>'],
    hasFigure: false,
  },
  '17300-02-229': {
    options: ['<href>', '<hr>', '<a>', '<src>'],
    hasFigure: false,
  },
  '17300-02-252': {
    options: ['<!-- -->', '<? ?>', '<?php ?>', '<script language="php"> </script>'],
    hasFigure: false,
  },
  '17300-02-256': {
    options: ['<h1>標題一</h1>', '<H1>標題一</H1>', '< h1 >標題一</ h1 >', '<H1>標題一</h1>'],
    hasFigure: false,
  },
  '17300-02-257': {
    options: ['<body backgroundcolor="yellow">', '<body color="yellow">', '<body bgcolor="yellow">', '<body bg="yellow">'],
    hasFigure: false,
  },
  '17300-02-258': {
    options: ['<body backgroundimage="bg.jpg">', '<body background="bg.jpg">', '<body bgimage="bg.jpg">', '<body image="bg.jpg">'],
    hasFigure: false,
  },
  '17300-02-259': {
    options: ['<body color="blue">', '<body text="color">', '<font color="blue">', '<font text="color">'],
    hasFigure: false,
  },
  '17300-02-261': {
    options: ['/* */', '//', '#', '<!-- -->'],
    hasFigure: false,
  },
  '17300-02-262': {
    prompt: '何者最不適合置於 HTML 的 <head> 標籤之中？',
    options: ['<marquee>', '<style>', '<link>', '<base>'],
    hasFigure: false,
  },
  '17300-02-263': {
    prompt: '關於 HTML 的 <head> 標籤中，欲設定超連結之基準位址的標籤為何？',
    options: ['<link>', '<url>', '<base>', '<style>'],
    hasFigure: false,
  },
  '17300-02-264': {
    options: ['<?xml.....?>', '<?xml-stylesheet.....?>', '<!DOCTYPE.....>', '<![CDATA[.....]]>'],
    hasFigure: false,
  },
  '17300-02-267': {
    options: ['<b>', '<u>', '<i>', '<p>'],
    hasFigure: false,
  },
  '17300-02-268': {
    options: ['<p>', '<img>', '<br>', '<hr>'],
    hasFigure: false,
  },
  '17300-02-269': {
    options: ['<div>', '<span>', '<xmp>', '<pre>'],
    hasFigure: false,
  },
  '17300-02-270': {
    options: ['<div>', '<span>', '<xmp>', '<pre>'],
    hasFigure: false,
  },
  '17300-02-271': {
    options: [
      '<img src="logo.gif" href="test.htm" />',
      '<img src="test.htm" href="logo.gif" />',
      '<img src="logo.gif"><a href="test.htm"></a></img>',
      '<a href="test.htm"><img src="logo.gif" /></a>',
    ],
    hasFigure: false,
  },
  '17300-02-272': {
    options: ['<title>', '<head>', '<caption>', '<th>'],
    hasFigure: false,
  },
  '17300-02-274': {
    options: ['<head>', '<title>', '<body>', '<style>'],
    hasFigure: false,
  },
  '17300-02-284': {
    options: ['<%...%>', '<?...?>', '<!...!>', '<?jsp...?>'],
    hasFigure: false,
  },
  '17300-02-285': {
    options: [
      "UPDATE Product SET Price=30 WHERE Pcode='005';",
      'UPDATE Product SET Price=30 WHERE Price=25;',
      'UPDATE Product SET Price=30;',
      "UPDATE Product SET Price=30 WHERE Pcode='005' AND Price=25;",
    ],
    hasFigure: false,
  },
  '17300-02-303': {
    options: ["echo('Hello, world!');", 'echo “Hello, world!”;', "print 'Hello, world!'", 'print “Hello, world!”;'],
    hasFigure: false,
  },
  '17300-02-307': {
    options: ['//css comment', '/*css comment*/', '<!--css comment-->', '<comment>css commont</comment>'],
    hasFigure: false,
  },
  '17300-02-383': {
    options: ['<b>', '<i>', '<href>', '<hr>'],
    hasFigure: false,
  },
  '17300-02-397': {
    options: ['color=rgb(128,196,255)', 'color="#0000FF"', 'color="green"', 'color="#FF0"'],
    hasFigure: false,
  },
  '17300-02-400': {
    options: ['<table>', '<th>', '<tr>', '<tt>'],
    hasFigure: false,
  },
  '17300-02-401': {
    options: [
      '<frameset cols="2:3">...</frameset>',
      '<frameset cols="40%,*">...</frameset>',
      '<frameset cols="200,*">...</frameset>',
      '<frameset cols="2*,3*">...</frameset>',
    ],
    hasFigure: false,
  },
  '90009-04-086': {
    sourcePage: 8,
  },
  '90009-04-069': {
    sourcePage: 7,
  },
  '90011-04-019': {
    sourcePage: 8,
  },
  '90011-04-004': {
    sourcePage: 6,
  },
}

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
  '90011-04-001': ['90011-page-5 1.png'],
  '90011-04-002': ['90011-page-5 2.png'],
  '90011-04-003': ['90011-page-6 3.png'],
  '90011-04-004': [
    '90011-page-6 4.png',
    '90011-page-6 4-1.png',
    '90011-page-6 4-2.png',
    '90011-page-6 4-3.png',
    '90011-page-6 4-4.png',
  ],
  '90011-04-005': ['90011-page-6 5.png'],
  '90011-04-009': ['90011-page-7 9.png'],
  '90011-04-013': ['90011-page-7 13.png'],
  '90011-04-014': ['90011-page-7 14.png'],
  '90011-04-015': ['90011-page-7 15.png'],
  '90011-04-016': ['90011-page-7 16.png'],
  '90011-04-017': ['90011-page-7 17.png'],
  '90011-04-018': ['90011-page-7 18.png'],
  '90011-04-019': ['90011-page-8 19.png'],
  '90011-04-020': ['90011-page-8 20.png'],
}

const CODE_BLOCK_OVERRIDES = {
  '90011-04-004': {
    optionCodeBlocks: [
      'X>3? cout<<B:cout<<A;\nX=X+1',
      'if (X>3) cout<<A; else cout<<B;\nX=X+1;',
      'switch(X) {\n  case 1: cout<<A;\n  case 2: cout<<A;\n  case 3: cout<<A;\n  default: cout<<B;',
      'while (X>3) cout<<A;\ncout<<B;\nX=X+1;',
    ],
  },
  '90011-04-005': {
    codeBlock: 'int a,b,c;\ncin>>a;\ncin>>b;\nc=a;\nif(b>c)\n    c=b;\ncout<<"the output is:"<<c;',
  },
  '90011-04-009': {
    codeBlock: 'While (sum <= 1000)\n    sum = sum + 30;',
  },
  '90011-04-013': {
    codeBlock: 'int x = 3;\nint a[] = {1,2,3,4};\nint *z;\nz = a;\nz = z + x;\ncout << *z << "\\n";',
  },
  '90011-04-014': {
    codeBlock: 'int x = 3;\nint a[] = {1,2,3,4};\nint * z;\nz = &x;\ncout << *z << "\\n";',
  },
  '90011-04-015': {
    codeBlock: 'int y = !(12 < 5 || 3 <= 5 && 3 > x) ? 7 : 9;',
  },
  '90011-04-016': {
    codeBlock: "int x;\nx = (5 <= 3 && 'A' < 'F') ? 3 : 4",
  },
  '90011-04-017': {
    codeBlock: 'int a=0, b=0, c=0;\nint x=(a<b+4);',
  },
  '90011-04-018': {
    codeBlock: 'int f(int x, int y) {\n    if(x == y) return 0;\n    else return f(x-1, y) + 1;\n}',
  },
  '90011-04-019': {
    codeBlock: 'for (i=0;i<=m-1;i++){\n    for (j=0;j<=p-1;j++){\n        c[i][j]=0;\n        for (k=0;k<=n-1;k++){\n            c[i][j]=c[i][j]+a[i][k]*b[k][j];\n        }\n    }\n}',
  },
  '90011-04-020': {
    codeBlock: 'x1=2;y1=4;\nx2=6;y2=8;\na=y2-y1;\nb=x2-x1;\nc=-a*x1+b*y1;\ncout<<a<<"x+"<<-b<<"y+"<<c<<"=0";',
  },
}

const outputPath = new URL('../source/questions.json', import.meta.url)
const manifestPath = new URL(`../public/data/exams/${EXAM_ID}/manifest.json`, import.meta.url)
const OFFICIAL_LINKS = {
  registration: 'https://skill.tcte.edu.tw/notice.php',
  scoreLookup: 'https://eservice.wdasec.gov.tw/',
  handbook: 'https://skill.tcte.edu.tw/download.php',
  questionBank: 'https://techbank.wdasec.gov.tw/',
}
const banks = [
  { code: '17300', file: '173002A13-raw.txt', expected: 846 },
  { code: '90011', file: '900110A10-raw.txt', expected: 119 },
  { code: '90006', file: '900060A18-raw.txt', expected: 100 },
  { code: '90007', file: '900070A17-raw.txt', expected: 100 },
  { code: '90008', file: '900080A16-raw.txt', expected: 100 },
  { code: '90009', file: '900090A11-latest-raw.txt', expected: 100 },
]

function sourcePageImageFor(question) {
  if (!question.hasFigure) return undefined
  if (question.subjectCode === '17300') return `/question-pages/page-${String(question.sourcePage).padStart(2, '0')}.jpg`
  return `/question-pages/${question.subjectCode}-page-${question.sourcePage}.jpg`
}

function questionImagePath(fileName) {
  return `/question-images/${encodeURIComponent(fileName)}`
}

const questions = []
const bankCounts = {}
for (const bank of banks) {
  const source = await readFile(new URL(`../source/${bank.file}`, import.meta.url), 'utf8')
  const parsed = parseQuestionBank(source)
  if (parsed.length !== bank.expected) {
    throw new Error(`${bank.code}: expected ${bank.expected} questions, received ${parsed.length}`)
  }
  bankCounts[bank.code] = parsed.length
  questions.push(...parsed.map((question) => {
    const override = QUESTION_OVERRIDES[question.id]
    const codeOverride = CODE_BLOCK_OVERRIDES[question.id]
    const hasCodeBlock = !!codeOverride?.codeBlock
    const hasFigure = override?.hasFigure ?? (hasCodeBlock ? false : question.hasFigure)
    const sourcePage = override?.sourcePage ?? question.sourcePage
    const imageOverrides = IMAGE_OVERRIDES[question.id]
    const figureImages = hasFigure
      ? codeOverride?.optionCodeBlocks
        ? imageOverrides?.slice(0, 1).map(questionImagePath)
        : imageOverrides?.map(questionImagePath)
      : undefined
    const repaired = {
      ...question,
      examId: EXAM_ID,
      hasFigure,
      ...(codeOverride?.codeBlock ? { codeBlock: codeOverride.codeBlock } : {}),
      ...(codeOverride?.optionCodeBlocks ? { optionCodeBlocks: codeOverride.optionCodeBlocks } : {}),
      sourcePage,
      prompt: sanitizeText(override?.prompt ?? question.prompt),
      options: (override?.options ?? question.options).map(sanitizeText),
      ...(INACTIVE_IDS.has(question.id) ? { active: false } : {}),
      sourceImage: hasFigure
        ? figureImages?.[0] ?? `/question-images/${question.id}.png`
        : undefined,
      sourceImages: figureImages,
    }
    return {
      ...repaired,
      sourcePageImage: sourcePageImageFor(repaired),
    }
  }))
}

const expected = { '17300-01': 242, '17300-02': 405, '17300-03': 124, '17300-04': 75 }
const counts = Object.fromEntries(
  Object.keys(expected).map((section) => [
    section,
    questions.filter((question) => question.section === section).length,
  ]),
)

if (questions.length !== 1365) {
  throw new Error(`Expected 1365 questions, received ${questions.length}`)
}

for (const [section, count] of Object.entries(expected)) {
  if (counts[section] !== count) {
    throw new Error(`Section ${section}: expected ${count}, received ${counts[section]}`)
  }
}

await writeFile(outputPath, `${JSON.stringify(questions)}\n`)
await mkdir(new URL('.', manifestPath), { recursive: true })
await writeFile(manifestPath, `${JSON.stringify({
  examId: EXAM_ID,
  level: '乙級',
  titleZh: EXAM_TITLE_ZH,
  titleEn: 'Web Design (Class B)',
  category: '資訊',
  version: 'A13',
  sourceUrl: 'https://techbank.wdasec.gov.tw/',
  officialLinks: OFFICIAL_LINKS,
  sourceRevision: '173002A13 + 900060A18/900070A17/900080A16/900090A11/900110A10',
  questionCount: questions.length,
  activeQuestionCount: questions.filter((question) => question.active !== false).length,
  sections: Object.entries(
    questions.reduce((acc, question) => {
      const existing = acc[question.section] ?? {
        id: question.section,
        subjectCode: question.subjectCode,
        sourceGroup: question.sourceGroup,
        titleZh: question.sectionTitle ?? question.section,
        questionCount: 0,
        activeQuestionCount: 0,
      }
      existing.questionCount += 1
      if (question.active !== false) existing.activeQuestionCount += 1
      acc[question.section] = existing
      return acc
    }, {}),
  ).map(([, section]) => section),
  mockRules: {
    totalQuestions: 80,
    singleCount: 60,
    multipleCount: 20,
    durationMinutes: 100,
    passScore: 60,
    maxScore: 100,
    weightSingle: 1,
    weightMultiple: 2,
    subjectQuota: [
      { subjectCode: '17300', count: 55 },
      { subjectCode: '90011', count: 9 },
      { subjectCode: '90006', count: 4 },
      { subjectCode: '90007', count: 4 },
      { subjectCode: '90008', count: 4 },
      { subjectCode: '90009', count: 4 },
    ],
  },
  integrity: {
    status: 'spot_checked',
    inactiveQuestionCount: questions.filter((question) => question.active === false).length,
    imageQuestionCount: questions.filter((question) => question.active !== false && question.hasFigure).length,
  },
}, null, 2)}\n`)
console.log(
  JSON.stringify({
    total: questions.length,
    bankCounts,
    counts,
    single: questions.filter((question) => question.kind === 'single').length,
    multiple: questions.filter((question) => question.kind === 'multiple').length,
    figures: questions.filter((question) => question.hasFigure).length,
  }),
)
