// Shared repairs for the 90011 資訊相關 common-subject bank (900110A13, 116-01-01 起).
//
// 90011 ships inside several packs (web-design-b via import-questions.mjs, and
// computer-software-application-b/c, computer-hardware-repair-b/c and any future
// pack via build-exam-packs.mjs). Both builders previously kept their own copy
// of these overrides, and the copies drifted: build-exam-packs.mjs never
// received the 90011 entries at all, so 14 questions per pack fell through to
// the generic crop-filename convention `<cropPrefix>-<id>.png` — a file no crop
// step produces under a pack's prefix. The result was 42 broken image
// references on disk across three shipped packs.
//
// One bank, one set of repairs. Import from here; do not re-copy.
//
// Every entry is keyed to the A13 numbering. A13 renumbered and rewrote most of
// the bank, so the A12 code transcriptions do not carry over: 04-009/014/019/020
// changed text, and the rest print their code as graphics, so matching text
// proves nothing about the code itself.

// 90011's figures are cropped by build-question-crops.mjs under the bank's own
// prefix (900110A13), not the pack's, so each figure question names its crops
// here. The set was reviewed against source/900110A13.pdf.
const crop = (id) => `900110A13-${id}.png`
const FIGURE_IDS = [
  '90011-04-001', '90011-04-002', '90011-04-003', '90011-04-005', '90011-04-009',
  '90011-04-013', '90011-04-015', '90011-04-016', '90011-04-017', '90011-04-018',
  '90011-04-019', '90011-04-020',
  // Python code drawn as graphics; the parser sees no figure marker.
  '90011-04-014',
]
export const INFORMATION_COMMON_IMAGE_OVERRIDES = {
  ...Object.fromEntries(FIGURE_IDS.map((id) => [id, [crop(id)]])),
  // Prompt flowchart, then the four option crops (unused while the options are
  // typed below; kept so the typed code can be dropped without a re-crop).
  '90011-04-004': [crop('90011-04-004'), ...[1, 2, 3, 4].map((n) => `900110A13-90011-04-004-${n}.png`)],
}

// The A13 text layer puts every 90011 question on its own page, so nothing to
// override. (The page renders under public/question-pages/90011-page-*.jpg show
// the OLD A12 PDF, so 90011 questions carry no sourcePageImage in either builder.)
export const INFORMATION_COMMON_SOURCE_PAGE_OVERRIDES = {}

// Code transcriptions. A question with a `codeBlock` needs no figure at all, so
// `hasFigure` goes false and its IMAGE_OVERRIDES entry above is unused.
// `90011-04-004` is the exception — its four *options* are code, while the
// prompt keeps a single figure, so only the first override image is used. Its
// options were checked against source/900110A13.pdf page 6.
export const INFORMATION_COMMON_CODE_BLOCK_OVERRIDES = {
  '90011-04-004': {
    optionCodeBlocks: [
      'X>3? cout<<B:cout<<A;\nX=X+1',
      'if (X>3) cout<<A; else cout<<B;\nX=X+1;',
      'switch(X) {\n  case 1: cout<<A;\n  case 2: cout<<A;\n  case 3: cout<<A;\n  default: cout<<B;',
      'while (X>3) cout<<A;\ncout<<B;\nX=X+1;',
    ],
  },
}
