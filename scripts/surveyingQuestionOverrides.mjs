// Transcribed from 042003A11.pdf where embedded formula glyphs disappear from
// pdftotext. IDs and official answer keys remain unchanged.
export const SURVEYING_SOURCE_FILE = '042003A11-raw.txt'
const levelingLoop = '某水準環線包含等距離之 A、B、C 三點，已知 A 點高程 H_A＝31.234m。進行逐差水準測量後得各測段往返測平均高程差分別為 ΔH_AB＝2.345m、ΔH_BC＝3.468m、ΔH_CA＝-5.801m，'

export const SURVEYING_QUESTION_OVERRIDES = {
  '04200-01-007': { options: ['(a＋b)/2', '(a－b)/2', '(a＋b)/a', '(a－b)/a'] },
  '04200-01-052': {
    prompt: '假設以 P 來表示一觀測量的權，而該觀測量的標準誤差為 σ̂，則權與標準誤差的關係為？',
    options: ['P＝k/σ̂', 'P＝k/σ̂²', 'P＝k/σ̂³', 'P＝k/σ̂⁴'],
  },
  '04200-01-055': { options: ['1', '1/2', '√3/2', '0'] },
  '04200-01-056': { options: [
    'E_B＝E_A＋S_AB·sin φ_AB', 'E_B＝E_A＋S_AB·cos φ_AB',
    'E_B＝E_A＋S_AB·tan φ_AB', 'E_B＝E_A＋S_AB·cot φ_AB',
  ] },
  '04200-01-057': { options: [
    'N_B＝N_A＋S_AB·sin φ_AB', 'N_B＝N_A＋S_AB·cos φ_AB',
    'N_B＝N_A＋S_AB·tan φ_AB', 'N_B＝N_A＋S_AB·cot φ_AB',
  ] },
  '04200-02-011': { options: ['b·cot(α/2)', 'b·tan(α/2)', '(b/2)·cot(α/2)', '(b/2)·tan(α/2)'] },
  '04200-02-023': { options: ['圖示選項 1', '圖示選項 2', '圖示選項 3', '圖示選項 4'] },
  '04200-02-032': { options: ['√(S²＋h²)', '√(S²－h²)', '√(S－h)', '√(S＋h)'] },
  '04200-02-050': {
    prompt: 'A、B、C 三點在斜坡同一直線上，AB、BC 之斜距 S_AB、S_BC，及傾斜角 α_AB、α_BC，則 AC 之水平距離為',
    options: ['圖示選項 1', '圖示選項 2', '圖示選項 3', '圖示選項 4'],
  },
  '04200-02-061': { options: ['200√13 ㎡', '300√6 ㎡', '600√6 ㎡', '1,500 ㎡'] },
  '04200-02-062': { options: ['±√31 mm', '±√41 mm', '±√51 mm', '±√61 mm'] },
  '04200-02-075': { options: ['±2 mm', '±4 mm', '±5 mm', '±√5 mm'] },
  '04200-02-076': { options: ['±√26 mm', '±√23 mm', '±10 mm', '±6 mm'] },
  '04200-02-079': { options: ['±√268 mm', '±√300 mm', '±√68 mm', '±16 mm'] },
  '04200-02-080': { options: ['±√68 mm', '±√31 mm', '±10 mm', '±16 mm'] },
  '04200-02-104': { options: ['D³/(24R²)', 'D²/(24R³)', 'D²/(12R³)', 'D³/(12R²)'] },
  '04200-03-051': { prompt: '水準閉合差限制值計算式為 ±C√K mm，式中 K 的單位為' },
  '04200-03-073': { options: ['視距約 40m', '使用銦鋼水準尺', '配平行玻璃板', '閉合差限制為 ±20√K mm 內'] },
  '04200-03-100': { prompt: '若普通水準測量之誤差界限為 20√K mm，則水準路線長度為 4,000m 時閉合差之絕對值不可超過' },
  '04200-03-146': { prompt: '水準測量時，測段是指由一固定的水準點到另一個水準點的水準路線。依規定水準路線之各測段必須往測及返測均各測一次。假設某水準測量精度規範如下：大於 200m 之測段往返最大閉合差為 20mm√K，其中 K 為單一測段長度之公里數。若由 A 點到 B 點的水準路線長度為 1590m，則其往返最大閉合差為' },
  '04200-03-147': { prompt: '水準測量時，測段是指由一固定的水準點到另一個水準點的水準路線。假設檢測已知點之精度規範如下：檢測測段往返測平均高程差與已知成果高程差之較差不可大於 30mm√K，K 為測段長度之公里數。若由 A 點到 B 點的水準路線長度為 1590m，則該測段往返測平均高程差與已知成果高程差之較差不可大於' },
  '04200-03-148': { prompt: '假設水準環線最大閉合差為 20mm√F，F 為水準環線長度之公里數。若某水準環線包含 A、B、C、D 等四點，其中 A 點至 B 點、B 點至 C 點、C 點至 D 點、D 點至 A 點之水準路線長度分別為 1km、4km、2km、3km，則此水準環線最大閉合差為' },
  '04200-03-149': { prompt: '水準測量記錄表如下，單位為公尺，則高程差 ΔH_AB 為' },
  '04200-03-150': { prompt: '水準測量記錄表如下，單位為公尺，則高程差 ΔH_AC 為' },
  '04200-03-151': { prompt: '水準測量記錄表如下，單位為公尺，則 C 點高程 H_C 為' },
  '04200-03-152': { prompt: '水準測量記錄表如下，單位為公尺，則高程差 ΔH_BA 為' },
  '04200-03-153': { prompt: '水準測量記錄表如下，單位為公尺，則高程差 ΔH_CA 為' },
  '04200-03-154': { prompt: '水準測量記錄表如下，單位為公尺，則 C 點高程 H_C 為' },
  '04200-03-155': {
    prompt: '由 A 點至 B 點進行逐差水準測量，得往測高程差 ΔH_AB＝23.596m，再進行返測得高程差 ΔH_BA＝-23.582m，由 A 點到 B 點的水準路線長度為 2km，假設精度規範要求測段往返最大閉合差為 20mm√K，其中 K 為單一測段長度之公里數，則下列何者錯誤？',
    options: ['往返測閉合差之絕對值 |W|＝0.014m', '依規範往返最大閉合差為 40 mm', '此往返測之閉合差符合規範精度要求', '由 A 點至 B 點之高程差平均值為 23.589m'],
  },
  '04200-03-156': {
    prompt: '已知 A 點高程 H_A＝21.341m，B 點高程 H_B＝23.579m。由 A 點至 B 點進行逐差水準測量，得往返測平均高程差為 2.258m，由 A 點到 B 點的水準路線長度為 2km。假設檢測已知點之精度規範如下：檢測測段往返測平均高程差與已知成果高程差之較差不可大於 30mm√K，K 為測段長度之公里數。試問下列何者正確？',
    options: ['已知成果之高程差 ΔH_AB＝-2.248m', '往返測平均高程差與已知成果高程差之較差的絕對值為 27 mm', '依規範往返測平均高程差與已知成果高程差之較差不可大於 42 mm', '往返測平均高程差與已知成果高程差之較差超過規範精度要求'],
  },
  '04200-03-157': { prompt: `${levelingLoop}則此水準環線之閉合差為` },
  '04200-03-158': { prompt: `${levelingLoop}則各測段高程差之改正數為` },
  '04200-03-159': { prompt: `${levelingLoop}則改正後高程差 ΔH′_AB＝` },
  '04200-03-160': { prompt: `${levelingLoop}則改正後高程差 ΔH′_CA 等於` },
  '04200-03-161': { prompt: `${levelingLoop}則改正後 B 點高程 H_B 等於` },
  '04200-03-162': { prompt: `${levelingLoop}則改正後 C 點高程 H_C 等於` },
  '04200-04-099': { prompt: '測得 AB 線方向角為 N15°W，CA 線方向角為 S15°W，則∠CAB＝' },
  '04200-04-050': {
    prompt: '觀測垂直角（俯仰角）時，儀器為象限式度盤，α₁ 表正鏡測得之垂直角，α₂ 表倒鏡測得之垂直角，若此儀器垂直度盤有指標差，則等於',
    options: ['(α₁＋α₂)/2', 'α₁＋α₂', 'α₂－α₁', '|(α₂－α₁)/2|'],
  },
  '04200-04-153': { options: ['10″√N', '20″√N', '30″√N', '40″√N'] },
  '04200-04-154': { options: ['20″√N＋20″', '20″√N＋25″', '20″√N＋30″', '20″√N＋40″'] },
  '04200-06-007': { options: ['一', '十', '△', '▲'] },
}

export const SURVEYING_FIGURE_IDS = [
  '04200-01-049',
  '04200-02-023', '04200-02-050',
  '04200-03-049', ...[149, 150, 151, 152, 153, 154].map((number) => `04200-03-${number}`),
  ...[132, 142, 143, 147].map((number) => `04200-04-${number}`),
  '04200-05-011', '04200-05-012', '04200-05-036',
  ...[63, 64, 65, 66, 67, 68, 69, 70, 71].map((number) => `04200-05-${String(number).padStart(3, '0')}`),
]

export const SURVEYING_PROMPT_OVERRIDES = Object.fromEntries(
  Object.entries(SURVEYING_QUESTION_OVERRIDES).filter(([, value]) => value.prompt).map(([id, value]) => [id, value.prompt]),
)
export const SURVEYING_OPTION_OVERRIDES = Object.fromEntries(
  Object.entries(SURVEYING_QUESTION_OVERRIDES).filter(([, value]) => value.options).map(([id, value]) => [id, value.options]),
)

const surveyingFigureIds = new Set(SURVEYING_FIGURE_IDS)

export function applySurveyingQuestionOverride(question) {
  const override = SURVEYING_QUESTION_OVERRIDES[question.id]
  if (!override && !surveyingFigureIds.has(question.id)) return question
  return { ...question, ...override, hasFigure: surveyingFigureIds.has(question.id) }
}
