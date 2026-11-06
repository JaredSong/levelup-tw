// Official shared-subject (共用科目) rules for the 學科 mock exam.
//
// Source: 115年度全國技術士技能檢定簡章, 重點提示 items 20–21 (skill.tcte.edu.tw,
// the official 學科 test administrator):
//   - 90006–90009 apply to every exam, 5% each → 4 of 80 questions each.
//   - 90010 食品安全衛生及營養: 20% → 16 questions (技檢中心 106.11.30 技發字第 1061301406 號).
//   - 90011 資訊相關: 丙級 12 questions, 乙級 9 (技檢中心 108.9.27 技發字第 1081301000 號).
//   - 90012 美容美髮安全衛生: 20% → 16 questions (技檢中心 112.9.27 技發字第 1121301956 號).
// The publication gate checks every pack against this, so a mock exam can't
// silently draw a shared subject in the wrong proportion again.

export const GENERAL_COMMON_CODES = ['90006', '90007', '90008', '90009']
export const GENERAL_COMMON_COUNT = 4

export const SHARED_SUBJECT_RULES = [
  {
    code: '90010',
    occupations: ['中餐烹調', '西餐烹調', '飲料調製', '餐飲服務', '食物製備', '烘焙食品', '食品檢驗分析', '中式麵食加工', '中式米食加工', '肉製品加工', '水產食品加工'],
    count: () => 16,
  },
  {
    code: '90011',
    occupations: ['電腦軟體應用', '電腦軟體設計', '電腦硬體裝修', '網頁設計', '網路架設'],
    count: (level) => (level === '乙級' ? 9 : level === '丙級' ? 12 : null),
  },
  {
    code: '90012',
    occupations: ['男子理髮', '女子美髮', '美容'],
    count: () => 16,
  },
]

const occupationOf = (titleZh) => titleZh.replace(/(甲級|乙級|丙級|單一級)$/, '')

/** The shared subjects (and question counts) an exam must draw, by its title and level. */
export function requiredSharedQuota(titleZh, level) {
  const occupation = occupationOf(titleZh)
  return SHARED_SUBJECT_RULES
    .filter((rule) => rule.occupations.some((name) => occupation === name || occupation.startsWith(`${name}－`) || occupation.startsWith(`${name}─`) || occupation.startsWith(`${name}-`)))
    .map((rule) => ({ subjectCode: rule.code, count: rule.count(level) }))
}

/** Failures for a manifest whose mock quota disagrees with the official rules. */
export function auditSharedSubjects(manifest) {
  const failures = []
  const quota = new Map((manifest.mockRules?.subjectQuota ?? []).map((item) => [item.subjectCode, item.count]))
  for (const code of GENERAL_COMMON_CODES) {
    if (quota.get(code) !== GENERAL_COMMON_COUNT) {
      failures.push(`mock draws ${quota.get(code) ?? 0} from ${code}; the official rule is ${GENERAL_COMMON_COUNT}`)
    }
  }
  const required = requiredSharedQuota(manifest.titleZh ?? '', manifest.level ?? '')
  const requiredCodes = new Set(required.map((item) => item.subjectCode))
  for (const { subjectCode, count } of required) {
    if (count === null) {
      failures.push(`no official ${subjectCode} count for level ${manifest.level}`)
    } else if (quota.get(subjectCode) !== count) {
      failures.push(`mock draws ${quota.get(subjectCode) ?? 0} from ${subjectCode}; the official rule is ${count}`)
    }
    if (!(manifest.sections ?? []).some((section) => section.subjectCode === subjectCode)) {
      failures.push(`pack does not include the ${subjectCode} question bank it is tested on`)
    }
  }
  for (const rule of SHARED_SUBJECT_RULES) {
    if (!requiredCodes.has(rule.code) && quota.has(rule.code)) {
      failures.push(`mock draws from ${rule.code}, which does not apply to ${manifest.titleZh}`)
    }
  }
  return failures
}
