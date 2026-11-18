// Figures the question parser misses on LIVE banks: the official PDF draws the
// symbol, table, photo or diagram as an image with no marker in the text, so the
// question shipped as text with its figure missing (「如左圖所示之符號為」 and no
// symbol). Found by placing every embedded image/drawing of each PDF in its
// question's band (answer markers aligned with the answer key), confirmed on the
// page image, crops reviewed by Jared 2026-11-17.
//
// Rect = the embedded image's exact bounds in page points (PyMuPDF), with stray
// specks / quote marks printed inside the image trimmed off by measurement.
// `trimThreshold: 250` keeps pale-grey table rules that the default whitespace
// trim would remove; `hiRes` keeps the 288-dpi render for tables and photos whose
// 1px borders vanish when averaged down to 144 dpi.
//
// Read by build-question-crops.mjs (crops) and build-exam-packs.mjs (figureIds /
// symbolOptionIds). One list, both sides.

export const RESTORED_FIGURES = {
  // 116 batch of 5: drawing-legend symbols in 冷凍空調裝修 丙/乙 (image bounds + 0.5pt, hiRes: these 8–40pt symbols lost their outer stroke at 144 dpi).
  '001003A11': {
    '00100-01-001': { page: 2, x: 162.20, y: 90.47, width: 38.01, height: 19.75, trimThreshold: 250, hiRes: true },
    '00100-01-004': { page: 2, x: 162.20, y: 237.77, width: 27.25, height: 25.75, trimThreshold: 250, hiRes: true },
    '00100-01-005': { page: 2, x: 409.20, y: 270.43, width: 23.11, height: 17.50, trimThreshold: 250, hiRes: true },
    '00100-01-008': { page: 2, x: 175.20, y: 389.84, width: 42.25, height: 19.00, trimThreshold: 250, hiRes: true },
    '00100-01-009': { page: 2, x: 162.20, y: 450.90, width: 38.01, height: 34.00, trimThreshold: 250, hiRes: true },
    '00100-01-010': { page: 2, x: 409.20, y: 509.00, width: 19.75, height: 17.50, trimThreshold: 250, hiRes: true },
    '00100-01-019': { page: 3, x: 162.20, y: 62.77, width: 15.25, height: 15.25, trimThreshold: 250, hiRes: true },
    '00100-01-022': { page: 3, x: 162.20, y: 173.00, width: 30.57, height: 30.25, trimThreshold: 250, hiRes: true },
    '00100-01-023': { page: 3, x: 162.20, y: 228.10, width: 18.25, height: 13.00, trimThreshold: 250, hiRes: true },
    '00100-01-024': { page: 3, x: 149.20, y: 267.01, width: 27.25, height: 27.25, trimThreshold: 250, hiRes: true },
    '00100-01-025': { page: 3, x: 399.65, y: 301.16, width: 12.62, height: 16.00, trimThreshold: 250, hiRes: true },
  },
  '001002A12': {
    '00100-01-001': { page: 2, x: 303.90, y: 72.52, width: 19.75, height: 24.25, trimThreshold: 250, hiRes: true },
    '00100-01-002': { page: 2, x: 303.90, y: 121.63, width: 53.05, height: 25.75, trimThreshold: 250, hiRes: true },
    '00100-01-005': { page: 2, x: 303.90, y: 257.24, width: 28.75, height: 14.50, trimThreshold: 250, hiRes: true },
    '00100-01-006': { page: 2, x: 303.90, y: 296.14, width: 9.25, height: 9.25, trimThreshold: 250, hiRes: true },
    '00100-01-007': { page: 2, x: 303.90, y: 335.05, width: 9.25, height: 9.25, trimThreshold: 250, hiRes: true },
    '00100-01-008': { page: 2, x: 303.90, y: 373.95, width: 38.05, height: 21.25, trimThreshold: 250, hiRes: true },
    '00100-01-009': { page: 2, x: 303.90, y: 420.05, width: 14.05, height: 17.50, trimThreshold: 250, hiRes: true },
    '00100-01-010': { page: 2, x: 303.90, y: 461.66, width: 38.05, height: 18.25, trimThreshold: 250, hiRes: true },
    '00100-01-011': { page: 2, x: 303.90, y: 504.77, width: 45.61, height: 27.25, trimThreshold: 250, hiRes: true },
    '00100-01-013': { page: 2, x: 303.90, y: 595.78, width: 60.61, height: 22.00, trimThreshold: 250, hiRes: true },
    '00100-01-014': { page: 2, x: 303.90, y: 641.89, width: 38.05, height: 38.50, trimThreshold: 250, hiRes: true },
    '00100-01-015': { page: 2, x: 303.90, y: 704.50, width: 23.05, height: 19.00, trimThreshold: 250, hiRes: true },
    '00100-01-016': { page: 2, x: 303.90, y: 747.60, width: 23.05, height: 31.00, trimThreshold: 250, hiRes: true },
    '00100-01-017': { page: 3, x: 303.90, y: 44.82, width: 23.05, height: 34.75, trimThreshold: 250, hiRes: true },
    '00100-01-018': { page: 3, x: 303.90, y: 104.42, width: 38.05, height: 26.50, trimThreshold: 250, hiRes: true },
    '00100-01-019': { page: 3, x: 303.90, y: 155.03, width: 34.75, height: 20.50, trimThreshold: 250, hiRes: true },
    '00100-01-020': { page: 3, x: 303.90, y: 199.64, width: 19.75, height: 23.50, trimThreshold: 250, hiRes: true },
    '00100-01-021': { page: 3, x: 303.90, y: 247.25, width: 53.05, height: 24.25, trimThreshold: 250, hiRes: true },
    '00100-01-022': { page: 3, x: 303.90, y: 296.36, width: 38.05, height: 22.00, trimThreshold: 250, hiRes: true },
    '00100-01-023': { page: 3, x: 303.90, y: 342.47, width: 19.75, height: 34.00, trimThreshold: 250, hiRes: true },
    '00100-01-024': { page: 3, x: 303.90, y: 400.57, width: 19.75, height: 19.75, trimThreshold: 250, hiRes: true },
    '00100-01-025': { page: 3, x: 303.90, y: 445.18, width: 19.75, height: 42.25, trimThreshold: 250, hiRes: true },
    '00100-01-026': { page: 3, x: 303.90, y: 512.29, width: 38.05, height: 28.75, trimThreshold: 250, hiRes: true },
    '00100-01-027': { page: 3, x: 303.90, y: 565.90, width: 38.05, height: 31.75, trimThreshold: 250, hiRes: true },
    '00100-01-028': { page: 3, x: 303.90, y: 622.51, width: 38.05, height: 30.25, trimThreshold: 250, hiRes: true },
    '00100-01-029': { page: 3, x: 303.90, y: 677.61, width: 21.25, height: 16.75, trimThreshold: 250, hiRes: true },
    '00100-01-030': { page: 3, x: 303.90, y: 719.22, width: 30.25, height: 12.25, trimThreshold: 250, hiRes: true },
    '00100-01-031': { page: 3, x: 303.90, y: 758.12, width: 32.05, height: 16.75, trimThreshold: 250, hiRes: true },
    '00100-01-032': { page: 4, x: 303.90, y: 44.82, width: 29.05, height: 7.00, trimThreshold: 250, hiRes: true },
    '00100-01-033': { page: 4, x: 303.90, y: 83.72, width: 19.75, height: 26.50, trimThreshold: 250, hiRes: true },
    '00100-01-034': { page: 4, x: 303.90, y: 134.33, width: 57.25, height: 25.00, trimThreshold: 250, hiRes: true },
    '00100-01-035': { page: 4, x: 303.90, y: 183.43, width: 42.25, height: 15.25, trimThreshold: 250, hiRes: true },
    '00100-01-036': { page: 4, x: 303.90, y: 223.54, width: 38.05, height: 29.50, trimThreshold: 250, hiRes: true },
    '00100-01-037': { page: 4, x: 303.90, y: 277.15, width: 53.05, height: 13.00, trimThreshold: 250, hiRes: true },
    '00100-01-038': { page: 4, x: 303.90, y: 316.05, width: 53.05, height: 28.00, trimThreshold: 250, hiRes: true },
    '00100-01-039': { page: 4, x: 303.90, y: 368.16, width: 38.05, height: 10.75, trimThreshold: 250, hiRes: true },
    '00100-01-040': { page: 4, x: 303.90, y: 407.06, width: 23.05, height: 38.50, trimThreshold: 250, hiRes: true },
    '00100-01-041': { page: 4, x: 303.90, y: 469.67, width: 38.05, height: 22.75, trimThreshold: 250, hiRes: true },
    '00100-01-042': { page: 4, x: 303.90, y: 517.28, width: 23.05, height: 32.50, trimThreshold: 250, hiRes: true },
    '00100-01-045': { page: 4, x: 303.90, y: 747.87, width: 30.61, height: 20.50, trimThreshold: 250, hiRes: true },
    '00100-01-046': { page: 5, x: 303.90, y: 44.82, width: 34.75, height: 18.25, trimThreshold: 250, hiRes: true },
    '00100-01-047': { page: 5, x: 303.90, y: 87.92, width: 38.05, height: 20.50, trimThreshold: 250, hiRes: true },
    '00100-01-048': { page: 5, x: 303.90, y: 132.53, width: 30.61, height: 34.75, trimThreshold: 250, hiRes: true },
    '00100-01-049': { page: 5, x: 303.90, y: 192.14, width: 42.25, height: 11.50, trimThreshold: 250, hiRes: true },
  },
  '070044A12': {
    '07004-02-006': { page: 17, x: 110.7, y: 315.4, width: 26.2, height: 14.2, trimThreshold: 250 },
  },
  '007003A13': {
    '00700-01-045': { page: 5, x: 107.7, y: 456.3, width: 96.0, height: 64.5, trimThreshold: 250, hiRes: true },
    '00700-01-046': { page: 5, x: 107.7, y: 543.2, width: 96.0, height: 64.5, trimThreshold: 250, hiRes: true },
    '00700-01-047': { page: 5, x: 107.7, y: 630.1, width: 96.0, height: 64.5, trimThreshold: 250, hiRes: true },
  },
  '013003A13': {
    '01300-01-013': { page: 3, x: 108.7, y: 257.7, width: 35.2, height: 31.8, trimThreshold: 250 },
    '01300-01-014': { page: 3, x: 108.7, y: 311.3, width: 21.5, height: 19.0, trimThreshold: 250 },
    '01300-01-015': { page: 3, x: 108.7, y: 351.4, width: 20.8, height: 19.0, trimThreshold: 250 },
    '01300-01-018': { page: 3, x: 107.7, y: 579.6, width: 44.2, height: 41.2, trimThreshold: 250, hiRes: true },
    '01300-01-019': { page: 3, x: 108.7, y: 641.7, width: 29.2, height: 27.2, trimThreshold: 250 },
    '01300-01-020': { page: 3, x: 108.7, y: 690.8, width: 28.8, height: 26.5, trimThreshold: 250 },
    '01300-01-022': { page: 4, x: 108.7, y: 43.3, width: 26.6, height: 28.0, trimThreshold: 250 },
    '01300-01-023': { page: 4, x: 108.7, y: 92.4, width: 38.2, height: 59.5, trimThreshold: 250 },
    '01300-01-028': { page: 4, x: 107.7, y: 514.1, width: 65.5, height: 37.5, trimThreshold: 250, hiRes: true },
    '01300-01-030': { page: 4, x: 108.7, y: 632.5, width: 52.0, height: 28.0, trimThreshold: 250 },
    '01300-01-041': { page: 5, x: 225.7, y: 390.9, width: 71.5, height: 35.5, trimThreshold: 250, hiRes: true },
    '01300-01-042': { page: 5, x: 108.7, y: 447.5, width: 62.5, height: 26.5, trimThreshold: 250 },
    '01300-01-043': { page: 5, x: 107.7, y: 484.2, width: 54.2, height: 62.5, trimThreshold: 250, hiRes: true },
    '01300-01-044': { page: 5, x: 107.7, y: 547.9, width: 81.0, height: 33.7, trimThreshold: 250, hiRes: true },
    '01300-01-045': { page: 5, x: 107.7, y: 601.5, width: 52.5, height: 48.7, trimThreshold: 250, hiRes: true },
    '01300-01-060': { page: 7, x: 239.7, y: 684.3, width: 66.0, height: 57.0, trimThreshold: 250, hiRes: true },
    '01300-01-061': { page: 8, x: 321.4, y: 42.3, width: 62.0, height: 33.8, trimThreshold: 250, hiRes: true },
  },
  '016003A12': {
    '01600-01-003': { page: 2, x: 107.7, y: 183.2, width: 68.5, height: 38.3, trimThreshold: 250, hiRes: true },
    '01600-01-008': { page: 2, x: 107.7, y: 552.9, width: 156.0, height: 96.7, trimThreshold: 250, hiRes: true },
    '01600-01-011': { page: 3, x: 110.7, y: 45.3, width: 9.1, height: 12.0, trimThreshold: 250 },
    '01600-01-016': { page: 3, x: 320.2, y: 334.1, width: 83.5, height: 40.0, trimThreshold: 250, hiRes: true },
    '01600-01-087': { page: 7, x: 188.7, y: 631.6, width: 50.0, height: 36.3, trimThreshold: 250, hiRes: true },
  },
  '021003A12': {
    '02100-08-001': { page: 29, x: 107.7, y: 637.5, width: 44.2, height: 60.0, trimThreshold: 250, hiRes: true },
  },
  '042003A11': {
    '04200-05-035': { page: 38, x: 175.7, y: 260.8, width: 9.0, height: 9.0, trimThreshold: 250 },
  },
  '042022A11': {
    '04202-01-016': { page: 3, x: 119.4, y: 76.4, width: 120.0, height: 72.7, trimThreshold: 250, hiRes: true },
    '04202-02-080': { page: 17, x: 126.1, y: 604.6, width: 197.9, height: 64.5, trimThreshold: 250, hiRes: true },
    '04202-02-096': { page: 19, x: 126.1, y: 172.1, width: 118.5, height: 57.0, trimThreshold: 250, hiRes: true },
    '04202-02-098': { page: 19, x: 126.1, y: 339.2, width: 164.9, height: 40.5, trimThreshold: 250, hiRes: true },
    '04202-02-099': { page: 19, x: 126.1, y: 414.9, width: 167.9, height: 39.8, trimThreshold: 250, hiRes: true },
    '04202-03-013': { page: 24, x: 128.1, y: 334.9, width: 67.2, height: 47.0, trimThreshold: 250, hiRes: true },
    '04202-03-020': { page: 24, x: 128.1, y: 736.6, width: 67.2, height: 46.3, trimThreshold: 250, hiRes: true },
    '04202-03-021': { page: 25, x: 126.1, y: 94.3, width: 133.4, height: 102.0, trimThreshold: 250, hiRes: true },
    '04202-05-049': { page: 54, x: 126.1, y: 445.7, width: 62.2, height: 46.5, trimThreshold: 250, hiRes: true },
    '04202-05-103': { page: 58, x: 126.1, y: 476.5, width: 72.0, height: 55.5, trimThreshold: 250, hiRes: true },
    '04202-05-105': { page: 58, x: 126.1, y: 666.6, width: 167.9, height: 87.0, trimThreshold: 250, hiRes: true },
    '04202-05-106': { page: 59, x: 126.1, y: 86.7, width: 169.4, height: 87.7, trimThreshold: 250, hiRes: true },
    '04202-05-107': { page: 59, x: 126.1, y: 220.7, width: 170.2, height: 90.0, trimThreshold: 250, hiRes: true },
    '04202-05-108': { page: 59, x: 126.1, y: 351.1, width: 170.2, height: 90.0, trimThreshold: 250, hiRes: true },
  },
  '118002A15': {
    '11800-01-131': { page: 12, x: 126.1, y: 315.8, width: 380.9, height: 250.5, trimThreshold: 250, hiRes: true },
    '11800-02-116': { page: 39, x: 126.1, y: 40.5, width: 418.4, height: 93.7, trimThreshold: 250, hiRes: true },
  },
  '118003A14': {
    '11800-03-069': { page: 29, x: 147.7, y: 605.9, width: 22.7, height: 21.2, trimThreshold: 250 },
  },
  '120002A13': {
    '12000-01-017': { page: 2, x: 112.8, y: 710.2, width: 60.0, height: 55.5, trimThreshold: 250, hiRes: true },
  },
  '126002A12': {
    '12600-01-001': { page: 2, x: 113.8, y: 71.0, width: 68.2, height: 28.0, trimThreshold: 250 },
    '12600-01-006': { page: 2, x: 113.8, y: 320.1, width: 79.4, height: 18.2, trimThreshold: 250 },
    '12600-01-048': { page: 5, x: 146.3, y: 204.2, width: 77.0, height: 36.8, trimThreshold: 250, hiRes: true },
    '12600-05-021': { page: 22, x: 119.0, y: 474.2, width: 26.3, height: 21.3, trimThreshold: 250 },
  },
  '145003A13': {
    '14500-03-074': { page: 10, x: 108.7, y: 573.0, width: 139.5, height: 37.7, trimThreshold: 250, hiRes: true },
    '14500-03-206': { page: 20, x: 107.7, y: 177.3, width: 118.5, height: 127.5, trimThreshold: 250, hiRes: true },
    '14500-03-232': { page: 22, x: 107.7, y: 40.5, width: 354.0, height: 81.0, trimThreshold: 250, hiRes: true },
    '14500-03-233': { page: 22, x: 107.7, y: 174.7, width: 346.5, height: 111.0, trimThreshold: 250, hiRes: true },
    '14500-03-234': { page: 22, x: 107.7, y: 320.9, width: 320.3, height: 141.0, trimThreshold: 250, hiRes: true },
    '14500-03-235': { page: 22, x: 107.7, y: 497.2, width: 320.3, height: 141.0, trimThreshold: 250, hiRes: true },
    '14500-03-236': { page: 23, x: 107.7, y: 58.5, width: 193.5, height: 147.7, trimThreshold: 250, hiRes: true },
    '14500-03-237': { page: 23, x: 107.7, y: 242.2, width: 156.0, height: 118.5, trimThreshold: 250, hiRes: true },
    '14500-03-238': { page: 23, x: 107.7, y: 449.8, width: 231.0, height: 129.7, trimThreshold: 250, hiRes: true },
    '14500-03-239': { page: 24, x: 107.7, y: 58.5, width: 231.0, height: 179.2, trimThreshold: 250, hiRes: true },
    '14500-03-241': { page: 24, x: 107.7, y: 353.6, width: 178.5, height: 172.5, trimThreshold: 250, hiRes: true },
    '14500-03-242': { page: 24, x: 107.7, y: 597.3, width: 342.8, height: 93.0, trimThreshold: 250, hiRes: true },
    '14500-03-243': { page: 25, x: 107.7, y: 58.5, width: 222.0, height: 127.5, trimThreshold: 250, hiRes: true },
    '14500-03-244': { page: 25, x: 107.7, y: 239.1, width: 208.5, height: 136.5, trimThreshold: 250, hiRes: true },
    '14500-04-010': { page: 26, x: 108.7, y: 276.7, width: 49.0, height: 17.5, trimThreshold: 250 },
    '14500-04-011': { page: 26, x: 108.7, y: 297.7, width: 85.8, height: 30.2, trimThreshold: 250, hiRes: true },
    '14500-04-014': { page: 26, x: 108.7, y: 427.6, width: 79.0, height: 31.7, trimThreshold: 250, hiRes: true },
    '14500-04-015': { page: 26, x: 108.7, y: 463.2, width: 56.5, height: 32.5, trimThreshold: 250, hiRes: true },
    '14500-04-016': { page: 26, x: 108.7, y: 516.8, width: 84.2, height: 18.3, trimThreshold: 250 },
    '14500-04-017': { page: 26, x: 108.7, y: 557.0, width: 79.0, height: 17.5, trimThreshold: 250 },
    '14500-04-120': { page: 33, x: 107.7, y: 58.5, width: 118.5, height: 77.2, trimThreshold: 250, hiRes: true },
    '14500-04-121': { page: 33, x: 107.7, y: 189.6, width: 337.5, height: 231.0, trimThreshold: 250, hiRes: true },
    '14500-04-122': { page: 33, x: 107.7, y: 473.8, width: 279.0, height: 132.0, trimThreshold: 250, hiRes: true },
  },
  '173002A13': {
    '17300-03-058': { page: 48, x: 306.8, y: 501.1, width: 19.0, height: 16.8, trimThreshold: 250 },
  },
  '178004A13': {
    '17800-03-008': { page: 22, x: 108.7, y: 237.8, width: 27.2, height: 27.3, trimThreshold: 250 },
  },
}

// CNS legend questions: each text option carries its own official symbol. One
// crop per option (`<stem>-1..4.png`); the option text stays text.
export const SYMBOL_OPTIONS = {
  // 116 batch of 5: 冷凍空調裝修乙 legend options, symbol mapped to its ①–④ marker.
  '001002A12': {
    '00100-01-050': [
      { page: 5, x: 464.02, y: 231.04, width: 15.60, height: 39.25, hiRes: true },
      { page: 5, x: 230.02, y: 274.20, width: 21.25, height: 26.50, hiRes: true },
      { page: 5, x: 385.13, y: 274.20, width: 16.75, height: 40.00, hiRes: true },
      { page: 5, x: 147.90, y: 317.36, width: 45.59, height: 17.50, hiRes: true },
    ],
    '00100-01-051': [
      { page: 5, x: 464.02, y: 341.01, width: 24.60, height: 15.25, hiRes: true },
      { page: 5, x: 360.02, y: 360.17, width: 24.53, height: 15.25, hiRes: true },
      { page: 5, x: 269.02, y: 379.33, width: 24.55, height: 13.75, hiRes: true },
      { page: 5, x: 134.90, y: 397.28, width: 25.00, height: 13.00, hiRes: true },
    ],
    '00100-01-052': [
      { page: 5, x: 134.90, y: 436.18, width: 19.75, height: 29.50, hiRes: true },
      { page: 5, x: 262.52, y: 436.18, width: 13.75, height: 28.00, hiRes: true },
      { page: 5, x: 384.13, y: 436.18, width: 19.75, height: 29.50, hiRes: true },
      { page: 5, x: 134.90, y: 468.84, width: 13.75, height: 28.75, hiRes: true },
    ],
    '00100-01-053': [
      { page: 5, x: 134.90, y: 522.45, width: 10.75, height: 7.00, hiRes: true },
      { page: 5, x: 266.52, y: 522.45, width: 10.75, height: 7.00, hiRes: true },
      { page: 5, x: 398.13, y: 522.45, width: 21.25, height: 11.50, hiRes: true },
      { page: 5, x: 134.90, y: 540.40, width: 9.25, height: 10.75, hiRes: true },
    ],
    '00100-01-054': [
      { page: 5, x: 134.90, y: 579.30, width: 75.51, height: 28.00, hiRes: true },
      { page: 5, x: 331.02, y: 579.30, width: 75.49, height: 28.75, hiRes: true },
      { page: 5, x: 134.90, y: 611.96, width: 60.51, height: 25.75, hiRes: true },
      { page: 5, x: 316.02, y: 611.96, width: 60.49, height: 25.75, hiRes: true },
    ],
    '00100-01-055': [
      { page: 5, x: 134.90, y: 662.56, width: 46.00, height: 15.25, hiRes: true },
      { page: 5, x: 327.02, y: 662.56, width: 45.53, height: 16.75, hiRes: true },
      { page: 5, x: 134.90, y: 683.22, width: 46.00, height: 18.25, hiRes: true },
      { page: 5, x: 314.02, y: 683.22, width: 45.57, height: 18.25, hiRes: true },
    ],
    '00100-01-056': [
      { page: 5, x: 134.90, y: 726.33, width: 10.75, height: 11.50, hiRes: true },
      { page: 5, x: 282.15, y: 726.33, width: 8.50, height: 11.50, hiRes: true },
      { page: 5, x: 397.77, y: 726.33, width: 11.50, height: 10.75, hiRes: true },
      { page: 5, x: 134.90, y: 744.28, width: 9.25, height: 10.00, hiRes: true },
    ],
    '00100-01-057': [
      { page: 6, x: 134.90, y: 62.77, width: 53.50, height: 30.25, hiRes: true },
      { page: 6, x: 334.52, y: 62.77, width: 27.25, height: 59.50, hiRes: true },
      { page: 6, x: 134.90, y: 125.42, width: 59.50, height: 28.75, hiRes: true },
      { page: 6, x: 275.52, y: 125.42, width: 45.55, height: 31.00, hiRes: true },
    ],
    '00100-01-058': [
      { page: 6, x: 134.90, y: 180.53, width: 29.50, height: 20.50, hiRes: true },
      { page: 6, x: 375.52, y: 180.53, width: 39.51, height: 16.75, hiRes: true },
      { page: 6, x: 134.90, y: 204.19, width: 36.25, height: 14.50, hiRes: true },
      { page: 6, x: 292.02, y: 204.19, width: 38.50, height: 16.00, hiRes: true },
    ],
    '00100-01-059': [
      { page: 6, x: 134.90, y: 244.30, width: 42.25, height: 22.00, hiRes: true },
      { page: 6, x: 376.02, y: 244.30, width: 45.61, height: 15.25, hiRes: true },
      { page: 6, x: 165.02, y: 269.46, width: 38.50, height: 26.50, hiRes: true },
      { page: 6, x: 310.63, y: 269.46, width: 34.75, height: 35.50, hiRes: true },
    ],
  },
  '126002A12': {
    '12600-01-053': [
      { page: 5, x: 288.9, y: 403.4, width: 66.0, height: 15.7 },
      { page: 5, x: 463.0, y: 403.4, width: 68.2, height: 9.7 },
      { page: 5, x: 171.9, y: 424.1, width: 80.2, height: 12.0 },
      { page: 5, x: 335.0, y: 424.1, width: 64.5, height: 15.0 },
    ],
    '12600-01-055': [
      { page: 5, x: 327.9, y: 531.3, width: 68.2, height: 20.2 },
      { page: 5, x: 115.8, y: 556.4, width: 26.2, height: 25.5 },
      { page: 5, x: 250.9, y: 556.4, width: 53.2, height: 16.5 },
      { page: 5, x: 400.0, y: 556.4, width: 48.0, height: 27.8 },
    ],
    '12600-01-056': [
      { page: 5, x: 288.9, y: 628.0, width: 24.0, height: 24.7 },
      { page: 5, x: 447.0, y: 628.0, width: 37.5, height: 20.2 },
      { page: 5, x: 197.9, y: 657.6, width: 34.5, height: 25.5 },
      { page: 5, x: 379.5, y: 657.6, width: 41.2, height: 24.0 },
    ],
    '12600-01-058': [
      { page: 6, x: 340.9, y: 63.3, width: 45.7, height: 21.0 },
      { page: 6, x: 115.8, y: 88.4, width: 42.0, height: 24.0 },
      { page: 6, x: 226.9, y: 88.4, width: 30.0, height: 34.5 },
      { page: 6, x: 365.0, y: 88.4, width: 42.7, height: 34.5 },
    ],
  },
}

// Banks with no crop entry of their own before this restore.
export const RESTORED_ONLY_BANKS = [
  { code: '11800', source: '118003A14' },
  { code: '17300', source: '173002A13' },
  { code: '17800', source: '178004A13' },
]

/** Ids restored for the bank whose raw text file is `occupationFile` (e.g. '013003A13-raw.txt'). */
export function restoredFigureIds(occupationFile) {
  return Object.keys(RESTORED_FIGURES[occupationFile.replace(/-raw\.txt$/, '')] ?? {})
}

export function symbolOptionIds(occupationFile) {
  return Object.keys(SYMBOL_OPTIONS[occupationFile.replace(/-raw\.txt$/, '')] ?? {})
}
