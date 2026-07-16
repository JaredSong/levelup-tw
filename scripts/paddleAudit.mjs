import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOcrReviewQueue } from './ocrAudit.mjs'

export function buildPaddlePagePlan({ outputDir, queue }) {
  return queue.map((item) => {
    const basename = `page-${String(item.page).padStart(3, '0')}`
    return {
      page: item.page,
      questionIds: item.questionIds,
      reasons: item.reasons,
      imagePath: join(outputDir, 'pages', `${basename}.png`),
      outputDir: join(outputDir, 'results', basename),
    }
  })
}

export function requiredPlanDirectories(plan) {
  return [...new Set(plan.flatMap((job) => [dirname(job.imagePath), job.outputDir]))]
}

export function buildPaddleRunnerArgs(runner, plan) {
  return [runner, ...plan.flatMap((job) => [job.imagePath, job.outputDir])]
}

function runPlan(pdfPath, plan) {
  const python = process.env.PADDLE_PYTHON ?? '.venv-paddle/bin/python'
  const runner = fileURLToPath(new URL('./runPaddleStructure.py', import.meta.url))
  for (const directory of requiredPlanDirectories(plan)) mkdirSync(directory, { recursive: true })
  for (const job of plan) {
    const imagePrefix = job.imagePath.replace(/\.png$/, '')
    execFileSync('pdftoppm', [
      '-f', String(job.page),
      '-l', String(job.page),
      '-r', '220',
      '-png',
      '-singlefile',
      pdfPath,
      imagePrefix,
    ], { stdio: 'inherit' })
  }
  if (plan.length) execFileSync(python, buildPaddleRunnerArgs(runner, plan), { stdio: 'inherit' })
}

function main() {
  const [, , pdfPath, bankPath, subjectCode, outputDir = `tmp/paddle/${subjectCode}`, runFlag] = process.argv
  if (!pdfPath || !bankPath || !subjectCode) {
    console.error('Usage: node scripts/paddleAudit.mjs <official.pdf> <questions.json> <subjectCode> [output-dir] [--run]')
    process.exit(1)
  }
  const questions = JSON.parse(readFileSync(bankPath, 'utf8')).filter((question) => question.subjectCode === subjectCode)
  const queue = buildOcrReviewQueue(questions)
  const plan = buildPaddlePagePlan({ pdfPath, outputDir, queue })
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'review-queue.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    subjectCode,
    pdfPath,
    questionCount: questions.length,
    flaggedPageCount: plan.length,
    plan,
  }, null, 2)}\n`)
  console.log(`Paddle review queue: ${plan.length} of ${new Set(questions.map((question) => question.sourcePage)).size} pages flagged.`)
  if (runFlag === '--run') runPlan(pdfPath, plan)
  else console.log('Dry run only. Add --run after the output directory to render and OCR the flagged pages.')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
if (isMain) main()
