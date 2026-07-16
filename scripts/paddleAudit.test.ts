import { describe, expect, it } from 'vitest'
import {
  buildPaddlePagePlan,
  buildPaddleRunnerArgs,
  pendingOcrJobs,
  pendingPageRenderJobs,
  requiredPlanDirectories,
} from './paddleAudit.mjs'

describe('buildPaddlePagePlan', () => {
  it('creates one deterministic render and OCR job per flagged PDF page', () => {
    const plan = buildPaddlePagePlan({
      pdfPath: 'source/173002A13.pdf',
      outputDir: 'tmp/paddle/17300',
      queue: [
        { page: 6, questionIds: ['q1'], reasons: ['figure'] },
        { page: 8, questionIds: ['q2', 'q3'], reasons: ['suspicious-spacing', 'figure'] },
      ],
    })

    expect(plan).toEqual([
      {
        page: 6,
        questionIds: ['q1'],
        reasons: ['figure'],
        imagePath: 'tmp/paddle/17300/pages/page-006.png',
        outputDir: 'tmp/paddle/17300/results/page-006',
      },
      {
        page: 8,
        questionIds: ['q2', 'q3'],
        reasons: ['suspicious-spacing', 'figure'],
        imagePath: 'tmp/paddle/17300/pages/page-008.png',
        outputDir: 'tmp/paddle/17300/results/page-008',
      },
    ])
  })
})

describe('requiredPlanDirectories', () => {
  it('includes the shared page-render directory before pdftoppm runs', () => {
    const plan = buildPaddlePagePlan({
      outputDir: 'tmp/paddle/17300',
      queue: [{ page: 6, questionIds: ['q1'], reasons: ['figure'] }],
    })

    expect(requiredPlanDirectories(plan)).toEqual([
      'tmp/paddle/17300/pages',
      'tmp/paddle/17300/results/page-006',
    ])
  })
})

describe('buildPaddleRunnerArgs', () => {
  it('sends every flagged page through one Python process', () => {
    const plan = buildPaddlePagePlan({
      outputDir: 'tmp/paddle/17300',
      queue: [
        { page: 6, questionIds: ['q1'], reasons: ['figure'] },
        { page: 8, questionIds: ['q2'], reasons: ['figure'] },
      ],
    })

    expect(buildPaddleRunnerArgs('scripts/runPaddleStructure.py', plan)).toEqual([
      'scripts/runPaddleStructure.py',
      'tmp/paddle/17300/pages/page-006.png',
      'tmp/paddle/17300/results/page-006',
      'tmp/paddle/17300/pages/page-008.png',
      'tmp/paddle/17300/results/page-008',
    ])
  })
})

describe('pendingPageRenderJobs', () => {
  it('resumes an interrupted batch without rendering completed pages again', () => {
    const plan = [
      { imagePath: 'tmp/pages/page-001.png' },
      { imagePath: 'tmp/pages/page-002.png' },
    ]

    expect(pendingPageRenderJobs(plan, (path) => path.endsWith('page-001.png'))).toEqual([
      { imagePath: 'tmp/pages/page-002.png' },
    ])
  })
})

describe('pendingOcrJobs', () => {
  it('does not send completed Paddle result directories through the model again', () => {
    const plan = [
      { outputDir: 'tmp/results/page-001' },
      { outputDir: 'tmp/results/page-002' },
    ]

    expect(pendingOcrJobs(plan, (path) => path.endsWith('page-001_res.json'))).toEqual([
      { outputDir: 'tmp/results/page-002' },
    ])
  })
})
