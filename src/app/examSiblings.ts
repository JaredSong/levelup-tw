import type { ExamManifest } from '../core/exam'
import { NATIONAL_EXAM_ROUNDS } from './nationalExamRounds'

/**
 * Sibling exams an exam page compares itself with: same category and either the
 * same 職類 (the official title before 「－」 or the level — 中餐烹調 葷/素,
 * 電腦硬體裝修 乙/丙) or the very same 專業工作項目 names (the three 職業安全衛生
 * 管理 exams). Every fact comes from the manifests and the round table; nothing
 * about exam content is typed here.
 */
export interface WorkItemCount {
  title: string
  count: number
}

export interface SiblingComparison {
  sibling: ExamManifest
  /** Work items both exams name. */
  shared: string[]
  onlyHere: string[]
  onlyThere: string[]
}

const trade = (exam: ExamManifest) => exam.titleZh.split('－')[0].replace(exam.level, '')

/** The exam's own 專業科目 work items, in official order. */
export function occupationWorkItems(exam: ExamManifest): WorkItemCount[] {
  return exam.sections
    .filter((section) => section.sourceGroup === 'occupation')
    .map((section) => ({ title: section.titleZh, count: section.activeQuestionCount }))
}

/** The latest year whose per-exam round table has been read. */
export const ROUND_YEAR = Math.max(...Object.keys(NATIONAL_EXAM_ROUNDS).map(Number))

export function examSiblings(exam: ExamManifest, exams: readonly ExamManifest[]): SiblingComparison[] {
  const mine = occupationWorkItems(exam)
  const myTitles = mine.map((item) => item.title)
  const sameItems = (other: ExamManifest) => {
    const theirs = occupationWorkItems(other).map((item) => item.title)
    return theirs.length === myTitles.length && theirs.every((title) => myTitles.includes(title))
  }
  const candidates = exams.filter((other) => other.examId !== exam.examId && other.category === exam.category)
  const siblings = [
    ...candidates.filter((other) => trade(other) === trade(exam)),
    ...candidates.filter((other) => trade(other) !== trade(exam) && sameItems(other)),
  ]
  return siblings.map((sibling) => {
    const theirTitles = occupationWorkItems(sibling).map((item) => item.title)
    return {
      sibling,
      shared: myTitles.filter((title) => theirTitles.includes(title)),
      onlyHere: myTitles.filter((title) => !theirTitles.includes(title)),
      onlyThere: theirTitles.filter((title) => !myTitles.includes(title)),
    }
  })
}
