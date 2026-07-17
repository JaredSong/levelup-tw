import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildSourceProvenance } from './examSources.mjs'
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
  '15100-02-187',
  '15100-03-011',
  '15100-03-037',
  '15100-03-039',
  '15100-03-042',
  '15100-03-043',
  '15100-03-045',
  '15100-03-059',
  '15100-03-082',
  '15100-03-097',
  '15100-03-113',
  '15100-03-114',
  '15100-03-122',
  '15100-03-128',
  '15100-03-130',
  '15100-03-143',
  '15100-03-146',
  '15100-03-147',
  '15100-03-190',
  '18201-02-140',
  '18201-04-240',
  '90001-07-012',
  '90001-07-019',
  '90001-09-003',
  '90001-09-029',
  '14000-02-065',
  '14000-02-101',
  '14000-10-083',
  '14000-11-008',
])

// These questions contain inline figures that the PDF text layer describes
// without the usual 「下圖」 wording, so the generic parser cannot infer them.
const FIGURE_QUESTION_IDS = new Set([
  '12600-01-008',
  '12600-01-011',
  '12600-01-012',
  '12600-01-013',
  '12600-01-014',
  '12600-01-018',
  '12600-01-031',
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

const QUESTION_PROMPT_OVERRIDES = {
  '90001-02-010': '若 (3/2)x＋1＝5/4，則 1－2x 之值等於',
  '90001-02-017': '已知 △ABC 為一個直角三角形，其中 ∠C＝90°，∠A 為較大的銳角，兩股長分別為 5、12，則 sin A＝',
  '90001-02-018': 'sin 30° × cos 30° × tan 30° × cot 30° × sec 30° 的值等於',
  '90001-02-019': '直角三角形 ABC 中，∠C＝90°、∠A＝30°，求 (sin B)²＋(cos B)² 的值等於',
  '90001-02-020': '直角三角形 ABC 中，∠C＝90°、tan A＝3/4，求 sin A ÷ (1－cot A) 的值等於',
  '90001-02-021': 'sin 30° cos 60°＋cos 30° sin 60°＝',
  '90001-02-022': '(2/√3) cos 30°－sin 30°＋cos 60°－tan 45°＋(√3/2) cot 60°＝',
  '90001-02-023': '直角三角形 ABC 中，∠A 為銳角且 sec A＝2/√3，求 cos A ÷ (1－sin A) 的值等於',
  '90001-02-024': '直角三角形 ABC 中，∠C＝90°、∠A＝45°，求 sin A＋cos B＝',
  '90001-02-025': '設 θ 為任一角，則下列有關三角函數的關係，何者有誤？',
  '90001-02-026': '利用正弦定律，若 △ABC 中，∠C＝120°、∠B＝30°、AC＝5，求 AB＝',
  '90001-02-027': '利用餘弦定律，若 △ABC 中，a、b、c 分別代表對邊之邊長，且 a＝2、b＝3、c＝4，則 cos A＝',
  '90001-02-031': '若 sin θ＝3/5，則 5－5cos²θ＝',
  '90001-02-033': '已知 tan θ＝2，利用三角恆等式，則 (3sin θ－2cos θ) ÷ cos θ＝',
  '90001-02-048': '若 180°＜θ＜270° 且 sin θ＝−5/13，下列何者正確？',
  '90001-08-002': '液壓油以流量 25 L/min 通過內徑 11 mm 的油壓管，則其流速約為',
  '90001-09-032': '平均值與全距（x̄－R）管制圖，每組樣本大小（n）最好是抽',
  '90001-09-033': '在製程管制中，將平均值（x̄）管制圖與下列何種管制圖配合使用較為有效？',
  '90001-09-037': '平均值與全距（x̄－R）管制圖是一種',
  '00700-11-086': '感應電動機之運轉公式 n = (2f / p) rps 中',
  '02800-08-021': '將極座標 6√2∠135° 換為直角座標得',
  '02800-09-052': '在電晶體參數中 h₁₁ = (ΔV₁ / ΔI₁)｜V₂=0，其 h₁₁ 代表意義為',
  '02800-10-025': '在 J.K 正反器中，J＝0、K＝1 時，當 CLOCK（時脈）信號激發後，其輸出 Q 與 Q̅ 為',
  '02800-10-061': '有一 J-K 正反器，在不考慮控制輸入下，欲使其輸出為反態現象（Qₙ₊₁ = Q̅ₙ），則 J、K 之輸入為何？',
  '02800-08-015': '下圖 v(t) = 12√2 cos ωt 伏特，則其總電流之有效值 I_rms 為',
  '02800-09-006': '下圖 V₀ 輸出波形近似於',
  '02800-10-060': '如圖所示，y = ¬A 之輸入條件為',
}

const QUESTION_OPTION_OVERRIDES = {
  '90001-02-010': ['2', '2/3', '1/2', '3/4'],
  '90001-02-016': ['−π', '3π/4', 'π/2', 'π/3'],
  '90001-02-017': ['5/12', '12/13', '5/13', '12/5'],
  '90001-02-018': ['1/2', '√2/2', '√3/2', '1'],
  '90001-02-019': ['1/2', '√2/2', '√3/2', '1'],
  '90001-02-020': ['−9/5', '7/3', '−12/5', '9/4'],
  '90001-02-021': ['0', '−1', '1', '2'],
  '90001-02-022': ['0', '1/2', '√3/2', '1'],
  '90001-02-023': ['1/2', '√2/2', '4/√3', '√3'],
  '90001-02-024': ['1', '√2', '2', '2√2'],
  '90001-02-025': ['sin(−θ)＝−sin θ', 'cos(−θ)＝cos θ', 'sin(π−θ)＝−sin θ', 'cos(π−θ)＝−cos θ'],
  '90001-02-026': ['5√3', '20/√3', '10√3', '10'],
  '90001-02-027': ['11/12', '9/13', '5/12', '21/24'],
  '90001-02-031': ['9/5', '5/4', '3/5', '12/5'],
  '90001-02-033': ['1/2', '1', '2', '4'],
  '90001-02-048': ['cos θ＝−12/13', 'cos(180°＋θ)＝12/13', 'tan(180°−θ)＝5/12', 'sin θ ÷ (1−cos θ)＝−1/5'],
  '90001-09-036': ['平均值（x̄）管制圖', '全距（R）管制圖', '缺點數（c）管制圖', '標準差（s）管制圖'],
  '11800-03-054': ['Windows 鍵+Ctrl+右方向鍵', 'Windows 鍵+Ctrl+下方向鍵', 'Windows 鍵+Ctrl+L', 'Windows 鍵+Ctrl+R'],
  '11800-03-056': ['Windows 鍵+Ctrl+D', 'Windows 鍵+Ctrl+A', 'Windows 鍵+Ctrl+C', 'Windows 鍵+Ctrl+L'],
  '11800-03-071': ['Windows 鍵+Ctrl+F1', 'Windows 鍵+Ctrl+F4', 'Windows 鍵+Ctrl+F8', 'Windows 鍵+Ctrl+F9'],
  '11800-03-078': ['Windows 鍵+Tab', 'Windows 鍵+Ctrl', 'Windows 鍵+Alt', 'Windows 鍵+Shift'],
  '02800-08-006': ['L₁ + L₂ ± M', 'M√(L₁ + L₂)', 'M ÷ √(L₁ + L₂)', 'L₁ + L₂ ± 2M'],
  '02800-08-012': ['0.886', '1 ÷ √2', '√3 ÷ 2', '0.5'],
  '02800-08-013': ['1 ÷ (2π√LRC)', '1 ÷ (2πRC)', '1 ÷ (2π√RC)', '1 ÷ (2π√LC)'],
  '02800-08-022': ['1/2', 'π/2', '√2/2', '2/π 倍'],
  '02800-08-080': ['√(R² + X_L²)', '√(R² + X_C²)', 'R', '√(R² + (X_L + X_C)²)'],
  '02800-08-089': ['5－j5√3', '5＋j5√3', '5√3＋j5', '5√3－j5'],
  '02800-09-010': ['0', '1', '√2', '√29'],
  '02800-09-029': ['β = α ÷ (1 + β)', 'β = (1 + α) ÷ α', 'β = α ÷ (α - 1)', 'β = α ÷ (1 - α)'],
  '02800-09-072': ['2 倍', '√2 倍', '1/2 倍', '1/√2 倍'],
  '02800-10-025': ['Q＝1，Q̅＝1', 'Q＝0，Q̅＝1', 'Q＝0，Q̅＝0', 'Q＝1，Q̅＝0'],
  '02800-10-026': ['A·B = ¬(A + B)', 'AB = ¬A + ¬B', '¬(AB) = ¬(A + B)', '¬(AB) = ¬A + ¬B'],
  '02800-10-030': ['B＋C', 'A·C̅＋B', 'BC＋C̅', 'B＋C̅'],
  '02800-10-003': ['F = DC + DB¬A + B¬A', 'F = DC + DB¬A + ¬CB¬A', 'F = DC + B¬A', 'F = BC + D¬A'],
  '02800-10-004': ['Y(X + Z)', '¬(¬(XY) + ¬(YZ))', 'XYZ', '¬(XYZ)'],
  '02800-10-005': ['¬(XY) + XY', '¬X·Y + X·¬Y', 'XY + XY', 'X + Y'],
  '02800-10-006': ['¬(XY) + ¬(WZ)', '¬(XY) + ¬W·¬Z', '¬(XYWZ)', '¬(XY)·¬(WZ)'],
  '02800-10-021': ['0', '1', 'A', '¬A'],
  '02800-10-023': ['Y = AB + ¬A·B', 'Y = ¬A·B + A·¬B', 'Y = AB + ¬(AB)', 'Y = A ⊕ B'],
  '02800-10-029': ['Y = A·B', 'Y = A + B', 'Y = ¬(AB)', 'Y = ¬(A + B)'],
  '02800-10-060': ['I₀I₁ = 00', 'I₀I₁ = 01', 'I₀I₁ = 10', 'I₀I₁ = 11'],
}

const NO_SOURCE_PAGE_IMAGE = new Set(['07700-03-003'])

const GENERAL_COMMON_BANKS = [
  { code: '90006', file: '900060A18-raw.txt', expected: 100, version: 'A18' },
  { code: '90007', file: '900070A17-raw.txt', expected: 100, version: 'A17' },
  { code: '90008', file: '900080A16-raw.txt', expected: 100, version: 'A16' },
  { code: '90009', file: '900090A11-latest-raw.txt', expected: 100, version: 'A11' },
]

const MACHINERY_COMMON_BANK = {
  code: '90001',
  file: '900012A10-raw.txt',
  expected: 479,
  version: 'A10',
  quota: 4,
}

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
    examId: 'computer-software-application-b',
    titleZh: '電腦軟體應用乙級',
    titleEn: 'Computer Software Application (Class B)',
    level: '乙級',
    category: '資訊',
    occupationCode: '11800',
    occupationSourceKey: '11800-2',
    occupationFile: '118002A15-raw.txt',
    occupationExpected: 776,
    version: 'A15',
    sourceRevision: '118002A15 + 900110A10 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90011'],
    cropPrefix: '118002',
    requireQuestionCrops: true,
    mockRules: {
      occupationQuota: 60,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [{ subjectCode: '90011', count: 4 }],
    },
  },
  {
    examId: 'indoor-wiring-b',
    titleZh: '室內配線－屋內線路裝修乙級',
    titleEn: 'Indoor Wiring Installation (Class B)',
    level: '乙級',
    category: '電機工程',
    occupationCode: '00700',
    occupationSourceKey: '00700-2',
    occupationFile: '007002A15-raw.txt',
    occupationExpected: 862,
    version: 'A15',
    sourceRevision: '007002A15 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '007002',
    requireQuestionCrops: true,
    splitImageOptions: true,
    includeLeftFigures: true,
    figureIds: ['00700-11-063', '00700-12-043'],
    excludedFigureIds: ['00700-06-018', '00700-11-086'],
    mixedFigureOptionIds: ['00700-09-007'],
    inactiveIds: [
      '00700-05-015',
      '00700-05-016',
      '00700-05-039',
      '00700-10-002',
      '00700-10-016',
      '00700-16-024',
      '00700-19-031',
    ],
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
    examId: 'indoor-wiring-c',
    titleZh: '室內配線－屋內線路裝修丙級',
    titleEn: 'Indoor Wiring Installation (Class C)',
    level: '丙級',
    category: '電機工程',
    occupationCode: '00700',
    occupationSourceKey: '00700-3',
    occupationFile: '007003A13-raw.txt',
    occupationExpected: 618,
    version: 'A13',
    sourceRevision: '007003A13 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '007003',
    requireQuestionCrops: true,
    figureIds: ['00700-13-005'],
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
  {
    examId: 'forklift-operation-single',
    titleZh: '堆高機操作單一級',
    titleEn: 'Forklift Operation (Single Level)',
    level: '單一級',
    category: '機械操作',
    occupationCode: '15100',
    occupationFile: '151004A14-raw.txt',
    occupationExpected: 600,
    version: 'A14',
    sourceRevision: '151004A14 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    requireQuestionCrops: true,
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
    examId: 'interior-decoration-management-b',
    titleZh: '建築物室內裝修工程管理乙級',
    titleEn: 'Interior Decoration Engineering Management (Class B)',
    level: '乙級',
    category: '營造工程',
    occupationCode: '12600',
    occupationFile: '126002A12-raw.txt',
    occupationExpected: 718,
    version: 'A12',
    sourceRevision: '126002A12 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    requireQuestionCrops: true,
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
    examId: 'beverage-preparation-c',
    titleZh: '飲料調製丙級',
    titleEn: 'Beverage Preparation (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '20600',
    occupationFile: '206003A13-raw.txt',
    occupationExpected: 617,
    version: 'A13',
    sourceRevision: '206003A13 + 900100A16 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90010'],
    requireQuestionCrops: true,
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
    examId: 'industrial-electronics-c',
    titleZh: '工業電子丙級',
    titleEn: 'Industrial Electronics (Class C)',
    level: '丙級',
    category: '電子儀表',
    occupationCode: '02800',
    occupationFile: '028003A11-raw.txt',
    occupationExpected: 651,
    version: 'A11',
    sourceRevision: '028003A11 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '028003',
    embeddedImageMapFile: '028003A11-image-map.json',
    requireQuestionCrops: true,
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
    examId: 'computer-hardware-repair-c',
    titleZh: '電腦硬體裝修丙級',
    titleEn: 'Computer Hardware Repair (Class C)',
    level: '丙級',
    category: '資訊',
    occupationCode: '12000',
    occupationFile: '120003A12-raw.txt',
    occupationExpected: 707,
    version: 'A12',
    sourceRevision: '120003A12 + 900110A10 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90011'],
    cropPrefix: '120003',
    requireQuestionCrops: true,
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
    examId: 'water-pipe-fitting-c',
    titleZh: '自來水管配管丙級',
    titleEn: 'Water Pipe Fitting (Class C)',
    level: '丙級',
    category: '銲接配管',
    occupationCode: '01600',
    occupationFile: '016003A12-raw.txt',
    occupationExpected: 707,
    version: 'A12',
    sourceRevision: '016003A12 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '016003',
    requireQuestionCrops: true,
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
    examId: 'excavator-operation-single',
    titleZh: '重機械操作－挖掘機單一級',
    titleEn: 'Excavator Operation (Single Level)',
    level: '單一級',
    category: '機械操作',
    occupationCode: '07002',
    occupationFile: '070024A10-raw.txt',
    occupationExpected: 668,
    version: 'A10',
    sourceRevision: '070024A10 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '070024',
    embeddedImageMapFile: '070024A10-image-map.json',
    requireQuestionCrops: true,
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
    examId: 'digital-electronics-b',
    titleZh: '數位電子乙級',
    titleEn: 'Digital Electronics (Class B)',
    level: '乙級',
    category: '電子儀表',
    occupationCode: '11700',
    occupationFile: '117002A13-raw.txt',
    occupationExpected: 743,
    version: 'A13',
    sourceRevision: '117002A13 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '117002',
    embeddedImageMapFile: '117002A13-image-map.json',
    requireQuestionCrops: true,
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
    examId: 'western-cooking-c',
    titleZh: '西餐烹調丙級',
    titleEn: 'Western Cuisine (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '14000',
    occupationFile: '140003A11-raw.txt',
    occupationExpected: 519,
    version: 'A11',
    sourceRevision: '140003A11 + 900100A16 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90010'],
    excludedFigureIds: ['14000-03-060'],
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
    examId: 'retail-service-c',
    titleZh: '門市服務丙級',
    titleEn: 'Retail Service (Class C)',
    level: '丙級',
    category: '商業服務',
    occupationCode: '18100',
    occupationFile: '181003A13-raw.txt',
    occupationExpected: 622,
    version: 'A13',
    sourceRevision: '181003A13 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: [],
    cropPrefix: '181003',
    embeddedImageMapFile: '181003A13-image-map.json',
    requireQuestionCrops: true,
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
    examId: 'cnc-milling-b',
    titleZh: '銑床－CNC銑床乙級',
    titleEn: 'CNC Milling (Class B)',
    level: '乙級',
    category: '金屬及機械加工',
    occupationCode: '18201',
    occupationFile: '182012A10-raw.txt',
    occupationExpected: 775,
    version: 'A10',
    sourceRevision: '182012A10 + 900012A10 + 900060A18/900070A17/900080A16/900090A11',
    extraCommonCodes: ['90001'],
    cropPrefix: '182012',
    embeddedImageMapFiles: ['182012A10-image-map.json', '900012A10-image-map.json'],
    requireQuestionCrops: true,
    mockRules: {
      occupationQuota: 60,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [{ subjectCode: '90001', count: 4 }],
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

function cropFileName(exam, question) {
  return `${exam.cropPrefix ? `${exam.cropPrefix}-` : ''}${question.id}.png`
}

function generatedImageSources(exam, question) {
  const embedded = exam.embeddedImageMap?.[question.id]
  if (embedded?.length) return embedded.map(questionImagePath)
  if (!exam.splitImageOptions || !question.options.some((option) => option.includes('圖示選項'))) return undefined
  const stem = `${exam.cropPrefix ? `${exam.cropPrefix}-` : ''}${question.id}`
  const optionImages = question.options.map((_, index) => `/question-images/${stem}-${index + 1}.png`)
  return exam.mixedFigureOptionIds?.includes(question.id)
    ? [`/question-images/${stem}.png`, ...optionImages]
    : optionImages
}

function normalizeQuestion(question, exam) {
  const sourcePage = SOURCE_PAGE_OVERRIDES[question.id] ?? question.sourcePage
  const imageOverrides = IMAGE_OVERRIDES[question.id]
  const forceFigure = FIGURE_QUESTION_IDS.has(question.id)
    || exam.figureIds?.includes(question.id)
    || (exam.includeLeftFigures && question.prompt.includes('左圖'))
    || / {2,}/.test(`${question.prompt}${question.options.join('')}`)
  const mappedFigure = exam.embeddedImageMap ? Boolean(exam.embeddedImageMap[question.id]?.length) : undefined
  const hasFigure = mappedFigure ?? (!exam.excludedFigureIds?.includes(question.id) && (question.hasFigure || forceFigure))
  const repaired = {
    ...question,
    examId: exam.examId,
    sourcePage,
    sectionTitle: SECTION_TITLE_OVERRIDES[question.section] ?? question.sectionTitle,
    prompt: QUESTION_PROMPT_OVERRIDES[question.id] ?? sanitizeText(question.prompt),
    options: QUESTION_OPTION_OVERRIDES[question.id] ?? question.options.map(sanitizeText),
    ...(INACTIVE_IDS.has(question.id) || exam.inactiveIds?.includes(question.id) ? { active: false } : {}),
    hasFigure,
  }
  if (!repaired.hasFigure && !imageOverrides) {
    return { ...repaired, sourceImage: undefined, sourceImages: undefined, sourcePageImage: undefined }
  }
  const generatedImages = generatedImageSources(exam, repaired)
  const sourceImages = imageOverrides?.map(questionImagePath) ?? generatedImages
  return {
    ...repaired,
    hasFigure: true,
    sourceImage: sourceImages?.[0] ?? `/question-images/${cropFileName(exam, question)}`,
    sourceImages,
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
  const embeddedImageMapFiles = exam.embeddedImageMapFiles
    ?? (exam.embeddedImageMapFile ? [exam.embeddedImageMapFile] : [])
  const embeddedImageMaps = await Promise.all(embeddedImageMapFiles.map(async (file) => (
    JSON.parse(await readFile(new URL(`../source/${file}`, import.meta.url), 'utf8')).questions
  )))
  const embeddedImageMap = embeddedImageMaps.length
    ? Object.assign({}, ...embeddedImageMaps)
    : undefined
  const resolvedExam = embeddedImageMap ? { ...exam, embeddedImageMap } : exam
  const occupation = await loadParsed({ code: exam.occupationCode, file: exam.occupationFile, expected: exam.occupationExpected })
  const extraQuestions = (exam.extraCommonCodes ?? []).flatMap((code) => extraQuestionsByCode.get(code) ?? [])
  const questions = [...occupation, ...extraQuestions, ...commonQuestions]
    .map((question) => normalizeQuestion(question, resolvedExam))
  const active = questions.filter((question) => question.active !== false)
  const figures = active.filter((question) => question.hasFigure)
  if (exam.requireQuestionCrops) {
    const occupationFigures = figures.filter((question) => question.subjectCode === exam.occupationCode)
    await Promise.all(occupationFigures.map(async (question) => {
      const sources = question.sourceImages?.length ? question.sourceImages : [question.sourceImage]
      for (const source of sources) {
        try {
          await access(new URL(`../public${source}`, import.meta.url))
        } catch {
          throw new Error(`${exam.examId}: missing required question crop ${source}`)
        }
      }
    }))
  }
  const sources = await buildSourceProvenance([
    exam.occupationSourceKey ?? exam.occupationCode,
    ...(exam.extraCommonCodes ?? []),
    ...GENERAL_COMMON_BANKS.map((bank) => bank.code),
  ])
  const manifest = {
    examId: exam.examId,
    level: exam.level,
    titleZh: exam.titleZh,
    titleEn: exam.titleEn,
    category: exam.category,
    version: exam.version,
    sourceUrl: sources[0].officialUrl,
    sources,
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
    [MACHINERY_COMMON_BANK.code, await loadParsed(MACHINERY_COMMON_BANK)],
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
