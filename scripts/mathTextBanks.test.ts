import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { splitMath } from '../src/domain/mathText'

// Every ⟦…⟧ formula in a published bank must parse: the app throws on
// malformed math rather than show a half-rendered formula to a learner.
describe('inline math in published banks', () => {
  const root = new URL('../public/data/exams/', import.meta.url)
  const exams = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)

  it.each(exams)('%s parses', (examId) => {
    const questions = JSON.parse(readFileSync(new URL(`${examId}/questions.json`, root), 'utf8')) as { id: string; prompt: string; options: string[] }[]
    const broken: string[] = []
    for (const question of questions) {
      for (const text of [question.prompt, ...question.options]) {
        try {
          splitMath(text)
        } catch (error) {
          broken.push(`${question.id}: ${(error as Error).message}`)
        }
      }
    }
    expect(broken).toEqual([])
  })
})
