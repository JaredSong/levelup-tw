import { describe, expect, it } from 'vitest'
import { auditSharedSubjects, requiredSharedQuota } from './officialSharedSubjects.mjs'

const general = ['90006', '90007', '90008', '90009'].map((subjectCode) => ({ subjectCode, count: 4 }))
const manifest = (titleZh, level, extra, sectionCodes = extra.map((item) => item.subjectCode)) => ({
  titleZh,
  level,
  sections: [...sectionCodes, '90006'].map((subjectCode) => ({ subjectCode })),
  mockRules: { subjectQuota: [{ subjectCode: '00000', count: 64 - extra.reduce((sum, item) => sum + item.count, 0) }, ...extra, ...general] },
})

describe('official shared-subject quotas (115 簡章 重點提示 21)', () => {
  it('maps exams to their shared subjects and counts', () => {
    expect(requiredSharedQuota('烘焙食品丙級', '丙級')).toEqual([{ subjectCode: '90010', count: 16 }])
    expect(requiredSharedQuota('中餐烹調－素食丙級', '丙級')).toEqual([{ subjectCode: '90010', count: 16 }])
    expect(requiredSharedQuota('網路架設丙級', '丙級')).toEqual([{ subjectCode: '90011', count: 12 }])
    expect(requiredSharedQuota('電腦硬體裝修乙級', '乙級')).toEqual([{ subjectCode: '90011', count: 9 }])
    expect(requiredSharedQuota('美容乙級', '乙級')).toEqual([{ subjectCode: '90012', count: 16 }])
    expect(requiredSharedQuota('國貿業務丙級', '丙級')).toEqual([])
    expect(requiredSharedQuota('美容美髮丙級', '丙級')).toEqual([])
  })

  it('accepts official splits and rejects the old ones', () => {
    expect(auditSharedSubjects(manifest('烘焙食品丙級', '丙級', [{ subjectCode: '90010', count: 16 }]))).toEqual([])
    expect(auditSharedSubjects(manifest('烘焙食品丙級', '丙級', [{ subjectCode: '90010', count: 4 }]))).toHaveLength(1)
    // 網路架設 shipped without the 90011 bank at all.
    expect(auditSharedSubjects(manifest('網路架設丙級', '丙級', []))).toHaveLength(2)
    expect(auditSharedSubjects(manifest('國貿業務丙級', '丙級', [{ subjectCode: '90011', count: 12 }]))).toHaveLength(1)
  })
})
