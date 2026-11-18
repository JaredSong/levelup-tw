import { restoredFigureIds, symbolOptionIds } from './restoredFigures.mjs'
import { typedTextFixes } from './typedTextFixes.mjs'
import { COMMON_SCRIPT_OPTIONS, COMMON_SCRIPT_PROMPTS } from './commonScriptOverrides.mjs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildSourceProvenance, formatSourceRevision } from './examSources.mjs'
import {
  INFORMATION_COMMON_CODE_BLOCK_OVERRIDES,
  INFORMATION_COMMON_IMAGE_OVERRIDES,
  INFORMATION_COMMON_SOURCE_PAGE_OVERRIDES,
} from './informationCommonOverrides.mjs'
import { parseQuestionBank } from './questionParser.mjs'
import {
  SURVEYING_FIGURE_IDS,
  SURVEYING_OPTION_OVERRIDES,
  SURVEYING_PROMPT_OVERRIDES,
  SURVEYING_QUESTION_OVERRIDES,
  SURVEYING_SOURCE_FILE,
} from './surveyingQuestionOverrides.mjs'
import { restoreScripts, restoreScriptsDense, rootsToMath, sanitizeText } from './textCorrections.mjs'

const INACTIVE_IDS = new Set([
  '07602-01-067',
  '07602-04-009',
  '07602-10-011',
  '07700-02-071',
  '17800-02-102',
  '17800-04-063',
  '17800-04-082',
  '17800-05-102',
  '17800-06-007',
  '17800-06-069',
  '90010-01-100',
  '18201-02-140',
  '18201-04-240',
  '14000-02-065',
  '14000-02-101',
  '14000-10-083',
  '14000-11-008',
  // Both genuinely have four graphical options the reference catalogue never
  // described, but neither can ship correctly yet — not a data defect, a
  // frontend-contract gap (PracticeView.optionImageSources only renders all
  // four options as images or none; there is no per-index image/text mix).
  // 11700-06-102: two options are real text ("合理RC值之積分/微分電路"), two
  // are genuine circuit-diagram images with no text equivalent — nothing to
  // crop for the text options, so this isn't fixable by cropping harder.
  // Backlog item for Nell: extend sourceImages (or a new field) to carry
  // null for text-only options, the way optionCodeBlocks already does.
  // Reopen if that contract lands; until then leave it out rather than ship
  // a half-visible option.
  '11700-06-102',
  '11700-05-018',
  '11700-05-116',
  // 11700-05-057: three prompt-role reference images (two curve diagrams
  // referenced inline, one circuit box that landed last in PDF order) plus
  // four option crops — 7 images total, which is neither a plain figure nor
  // a clean base+4 shape. Needs a "composite only the prompt images, keep
  // the options separate, then reorder" capability that doesn't exist yet.
  // Not building it for one question — reopen if this 3-prompt+4-option
  // shape recurs elsewhere in a future pack.
  '11700-05-057',
  // Blank-crop trio (Wen audit, 2026-07-21): the figure genuinely exists in
  // the source PDF but the crop produced a pure-white PNG (min=max=255 —
  // confirmed with PIL against every pixel). All three sit at a page
  // boundary in their source PDF, so the likely cause is an off-by-one/
  // page-break fault in the crop bounds, not missing source content.
  // Prompt/options/answer key are all correct; only the image is empty, so
  // shipping them would show an unanswerable question. Pull until the crop
  // bounds are fixed and the image is re-cropped, then reopen.
  // 21500-03-073 (dining-service-c): 215003-21500-03-073.png, 870x147.
  // 「下圖是哪一種酒杯？」 — figure is on source/215003A11.pdf p.20.
  '21500-03-073',
  // 14500-03-195 (motorcycle-repair-c): 145003-14500-03-195.png, 870x353.
  // Figure is on source/145003A13.pdf p.18.
  '14500-03-195',
  // 22000-03-186 (occupational-safety-management-a): 220001-22000-03-186.png,
  // 870x46. Zone 0/1/2 hazard diagram spans a page break in
  // source/220001A15.pdf p.38-39.
  '22000-03-186',
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
  ...INFORMATION_COMMON_IMAGE_OVERRIDES,
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
  ...INFORMATION_COMMON_SOURCE_PAGE_OVERRIDES,
}

// 90011 ships in several packs. Its repairs live in one module shared with
// import-questions.mjs so the two builders cannot drift again.
const CODE_BLOCK_OVERRIDES = INFORMATION_COMMON_CODE_BLOCK_OVERRIDES

const SECTION_TITLE_OVERRIDES = {
  '19500-01': '職業介紹、人力仲介及外國人引進、聘僱、管理事項',
}

const QUESTION_PROMPT_OVERRIDES = {
  ...COMMON_SCRIPT_PROMPTS,
  '18500-06-015': '工件公稱尺寸為 ⟦52^{+0.08}_{+0.02}⟧ 公厘，其公差為',
  '18500-06-016': '工件公稱尺寸為 ⟦20^{+0.03}_{+0}⟧，則此公差為',
  '04202-02-011': '使用天頂距式垂直度盤之經緯儀，觀測一測點之天頂距，設正鏡讀數為 Z₁，倒鏡讀數為 Z₂，則其正確天頂距為',
  '04202-03-023': '導線閉合差之計算公式為（式中 ⟦W_{E}⟧ 表橫距閉合差，⟦W_{N}⟧ 表縱距閉合差，[L]表導線長度總和）',
  '04202-02-048': '三角高程測量公式 ⟦H_{B}-H_{A}=i_{A}+V-z_{B}+\\frac{S^{2}}{2R}+\\frac{-KS^{2}}{2R}⟧，公式中 K 為大氣折光係數，R為地球曲率半徑，而 ⟦\\frac{-KS^{2}}{2R}⟧ 稱為',
  '04202-06-028': '設 A、B、C 三點位依序在同一直線上，先以經檢定的鋼捲尺測得平距 ⟦\\overline{AB}⟧＝20.000m 及 ⟦\\overline{BC}⟧＝30.000m，再以電子測距儀測得平距 ⟦\\overline{AB}⟧＝20.020m 及 ⟦\\overline{AC}⟧＝50.050m，請依上述結果判斷電子測距儀可能有下列那一項系統誤差？',
  '00700-11-086': '感應電動機之運轉公式 n = (2f / p) rps 中',
  '02800-08-021': '將極座標 6√2∠135° 換為直角座標得',
  '02800-09-052': '在電晶體參數中 h₁₁ = (ΔV₁ / ΔI₁)｜V₂=0，其 h₁₁ 代表意義為',
  '02800-10-025': '在 J.K 正反器中，J＝0、K＝1 時，當 CLOCK（時脈）信號激發後，其輸出 Q 與 Q̅ 為',
  '02800-10-061': '有一 J-K 正反器，在不考慮控制輸入下，欲使其輸出為反態現象（Qₙ₊₁ = Q̅ₙ），則 J、K 之輸入為何？',
  '02800-08-015': '下圖 v(t) = 12√2 cos ωt 伏特，則其總電流之有效值 ⟦I_{rms}⟧ 為',
  '02800-09-006': '下圖 V₀ 輸出波形近似於',
  '02800-10-060': '如圖所示，y = ¬A 之輸入條件為',
  '17600-04-046': '高度超過多少呎以上，溫度保持常數約為 -69.7℉？',
  '17600-06-033': '交流純電阻電路，若 V = 100√2 sin αt（V），而 R＝50Ω，則其電流有效值為',
  '17600-06-039': '若要對額定 24V 的電瓶充電，其充電電壓可為',
}

const QUESTION_OPTION_OVERRIDES = {
  ...COMMON_SCRIPT_OPTIONS,
  '04202-01-103': [
    '地圖比例尺為實地距離與圖面距離的比值',
    '一座邊長 1m 的正方形花圃可以在 1/25000 的地圖上顯示其輪廓形狀',
    '地圖上各處的比例尺並不相同',
    '1/10000 的地形圖較 1/5000 的地形圖具有更細緻的地物、地貌資訊',
  ],
  '04202-02-011': [
    '⟦\\frac{Z_{1}+Z_{2}}{2}+180°⟧',
    '⟦\\frac{Z_{1}-Z_{2}}{2}+180°⟧',
    '⟦\\frac{Z_{1}+Z_{2}}{2}-180°⟧',
    '⟦\\frac{Z_{2}-Z_{1}}{2}+180°⟧',
  ],
  '04202-02-073': [
    'D＝b / (tan α₁－tan α₂)',
    'D＝b / (cot α₁－cot α₂)',
    'D＝b / (sin α₁－sin α₂)',
    'D＝b / (cos α₁－cos α₂)',
  ],
  '04202-03-023': [
    '⟦\\sqrt{W_{E}^{2}+W_{N}^{2}}⟧',
    '⟦\\sqrt{W_{E}^{2}-W_{N}^{2}}⟧',
    '⟦\\frac{W_{E}^{2}+W_{N}^{2}}{[L]}⟧',
    '⟦\\frac{W_{E}^{2}-W_{N}^{2}}{[L]}⟧',
  ],
  '04202-03-029': [
    '⟦\\frac{sin1+sin2+sin3+sin4}{sin5+sin6+sin7+sin8}=1⟧',
    '⟦\\frac{sin1·sin2·sin3·sin4}{sin5·sin6·sin7·sin8}=1⟧',
    '⟦\\frac{sin2·sin4·sin6·sin8}{sin1·sin3·sin5·sin7}=1⟧',
    '⟦\\frac{\\overline{AB}·sin2·sin4·sin6·sin8}{\\overline{CD}·sin1·sin3·sin5·sin7}=1⟧',
  ],
  '04202-03-030': [
    '⟦\\frac{S_{1}·\\sin A1·\\sin A2·\\sin A3}{S_{2}·\\sin B1·\\sin B2·\\sin B3}=1⟧',
    '⟦\\frac{S_{1}·\\sin B1·\\sin B2·\\sin B3}{S_{2}·\\sin A1·\\sin A2·\\sin A3}=1⟧',
    '⟦\\frac{S_{1}·\\sin A1·\\sin A2·\\sin A3}{S_{2}·\\sin C1·\\sin C2·\\sin C3}=1⟧',
    '⟦\\frac{S_{1}·\\sin B1·\\sin B2·\\sin B3}{S_{2}·\\sin C1·\\sin C2·\\sin C3}=1⟧',
  ],
  '04202-03-031': ['r＋x₁＋x₂', 'r＋x₁－x₂', 'r－x₁＋x₂', 'r－x₁－x₂'],
  '04202-03-032': [
    'ρ″·⟦\\frac{e}{S_{2}}⟧·sin(360°－φ)',
    'ρ″·⟦\\frac{e}{S_{1}}⟧·sin(360°－φ)',
    'ρ″·⟦\\frac{e}{S_{1}}⟧·sin(360°－φ＋r)',
    'ρ″·⟦\\frac{e}{S_{2}}⟧·sin(360°－φ＋r)',
  ],
  '04202-03-034': [
    '⟦φ_{AB}⟧－⟦φ_{DE}⟧＋C1－C2＋C3＋180°＝0',
    '⟦φ_{DE}⟧－⟦φ_{AB}⟧＋C1－C2＋C3＋180°＝0',
    '⟦φ_{AB}⟧－⟦φ_{DE}⟧－C1＋C2－C3＋180°＝0',
    '⟦φ_{DE}⟧－⟦φ_{AB}⟧－C1＋C2－C3＋180°＝0',
  ],
  '04202-03-045': [
    'ω＝⟦φ_{AB}⟧－⟦φ_{DE}⟧＋180°－C1＋C2－C3',
    'ω＝⟦φ_{DE}⟧－⟦φ_{AB}⟧＋180°－C1＋C2－C3',
    'ω＝⟦φ_{AB}⟧－⟦φ_{DE}⟧－C1＋C2－C3',
    'ω＝⟦φ_{DE}⟧－⟦φ_{AB}⟧－C1＋C2－C3',
  ],
  '04202-03-057': [
    '⟦\\frac{sin2·sin4·sin6}{sin1·sin3·sin5}=1⟧',
    '⟦\\frac{sin1·sin2·sin3}{sin4·sin5·sin6}=1⟧',
    '⟦\\frac{sin2+sin4+sin6}{sin1+sin3+sin5}=1⟧',
    '⟦\\frac{sin1+sin2+sin3}{sin4+sin5+sin6}=1⟧',
  ],
  '04202-03-066': [
    'ρ″·⟦\\frac{e}{S_{2}}⟧·sin(360°－φ)',
    'ρ″·⟦\\frac{e}{S_{1}}⟧·sin(360°－φ)',
    'ρ″·⟦\\frac{e}{S_{1}}⟧·sin(360°－φ＋r)',
    'ρ″·⟦\\frac{e}{S_{2}}⟧·sin(360°－φ＋r)',
  ],
  '04202-05-026': ['RL＝A', 'RL＝1/A', 'RL＝A²', 'RL＝1/A²'],
  '02100-08-011': ['～', '▽▽▽', '▽▽', '▽'],
  '11800-03-054': ['Windows 鍵+Ctrl+右方向鍵', 'Windows 鍵+Ctrl+下方向鍵', 'Windows 鍵+Ctrl+L', 'Windows 鍵+Ctrl+R'],
  '11800-03-056': ['Windows 鍵+Ctrl+D', 'Windows 鍵+Ctrl+A', 'Windows 鍵+Ctrl+C', 'Windows 鍵+Ctrl+L'],
  '11800-03-071': ['Windows 鍵+Ctrl+F1', 'Windows 鍵+Ctrl+F4', 'Windows 鍵+Ctrl+F8', 'Windows 鍵+Ctrl+F9'],
  '11800-03-078': ['Windows 鍵+Tab', 'Windows 鍵+Ctrl', 'Windows 鍵+Alt', 'Windows 鍵+Shift'],
  '02800-08-006': ['L₁ + L₂ ± M', 'M√(L₁ + L₂)', '⟦\\frac{M}{\\sqrt{L_{1}+L_{2}}}⟧', 'L₁ + L₂ ± 2M'],
  '02800-08-012': ['0.886', '1/√2', '√3/2', '0.5'],
  '02800-08-013': ['⟦\\frac{1}{2π\\sqrt{LRC}}⟧', '⟦\\frac{1}{2πRC}⟧', '⟦\\frac{1}{2π\\sqrt{RC}}⟧', '⟦\\frac{1}{2π\\sqrt{LC}}⟧'],
  '02800-08-022': ['1/2', 'π/2', '√2/2', '2/π 倍'],
  '02800-08-080': ['√(R² + X_L²)', '√(R² + X_C²)', 'R', '√(R² + (X_L + X_C)²)'],
  '02800-08-089': ['5－j5√3', '5＋j5√3', '5√3＋j5', '5√3－j5'],
  '02800-09-010': ['0', '1', '√2', '√29'],
  '02800-09-029': ['β = α ÷ (1 + β)', 'β = (1 + α) ÷ α', 'β = α ÷ (α - 1)', 'β = α ÷ (1 - α)'],
  '02800-09-072': ['2 倍', '√2 倍', '1/2 倍', '1/√2 倍'],
  '02800-10-025': ['Q＝1，Q̅＝1', 'Q＝0，Q̅＝1', 'Q＝0，Q̅＝0', 'Q＝1，Q̅＝0'],
  '02800-10-026': ['A·B＝⟦\\overline{A+B}⟧', 'AB＝⟦\\overline{A}⟧＋⟦\\overline{B}⟧', '⟦\\overline{AB}⟧＝⟦\\overline{A+B}⟧', '⟦\\overline{AB}⟧＝⟦\\overline{A}⟧＋⟦\\overline{B}⟧'],
  '02800-10-030': ['B＋C', 'A·C̅＋B', 'BC＋C̅', 'B＋C̅'],
  '02800-10-003': ['F = DC + DB¬A + B¬A', 'F = DC + DB¬A + ¬CB¬A', 'F = DC + B¬A', 'F = BC + D¬A'],
  '02800-10-004': ['Y(X + Z)', '¬(¬(XY) + ¬(YZ))', 'XYZ', '¬(XYZ)'],
  '02800-10-005': ['¬(XY) + XY', '¬X·Y + X·¬Y', 'XY + XY', 'X + Y'],
  '02800-10-006': ['¬(XY) + ¬(WZ)', '¬(XY) + ¬W·¬Z', '¬(XYWZ)', '¬(XY)·¬(WZ)'],
  '02800-10-021': ['0', '1', 'A', '¬A'],
  '02800-10-023': ['Y = AB + ¬A·B', 'Y = ¬A·B + A·¬B', 'Y = AB + ¬(AB)', 'Y = A ⊕ B'],
  '02800-10-029': ['Y = A·B', 'Y = A + B', 'Y = ¬(AB)', 'Y = ¬(A + B)'],
  '02800-10-060': ['I₀I₁ = 00', 'I₀I₁ = 01', 'I₀I₁ = 10', 'I₀I₁ = 11'],
  '01300-04-085': ['V', '⅄', '雙⅄', '雙△'],
  '01300-05-061': ['R + X', '√(R² + X²)', '⟦\\frac{R}{\\sqrt{R^{2}+X^{2}}}⟧', '⟦\\frac{X}{\\sqrt{R^{2}+X^{2}}}⟧'],
  '01300-05-063': ['3倍', '√3倍', '1/3倍', '1/√3倍'],
  // Looked like a graphical-option question (three blank ①②③ markers), but
  // checking the rendered PDF page showed plain "1/2π√(...)" formulas, not
  // circuit diagrams — the radical/vinculum glyphs just didn't extract as
  // inline text the way option 4 on the same line did. Text beats an image
  // crop for learner quality here.
  '11700-05-051': ['1/2π√(R1C1)', '1/2π√(R3R4C1C2)', '1/2π√(R1R2C1C2)', '1/2π(R3+R4)(C1+C2)'],
  // These are vector fractions/formulas in the official PDF, not diagrams.
  // Keep them selectable and legible in dark mode instead of shipping four
  // fuzzy screenshots per question.
  '17600-01-033': ['T₁ = (T + A) / (A + B)', 'T₁ = (T × A) / (A + B)', 'T₁ = (T × A) / (A × B)', 'T₁ = (T - A) / (A - B)'],
  '17600-01-057': ['3/4 英吋', '1 1/8 英吋', '9/16 英吋', '9/12 英吋'],
  '17600-01-058': ['3/4 英吋', '1 1/8 英吋', '9/16 英吋', '9/12 英吋'],
  '17600-01-066': ['1/32 英吋', '1/16 英吋', '1/8 英吋', '3/16 英吋'],
  '17600-04-046': ['1800 呎', '24000 呎', '30000 呎', '36000 呎'],
  '17600-04-142': ['飛機型別核照資料表（TCDS）', '發動機型別核照資料表（TCDS）', '螺旋槳型別核照資料表（TCDS）', '螺旋槳經歷紀錄簿'],
  '17600-06-023': ['4W', '8W', '12W', '16W'],
  '17600-06-026': ['4A', '8A', '12A', '16A'],
  '17600-06-033': ['5A', '2√2 A', '2A', '1A'],
}

const NO_SOURCE_PAGE_IMAGE = new Set(['07700-03-003'])

const GENERAL_COMMON_BANKS = [
  { code: '90006', file: '900060A12-raw.txt', expected: 100, version: 'A12' },
  { code: '90007', file: '900070A11-raw.txt', expected: 100, version: 'A11' },
  { code: '90008', file: '900080A18-raw.txt', expected: 100, version: 'A18' },
  { code: '90009', file: '900090A14-raw.txt', expected: 100, version: 'A14' },
]

// 機工相關職類共用 (90001), 116-01-01 起: separate 丙/乙 banks under one subject
// code. Loaded from the reviewed staged banks (official PDF parse + script
// glyphs + formula transcriptions, each checked against the PDF image; the
// before/after list is source/<stem>-fixes.json). Their image maps belong to the
// bank, not the pack, so a pack's own figure questions keep their own images.
const MACHINERY_COMMON_BANKS = [
  {
    key: '90001-2',
    code: '90001',
    parsedFile: '900012A13-questions.json',
    imageMapFile: '900012A13-image-map.json',
    expected: 609,
    version: 'A13',
    // The PDF draws the litre sign as a script ℓ image; type it instead.
    promptOverrides: { '90001-08-002': '液壓油以流量 25 ℓ/min 通過內徑 11mm 之油壓管，其流速約為' },
    // The embedded option images are damaged (②: a stroke the PDF clips away;
    // ④: the 2 cut at the bottom), so type the fractions (sin 30° = ①).
    optionOverrides: { '90001-02-048': ['⟦\\frac{1}{2}⟧', '⟦\\frac{1}{\\sqrt{3}}⟧', '⟦\\frac{1}{\\sqrt{2}}⟧', '⟦\\frac{\\sqrt{3}}{2}⟧'] },
    textOnlyIds: ['90001-08-002', '90001-02-048'],
  },
  { key: '90001-3', code: '90001', parsedFile: '900013A13-questions.json', imageMapFile: '900013A13-image-map.json', expected: 597, version: 'A13' },
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
    extraCommonCodes: ['90012'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90012', count: 16 }],
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
    extraCommonCodes: ['90012'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90012', count: 16 }],
    },
  },
  {
    examId: 'employment-service-b',
    titleZh: '就業服務乙級',
    titleEn: 'Employment Service (Class B)',
    level: '乙級',
    category: '商業服務',
    occupationCode: '19500',
    occupationFile: '195002A18-raw.txt',
    occupationExpected: 1250,
    version: 'A18',
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
    extraCommonCodes: ['90011'],
    mockRules: {
      occupationQuota: 52,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90011', count: 12 }],
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
    // 11800-03-054/056/071/078 option overrides belong to the 丙級 PDF; without
    // isolation they replaced four unrelated 乙級 questions' options.
    isolatedOccupation: true,
    occupationFile: '118002A15-raw.txt',
    occupationExpected: 776,
    version: 'A15',
    extraCommonCodes: ['90011'],
    cropPrefix: '118002',
    requireQuestionCrops: true,
    mockRules: {
      occupationQuota: 55,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [{ subjectCode: '90011', count: 9 }],
    },
  },
  {
    examId: 'industrial-wiring-c',
    titleZh: '工業配線丙級',
    titleEn: 'Industrial Wiring (Class C)',
    level: '丙級',
    category: '電機工程',
    occupationCode: '01300',
    occupationFile: '013003A13-raw.txt',
    occupationExpected: 600,
    version: 'A13',
    extraCommonCodes: [],
    cropPrefix: '013003',
    requireQuestionCrops: true,
    splitImageOptions: true,
    excludedFigureIds: ['01300-04-085', '01300-05-061', '01300-05-063'],
    // The PDF draws the wye symbol ⅄ (Y－△) and √3 as graphics; the text
    // layer drops them (ink scan). Text otherwise as built.
    promptOverrides: {
      '01300-04-059': '三只單相 220V/110V 之變壓器，一次接成 ⅄，二次接成△，一次側線電壓為 220V 時，其二次側電壓應為',
      '01300-04-083': '可使用 ⅄－△起動器之電動機為',
      '01300-04-086': '感應電動機採用 ⅄－△起動時，其起動電流為△接之',
    },
    optionOverrides: {
      '01300-04-086': ['3 倍', '1/3 倍', '1/⟦\\sqrt{3}⟧ 倍', '相等'],
    },
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
    extraCommonCodes: [],
    cropPrefix: '007003',
    requireQuestionCrops: true,
    splitImageOptions: true,
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
    examId: 'refrigeration-ac-b',
    titleZh: '冷凍空調裝修乙級',
    titleEn: 'Refrigeration and Air Conditioning Installation (Class B)',
    level: '乙級',
    category: '電機工程',
    occupationCode: '00100',
    occupationSourceKey: '00100-2',
    isolatedOccupation: true,
    occupationFile: '001002A12-raw.txt',
    occupationExpected: 799,
    version: 'A12',
    extraCommonCodes: [],
    // Formula options typed in typedTextFixes.mjs instead of cropped.
    excludedFigureIds: ['00100-05-012', '00100-05-018', '00100-05-028', '00100-05-055'],
    cropPrefix: '001002A12',
    // scripted_tokens.py: nearly every formula and unit is split (restoreScriptsDense).
    restoreScripts: 'dense',
    splitImageOptions: true,
    inactiveIds: ['00100-05-059', '00100-06-069'],
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
    examId: 'refrigeration-ac-c',
    titleZh: '冷凍空調裝修丙級',
    titleEn: 'Refrigeration and Air Conditioning Installation (Class C)',
    level: '丙級',
    category: '電機工程',
    occupationCode: '00100',
    occupationSourceKey: '00100-3',
    isolatedOccupation: true,
    occupationFile: '001003A11-raw.txt',
    occupationExpected: 662,
    version: 'A11',
    extraCommonCodes: [],
    // The parser took the ℓ in 「(ℓ/min)」 for a figure; it is typed instead.
    excludedFigureIds: ['00100-08-026', '00100-05-038'],
    cropPrefix: '001003A11',
    // scripted_tokens.py: nearly every formula and unit is split (restoreScriptsDense).
    restoreScripts: 'dense',
    splitImageOptions: true,
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
    extraCommonCodes: ['90010'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
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
    extraCommonCodes: ['90010'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
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
    examId: 'motorcycle-repair-c',
    titleZh: '機器腳踏車修護丙級',
    titleEn: 'Motorcycle Repair (Class C)',
    level: '丙級',
    category: '車輛修護',
    occupationCode: '14500',
    occupationFile: '145003A13-raw.txt',
    occupationExpected: 599,
    version: 'A13',
    extraCommonCodes: [],
    cropPrefix: '145003',
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
    examId: 'aircraft-maintenance-c',
    titleZh: '飛機修護丙級',
    titleEn: 'Aircraft Maintenance (Class C)',
    level: '丙級',
    category: '航空修護',
    occupationCode: '17600',
    occupationFile: '176003A12-raw.txt',
    occupationExpected: 643,
    version: 'A12',
    extraCommonCodes: [],
    cropPrefix: '176003',
    requireQuestionCrops: true,
    includeLeftFigures: true,
    excludedFigureIds: [
      '17600-01-033', '17600-01-057', '17600-01-058', '17600-01-066',
      '17600-04-046', '17600-06-033',
    ],
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
    extraCommonCodes: ['90012'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90012', count: 16 }],
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
    examId: 'electrical-equipment-inspection-c',
    titleZh: '用電設備檢驗丙級',
    titleEn: 'Electrical Equipment Inspection (Class C)',
    level: '丙級',
    category: '電機工程',
    occupationCode: '16600',
    occupationFile: '166003A15-raw.txt',
    occupationExpected: 685,
    version: 'A15',
    extraCommonCodes: [],
    cropPrefix: '166003',
    requireQuestionCrops: true,
    splitImageOptions: true,
    figureIds: ['16600-04-008'],
    // The PDF draws √3 as a graphic; the text layer drops it (ink scan).
    optionOverrides: {
      '16600-02-058': ['線電壓為相電壓之 3 倍', '線電壓為相電壓之 1/⟦\\sqrt{3}⟧ 倍', '線電壓為相電壓之 ⟦\\sqrt{3}⟧ 倍', '線電壓與相電壓相同'],
    },
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
    occupationFile: '222002A16-raw.txt',
    occupationExpected: 954,
    version: 'A16',
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
    examId: 'occupational-safety-management-a',
    titleZh: '職業安全管理甲級',
    titleEn: 'Occupational Safety Management (Class A)',
    level: '甲級',
    category: '職業安全衛生',
    occupationCode: '22000',
    occupationFile: '220001A15-raw.txt',
    occupationExpected: 615,
    version: 'A15',
    extraCommonCodes: [],
    cropPrefix: '220001',
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
    examId: 'occupational-hygiene-management-a',
    titleZh: '職業衛生管理甲級',
    titleEn: 'Occupational Hygiene Management (Class A)',
    level: '甲級',
    category: '職業安全衛生',
    occupationCode: '22100',
    occupationFile: '221001A14-raw.txt',
    occupationExpected: 722,
    version: 'A14',
    extraCommonCodes: [],
    cropPrefix: '221001',
    requireQuestionCrops: true,
    splitImageOptions: true,
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
    occupationFile: '151004A15-raw.txt',
    occupationExpected: 613,
    version: 'A15',
    extraCommonCodes: [],
    cropPrefix: '151004A15',
    // scripted_tokens.py on 151004A15: CO₂ and kg/cm² (restoreScripts); H₂SO₄,
    // PbO₂ and m/s² no rule covers cleanly.
    restoreScripts: true,
    optionOverrides: {
      '15100-01-162': ['純鉛（Pb）', '硫酸（H₂SO₄）', '氫氧化鈉（NaOH）', '過氧化鉛（PbO₂）'],
      '15100-03-148': ['9.8m/s²', '980m/s²', '1m/s²', '1cm/s²'],
    },
    requireQuestionCrops: true,
    splitImageOptions: true,
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
    examId: 'loader-operation-single',
    titleZh: '重機械操作－鏟裝機單一級',
    titleEn: 'Loader Operation (Single Level)',
    level: '單一級',
    category: '機械操作',
    occupationCode: '07004',
    occupationFile: '070044A12-raw.txt',
    occupationExpected: 676,
    version: 'A12',
    extraCommonCodes: [],
    cropPrefix: '070044',
    requireQuestionCrops: true,
    splitImageOptions: true,
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
    extraCommonCodes: [],
    requireQuestionCrops: true,
    splitImageOptions: true,
    mixedFigureOptionIds: ['12600-01-043', '12600-01-044', '12600-01-045'],
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
    examId: 'engineering-surveying-b',
    titleZh: '測量－工程測量乙級',
    titleEn: 'Engineering Surveying (Class B)',
    level: '乙級',
    category: '營造工程',
    occupationCode: '04202',
    occupationFile: '042022A11-raw.txt',
    occupationExpected: 769,
    version: 'A11',
    extraCommonCodes: [],
    cropPrefix: '042022',
    requireQuestionCrops: true,
    splitImageOptions: true,
    excludedFigureIds: [
      '04202-01-103', '04202-02-011', '04202-02-048', '04202-02-073',
      '04202-03-023', '04202-05-026', '04202-06-028',
    ],
    mixedFigureOptionIds: [
      '04202-03-029', '04202-03-030', '04202-03-031', '04202-03-032',
      '04202-03-034', '04202-03-045', '04202-03-057', '04202-03-066',
      '04202-04-041', '04202-04-076',
    ],
    inactiveIds: [
      '04202-01-080', '04202-01-081', '04202-01-082', '04202-01-083',
      '04202-01-084', '04202-01-085', '04202-01-086', '04202-01-087',
      '04202-02-059', '04202-02-071', '04202-03-195',
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
    // 042003A11 crops reviewed by Jared against the official PDF pages
    // (docs/staged-image-qa-042003A11.md). Formula glyphs pdftotext drops are
    // transcribed in surveyingQuestionOverrides.mjs; answer keys untouched.
    examId: 'surveying-c',
    titleZh: '測量丙級',
    titleEn: 'Surveying (Class C)',
    level: '丙級',
    category: '營造工程',
    occupationCode: '04200',
    occupationFile: '042003A11-raw.txt',
    occupationExpected: 704,
    version: 'A11',
    extraCommonCodes: [],
    cropPrefix: '042003',
    requireQuestionCrops: true,
    splitImageOptions: true,
    // 本題刪題 in the official PDF; kept for provenance, never practised.
    inactiveIds: ['04200-01-033'],
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
    // Crops signed off by Jared (docs/staged-image-qa-201003A12.md). The six
    // inactive ids carry 「(本題刪題)」 in the official PDF.
    examId: 'visual-communication-design-c',
    titleZh: '視覺傳達設計丙級',
    titleEn: 'Visual Communication Design (Class C)',
    level: '丙級',
    category: '商業服務',
    occupationCode: '20100',
    occupationFile: '201003A12-raw.txt',
    occupationExpected: 608,
    version: 'A12',
    extraCommonCodes: [],
    cropPrefix: '201003',
    requireQuestionCrops: true,
    splitImageOptions: true,
    // 三視圖: a 3D-object prompt figure plus four option images each.
    mixedFigureOptionIds: Array.from({ length: 20 }, (_, index) => `20100-05-${String(index + 1).padStart(3, '0')}`),
    // Flagged by the parser for a gap before 「。」; it is plain text.
    excludedFigureIds: ['20100-03-040'],
    inactiveIds: [
      '20100-02-069', '20100-03-045', '20100-04-029',
      '20100-04-036', '20100-04-085', '20100-05-053',
    ],
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
    // Text-only bank: 0 figure questions, 0 本題刪題, 770/770 keys agree.
    examId: 'international-trade-c',
    titleZh: '國貿業務丙級',
    titleEn: 'International Trade (Class C)',
    level: '丙級',
    category: '商業服務',
    occupationCode: '20000',
    occupationFile: '200003A13-raw.txt',
    occupationExpected: 770,
    version: 'A13',
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
    examId: 'beverage-preparation-c',
    titleZh: '飲料調製丙級',
    titleEn: 'Beverage Preparation (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '20600',
    occupationFile: '206003A13-raw.txt',
    occupationExpected: 617,
    version: 'A13',
    extraCommonCodes: ['90010'],
    excludedFigureIds: ['20600-03-058'],
    requireQuestionCrops: true,
    splitImageOptions: true,
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
    },
  },
  {
    examId: 'dining-service-c',
    titleZh: '餐飲服務丙級',
    titleEn: 'Dining Service (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '21500',
    occupationFile: '215003A11-raw.txt',
    occupationExpected: 524,
    version: 'A11',
    extraCommonCodes: ['90010'],
    cropPrefix: '215003',
    requireQuestionCrops: true,
    splitImageOptions: true,
    inactiveIds: ['21500-01-103', '21500-02-032', '21500-04-024', '21500-06-049'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
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
    examId: 'machining-c',
    titleZh: '機械加工丙級',
    titleEn: 'Machining (Class C)',
    level: '丙級',
    category: '金屬及機械加工',
    occupationCode: '18500',
    occupationFile: '185003A10-raw.txt',
    occupationExpected: 500,
    version: 'A10',
    extraCommonCodes: ['90001-3'],
    inactiveIds: ['18500-02-020', '18500-04-261'],
    excludedFigureIds: ['18500-06-015', '18500-06-016'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90001', count: 16, single: 16, multiple: 0 }],
    },
  },
  {
    examId: 'lathe-c',
    titleZh: '車床－車床丙級',
    titleEn: 'Lathe Operation (Class C)',
    level: '丙級',
    category: '金屬及機械加工',
    occupationCode: '18300',
    occupationFile: '183003A10-raw.txt',
    occupationExpected: 612,
    version: 'A10',
    extraCommonCodes: ['90001-3'],
    // Typed in typedTextFixes.mjs (tolerance / 咔咔 / k formula); no crop.
    excludedFigureIds: ['18300-05-176', '18300-07-027'],
    cropPrefix: '183003A10',
    // scripted_tokens.py: nearly every formula and unit is split (restoreScriptsDense).
    restoreScripts: 'dense',
    splitImageOptions: true,
    inactiveIds: ['18300-04-054', '18300-05-210', '18300-08-012'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90001', count: 16, single: 16, multiple: 0 }],
    },
  },
  {
    examId: 'heat-treatment-c',
    titleZh: '熱處理丙級',
    titleEn: 'Heat Treatment (Class C)',
    level: '丙級',
    category: '金屬及機械加工',
    occupationCode: '02100',
    occupationFile: '021003A12-raw.txt',
    occupationExpected: 609,
    version: 'A12',
    extraCommonCodes: [],
    cropPrefix: '021003',
    splitImageOptions: true,
    excludedFigureIds: ['02100-03-009', '02100-08-011'],
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
    examId: 'computer-hardware-repair-b',
    titleZh: '電腦硬體裝修乙級',
    titleEn: 'Computer Hardware Repair (Class B)',
    level: '乙級',
    category: '資訊',
    occupationCode: '12000',
    occupationSourceKey: '12000-2',
    isolatedOccupation: true,
    occupationFile: '120002A13-raw.txt',
    occupationExpected: 708,
    version: 'A13',
    extraCommonCodes: ['90011'],
    cropPrefix: '120002A13',
    requireQuestionCrops: true,
    splitImageOptions: true,
    mixedFigureOptionIds: ['12000-01-020', '12000-01-021'],
    // Circuits, a truth table and K-maps the PDF draws as graphics with no
    // figure marker in the text (uncovered-ink scan of 120002A13).
    figureIds: ['12000-01-027', '12000-01-036', '12000-02-058', '12000-02-059', '12000-02-060', '12000-02-063', '12000-02-064'],
    mockRules: {
      occupationQuota: 55,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90011', count: 9 }],
    },
  },
  {
    examId: 'computer-hardware-repair-c',
    titleZh: '電腦硬體裝修丙級',
    titleEn: 'Computer Hardware Repair (Class C)',
    level: '丙級',
    category: '資訊',
    occupationCode: '12000',
    occupationFile: '120003A13-raw.txt',
    occupationExpected: 606,
    version: 'A13',
    extraCommonCodes: ['90011'],
    cropPrefix: '120003A13',
    requireQuestionCrops: true,
    splitImageOptions: true,
    mixedFigureOptionIds: ['12000-01-003'],
    // C++ / Visual Basic code the PDF draws as graphics with no figure marker
    // in the text (uncovered-ink scan of 120003A13).
    figureIds: ['12000-03-034', '12000-03-035', '12000-03-036', '12000-03-038', '12000-03-039', '12000-05-095', '12000-05-096', '12000-05-097'],
    // Powers the text layer flattens (「16×2 1 0」), checked on the PDF image.
    optionOverrides: { '12000-04-017': ['16×2¹⁰', '16×10¹⁰', '16×2³⁰', '16×10³⁰'] },
    mockRules: {
      occupationQuota: 52,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90011', count: 12 }],
    },
  },
  {
    examId: 'network-installation-c',
    titleZh: '網路架設丙級',
    titleEn: 'Network Installation (Class C)',
    level: '丙級',
    category: '資訊',
    occupationCode: '17200',
    occupationFile: '172003A14-raw.txt',
    occupationExpected: 486,
    version: 'A14',
    extraCommonCodes: ['90011'],
    cropPrefix: '172003',
    requireQuestionCrops: true,
    splitImageOptions: true,
    mockRules: {
      occupationQuota: 52,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90011', count: 12 }],
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
    extraCommonCodes: [],
    cropPrefix: '016003',
    requireQuestionCrops: true,
    splitImageOptions: true,
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
    examId: 'gas-appliance-installation-c',
    titleZh: '特定瓦斯器具裝修丙級',
    titleEn: 'Gas Appliance Installation (Class C)',
    level: '丙級',
    category: '銲接配管',
    occupationCode: '15500',
    occupationFile: '155003A13-raw.txt',
    occupationExpected: 625,
    version: 'A13',
    extraCommonCodes: [],
    // Formula options typed in typedTextFixes.mjs instead of cropped.
    excludedFigureIds: ['15500-01-086'],
    cropPrefix: '155003A13',
    // scripted_tokens.py: nearly every formula and unit is split (restoreScriptsDense).
    restoreScripts: 'dense',
    splitImageOptions: true,
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
    extraCommonCodes: ['90010'],
    excludedFigureIds: ['14000-03-060'],
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
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
    extraCommonCodes: ['90001-2'],
    cropPrefix: '182012',
    embeddedImageMapFiles: ['182012A10-image-map.json'],
    requireQuestionCrops: true,
    // The PDF draws the diameter sign ⌀ as a graphic; the text layer drops it (ink scan).
    promptOverrides: {
      '18201-03-100': '在平面上擬銑切直徑 ⌀21.6±0.1 ㎜、深 20 ㎜之貫通孔，一般宜使用',
    },
    optionOverrides: {
      '18201-03-100': ['⌀21.6 ㎜之 4 刃端銑刀', '中心鑽、⌀21.6 ㎜之 2 刃端銑刀', '中心鑽、⌀18 ㎜鑽頭、⌀20 ㎜之 4 刃端銑刀', '⌀18 ㎜鑽頭、⌀21.6 ㎜之 2 刃端銑刀'],
    },
    mockRules: {
      // 90001 乙級: 10 single + 6 multiple (技檢中心 115.10.15 技發字第1151301425號).
      occupationQuota: 48,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [{ subjectCode: '90001', count: 16, single: 10, multiple: 6 }],
    },
  },
  {
    examId: 'chinese-cooking-vegetarian-c',
    titleZh: '中餐烹調－素食丙級',
    titleEn: 'Chinese Cooking: Vegetarian (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '07601',
    occupationFile: '076013A11-raw.txt',
    occupationExpected: 507,
    version: 'A11',
    extraCommonCodes: ['90010'],
    inactiveIds: ['07601-03-046', '07601-11-056'],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
    },
  },
  {
    examId: 'chinese-cooking-meat-b',
    titleZh: '中餐烹調－葷食乙級',
    titleEn: 'Chinese Cooking: Meat (Class B)',
    level: '乙級',
    category: '餐飲食品',
    occupationCode: '07602',
    occupationSourceKey: '07602-2',
    isolatedOccupation: true,
    // Official stem follows the options (「①…④ X 不但…」); the parser left the
    // prompt empty and glued the stem onto option 4. Blank marks where it sits.
    promptOverrides: { '07602-06-003': '＿＿＿＿容易生銹，使用後須清洗乾淨並晾乾。' },
    optionOverrides: { '07602-06-003': ['鐵炒鍋', '鋁炒鍋', '琺瑯鍋', '不銹鋼炒鍋'] },
    occupationFile: '076022A11-raw.txt',
    occupationExpected: 676,
    version: 'A11',
    extraCommonCodes: ['90010'],
    inactiveIds: ['07602-07-074', '07602-10-038', '07602-10-039', '07602-10-045', '07602-10-062', '07602-10-070'],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
    mockRules: {
      occupationQuota: 48,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
    },
  },
  {
    examId: 'beauty-b',
    titleZh: '美容乙級',
    titleEn: 'Beauty Care (Class B)',
    level: '乙級',
    category: '美容美髮',
    occupationCode: '10000',
    occupationSourceKey: '10000-2',
    isolatedOccupation: true,
    // Official stem follows the options (「①…④ X 不但…」); the parser left the
    // prompt empty and glued the stem onto option 4. Blank marks where it sits.
    promptOverrides: { '10000-03-003': '＿＿＿＿不但會破壞細胞膜，並且具有使蛋白質及酵素產生變化的特性，可說是皮膚老化的一大元凶。' },
    optionOverrides: { '10000-03-003': ['玻璃醣醛酸', '保濕因子', '過氧化脂質', '磷脂質'] },
    occupationFile: '100002A12-raw.txt',
    occupationExpected: 682,
    version: 'A12',
    extraCommonCodes: ['90012'],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
    mockRules: {
      occupationQuota: 48,
      singleCount: 60,
      multipleCount: 20,
      weightSingle: 1,
      weightMultiple: 2,
      extraSubjectQuota: [{ subjectCode: '90012', count: 16 }],
    },
  },
  {
    examId: 'pressure-vessel-operation-single',
    titleZh: '第一種壓力容器操作單一級',
    titleEn: 'Class 1 Pressure Vessel Operation (Single Level)',
    level: '單一級',
    category: '機械操作',
    occupationCode: '09900',
    occupationFile: '099004A15-raw.txt',
    occupationExpected: 670,
    version: 'A15',
    extraCommonCodes: [],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
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
    examId: 'boiler-operation-b',
    titleZh: '鍋爐操作乙級',
    titleEn: 'Boiler Operation (Class B)',
    level: '乙級',
    category: '機械操作',
    occupationCode: '03100',
    occupationFile: '031002A12-raw.txt',
    occupationExpected: 691,
    version: 'A12',
    extraCommonCodes: [],
    // Typed in typedTextFixes.mjs (tolerance / 咔咔 / k formula); no crop.
    excludedFigureIds: ['03100-03-027', '03100-01-225'],
    cropPrefix: '031002A12',
    // scripted_tokens.py: nearly every formula and unit is split (restoreScriptsDense).
    restoreScripts: 'dense',
    splitImageOptions: true,
    inactiveIds: ['03100-01-103', '03100-01-121'],
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
    examId: 'horticulture-c',
    titleZh: '園藝丙級',
    titleEn: 'Horticulture (Class C)',
    level: '丙級',
    category: '農業園藝',
    occupationCode: '13300',
    occupationFile: '133003A13-raw.txt',
    occupationExpected: 687,
    version: 'A13',
    extraCommonCodes: [],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
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
    examId: 'funeral-service-c',
    titleZh: '喪禮服務丙級',
    titleEn: 'Funeral Service (Class C)',
    level: '丙級',
    category: '生活服務',
    occupationCode: '20300',
    occupationSourceKey: '20300-3',
    isolatedOccupation: true,
    occupationFile: '203003A12-raw.txt',
    occupationExpected: 610,
    version: 'A12',
    extraCommonCodes: [],
    inactiveIds: ['20300-01-012', '20300-02-161', '20300-02-169'],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
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
    examId: 'funeral-service-b',
    titleZh: '喪禮服務乙級',
    titleEn: 'Funeral Service (Class B)',
    level: '乙級',
    category: '生活服務',
    occupationCode: '20300',
    occupationSourceKey: '20300-2',
    isolatedOccupation: true,
    occupationFile: '203002A14-raw.txt',
    occupationExpected: 599,
    version: 'A14',
    extraCommonCodes: [],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
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
    examId: 'folk-massage-single',
    titleZh: '民俗調理業傳統整復推拿單一級',
    titleEn: 'Traditional Folk Massage (Single Level)',
    level: '單一級',
    category: '生活服務',
    occupationCode: '22600',
    occupationFile: '226004A14-raw.txt',
    occupationExpected: 642,
    version: 'A14',
    extraCommonCodes: [],
    // Text-only bank: sub/superscripts verified against the PDF's word boxes.
    restoreScripts: true,
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
    examId: 'chemistry-c',
    titleZh: '化學丙級',
    titleEn: 'Chemistry (Class C)',
    level: '丙級',
    category: '化學工業',
    occupationCode: '03000',
    // Formula-heavy bank: sub/superscripts come from the PDF's word boxes
    // (scripts/scriptedText.mjs), not from the regex repair other packs use.
    occupationFile: '030003A12-scripted-raw.txt',
    occupationExpected: 628,
    version: 'A12',
    extraCommonCodes: [],
    // Text questions: the run of spaces a line wrap left would force a figure.
    excludedFigureIds: ['03000-01-194'],
    promptOverrides: {
      // No Unicode subscript y: keep the unknowns inline so x and y match.
      '03000-01-014': '氣體（NxOy）0.896 克，在 730mmHg 及 28℃時，體積為 524mL，則',
      '03000-04-182': 'CxHy 的燃燒反應式如下：CxHy+2O₂ → CO₂+2H₂O，其名稱為',
      // A line wrap left a run of spaces after the exponent.
      '03000-01-194': '將容器壓力降至大氣壓以下的裝置稱為真空泵，若真空範圍在 1~10⁻⁵ Torr，下列名稱何者正確',
      // The parser joins spaced capitals ("O NH" → "ONH"); keep the PDF's gap.
      // The official PDF prints no equilibrium arrow between H₂O and NH₄⁺.
      '03000-02-175': '若反應 NH₃+ H₂O NH₄⁺ + OH⁻ 已達成平衡，再加入 NH₃ 則反應會向哪一方向移動',
      // The PDF draws the stacked mass/atomic numbers as graphics; the text layer has only Ｕ.
      '03000-04-022': '²³⁸₉₂U 原子核的中子數為',
    },
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
    examId: 'food-analysis-c',
    titleZh: '食品檢驗分析丙級',
    titleEn: 'Food Testing and Analysis (Class C)',
    level: '丙級',
    category: '餐飲食品',
    occupationCode: '09200',
    // Sub/superscripts come from the PDF's word boxes (scripts/scriptedText.mjs).
    occupationFile: '092003A11-scripted-raw.txt',
    occupationExpected: 535,
    version: 'A11',
    extraCommonCodes: ['90010'],
    inactiveIds: ['09200-02-046'],
    // Text question: the gap the dropped ℓ left would otherwise force a figure.
    excludedFigureIds: ['09200-04-013'],
    // Glyphs the PDF draws as graphics never reach its text layer (found by
    // rendering each page and listing ink no word box covers): 酞, 苷, the
    // italic o of o-Tolidine and the script ℓ. Wording otherwise as printed.
    promptOverrides: {
      '09200-01-122': '實驗室使用之酚酞指示劑，配製之溶劑為',
      '09200-05-001': '測定水質之餘氯時，所加之試劑鄰妥立定(o-Tolidine)是',
      '09200-05-017': '殘氯測定方法中 o-tolidine 與水中殘氯分子反應所呈現之顏色應為',
    },
    optionOverrides: {
      '09200-01-111': ['酚酞', '甲基紅', '甲基橙', '溴鉀酚綠(bromocresol green)'],
      '09200-04-013': ['1 lb/in²', '15 lb/in²', '30 lb/in²', '50 lb/in²'],
      '09200-08-012': ['胺基酸', '核苷酸', '麩胺酸鈉', '三甲基胺'],
    },
    mockRules: {
      occupationQuota: 48,
      singleCount: 80,
      multipleCount: 0,
      weightSingle: 1.25,
      weightMultiple: 0,
      extraSubjectQuota: [{ subjectCode: '90010', count: 16 }],
    },
  },
]

const BEAUTY_HAIR_COMMON_BANK = {
  code: '90012',
  file: '900120A11-raw.txt',
  expected: 300,
  version: 'A11',
  quota: 4,
}

const FOOD_COMMON_BANK = {
  code: '90010',
  file: '900100A17-raw.txt',
  expected: 281,
  version: 'A17',
  quota: 4,
}

const INFORMATION_COMMON_BANK = {
  code: '90011',
  file: '900110A13-raw.txt',
  expected: 120,
  version: 'A13',
  quota: 4,
}

// Figures the parser missed (restoredFigures.mjs): force them as figure questions
// with their reviewed crops, and attach per-option symbols to CNS legend questions.
// Text the parser dropped (typedTextFixes.mjs) becomes exam text overrides.
for (const exam of EXAMS) {
  const restored = restoredFigureIds(exam.occupationFile)
  if (restored.length) exam.figureIds = [...(exam.figureIds ?? []), ...restored]
  const symbols = symbolOptionIds(exam.occupationFile)
  if (symbols.length) exam.symbolOptionIds = [...(exam.symbolOptionIds ?? []), ...symbols]
  // Text the PDF draws as graphics (typedTextFixes.mjs), transcribed from the page.
  for (const [id, fix] of Object.entries(typedTextFixes(exam.occupationFile))) {
    if (exam.promptOverrides?.[id] || exam.optionOverrides?.[id]) throw new Error(`${exam.examId}: ${id} already has a text override`)
    if (fix.prompt) exam.promptOverrides = { ...exam.promptOverrides, [id]: fix.prompt }
    if (fix.options) exam.optionOverrides = { ...exam.optionOverrides, [id]: fix.options }
  }
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
  // public/question-pages/90011-page-*.jpg are renders of the old A12 PDF.
  if (question.subjectCode === '90011') return undefined
  return `/question-pages/${question.subjectCode}-page-${question.sourcePage}.jpg`
}

async function loadParsed(bank) {
  if (bank.parsedFile) return loadReviewedBank(bank)
  const source = await readFile(new URL(`../source/${bank.file}`, import.meta.url), 'utf8')
  const parsed = parseQuestionBank(source)
  if (parsed.length !== bank.expected) {
    throw new Error(`${bank.code}: expected ${bank.expected} questions, received ${parsed.length}`)
  }
  return parsed
}

// A staged bank whose text was reviewed question by question: no re-parse.
// Each question carries its own images (`bankImages`, [] = text only).
async function loadReviewedBank(bank) {
  const questions = JSON.parse(await readFile(new URL(`../source/${bank.parsedFile}`, import.meta.url), 'utf8'))
  if (questions.length !== bank.expected) {
    throw new Error(`${bank.key}: expected ${bank.expected} questions, received ${questions.length}`)
  }
  const imageMap = JSON.parse(await readFile(new URL(`../source/${bank.imageMapFile}`, import.meta.url), 'utf8')).questions
  return Promise.all(questions.map(async (question) => {
    const bankImages = bank.textOnlyIds?.includes(question.id) ? [] : imageMap[question.id] ?? []
    for (const file of bankImages) {
      try {
        await readFile(new URL(`../public/question-images/${file}`, import.meta.url))
      } catch {
        throw new Error(`${bank.key}: ${question.id} is missing image ${file}`)
      }
    }
    return {
      ...question,
      prompt: bank.promptOverrides?.[question.id] ?? question.prompt,
      options: bank.optionOverrides?.[question.id] ?? question.options,
      bankImages,
    }
  }))
}

function cropFileName(exam, question) {
  return `${exam.cropPrefix ? `${exam.cropPrefix}-` : ''}${question.id}.png`
}

function generatedImageSources(exam, question, bankImages) {
  if (bankImages) return bankImages.length ? bankImages.map(questionImagePath) : undefined
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
  // Question ids are subject + section + number, so a second level of the same
  // occupation (07602 丙/乙, 10000 丙/乙) reuses ids. The global id-keyed
  // overrides below were written for one specific PDF; an isolated pack takes
  // only its own exam-level overrides for its occupation questions.
  const isolated = Boolean(exam.isolatedOccupation) && question.subjectCode === exam.occupationCode
  const globalFor = (map) => (isolated ? undefined : map[question.id])
  const sourcePage = globalFor(SOURCE_PAGE_OVERRIDES) ?? question.sourcePage
  const imageOverrides = globalFor(IMAGE_OVERRIDES)
  const codeOverride = globalFor(CODE_BLOCK_OVERRIDES)
  const surveyingSource = exam.occupationFile === SURVEYING_SOURCE_FILE
  const surveyingTextOnly = surveyingSource
    && Boolean(SURVEYING_QUESTION_OVERRIDES[question.id])
    && !SURVEYING_FIGURE_IDS.includes(question.id)
  const forceFigure = (!isolated && FIGURE_QUESTION_IDS.has(question.id))
    || exam.figureIds?.includes(question.id)
    // Reviewed 042003A11 crops: tables like 04200-04-132 ("下表為…") carry no
    // figure marker the parser can see and no double-space gap, so without
    // this they would render as text with the table missing.
    || (surveyingSource && SURVEYING_FIGURE_IDS.includes(question.id))
    || (exam.includeLeftFigures && question.prompt.includes('左圖'))
    || / {2,}/.test(`${question.prompt}${question.options.join('')}`)
  const mappedFigure = question.bankImages
    ? question.bankImages.length > 0
    : exam.embeddedImageMap ? Boolean(exam.embeddedImageMap[question.id]?.length) : undefined
  // A transcribed code block replaces the figure entirely — keep it text.
  const hasFigure = codeOverride?.codeBlock || surveyingTextOnly
    ? false
    : mappedFigure ?? (!exam.excludedFigureIds?.includes(question.id) && (question.hasFigure || forceFigure))
  // Only the pack's own occupation PDF was checked for scripted tokens; shared
  // subjects stay byte-identical to every other pack that ships them.
  const clean = exam.restoreScripts && question.subjectCode === exam.occupationCode
    ? exam.restoreScripts === 'dense'
      ? (text) => restoreScriptsDense(sanitizeText(text))
      : (text) => restoreScripts(sanitizeText(text))
    : sanitizeText
  const repaired = {
    ...question,
    bankImages: undefined,
    examId: exam.examId,
    ...(codeOverride?.codeBlock ? { codeBlock: codeOverride.codeBlock } : {}),
    ...(codeOverride?.optionCodeBlocks ? { optionCodeBlocks: codeOverride.optionCodeBlocks } : {}),
    sourcePage,
    sectionTitle: (isolated ? undefined : SECTION_TITLE_OVERRIDES[question.section]) ?? question.sectionTitle,
    // Overrides skip clean(), so roots are drawn here for every text source.
    prompt: rootsToMath((surveyingSource ? SURVEYING_PROMPT_OVERRIDES[question.id] : undefined) ?? exam.promptOverrides?.[question.id] ?? globalFor(QUESTION_PROMPT_OVERRIDES) ?? clean(question.prompt)),
    options: ((surveyingSource ? SURVEYING_OPTION_OVERRIDES[question.id] : undefined) ?? exam.optionOverrides?.[question.id] ?? globalFor(QUESTION_OPTION_OVERRIDES) ?? question.options.map(clean)).map(rootsToMath),
    ...((!isolated && INACTIVE_IDS.has(question.id)) || exam.inactiveIds?.includes(question.id) ? { active: false } : {}),
    hasFigure,
  }
  // Official symbol legends (CNS): each text option carries its own symbol,
  // cropped per option. The options stay text; the symbol shows beside it.
  if (exam.symbolOptionIds?.includes(question.id)) {
    const stem = `${exam.cropPrefix ? `${exam.cropPrefix}-` : ''}${question.id}`
    return {
      ...repaired,
      hasFigure: false,
      sourceImage: undefined,
      sourceImages: undefined,
      sourcePageImage: undefined,
      optionImages: question.options.map((_, index) => `/question-images/${stem}-${index + 1}.png`),
    }
  }
  if (!repaired.hasFigure && (!imageOverrides || codeOverride?.codeBlock)) {
    return { ...repaired, sourceImage: undefined, sourceImages: undefined, sourcePageImage: undefined }
  }
  const generatedImages = generatedImageSources(exam, repaired, question.bankImages)
  // When the four options are transcribed code, only the prompt figure is kept;
  // the remaining override entries are the option crops the code replaces.
  const overrideImages = codeOverride?.optionCodeBlocks
    ? imageOverrides?.slice(0, 1)
    : imageOverrides
  const sourceImages = overrideImages?.map(questionImagePath) ?? generatedImages
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
    sourceRevision: formatSourceRevision(sources),
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
    ...await Promise.all(MACHINERY_COMMON_BANKS.map(async (bank) => [bank.key, await loadParsed(bank)])),
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
