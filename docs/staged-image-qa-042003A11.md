# 測量丙級 (042003A11) source QA

Status: **promoted 2026-11-06 to the publishable pack `surveying-c`.** Jared signed off the 26 cropped question panels (35 PNGs); the shipped files in `public/question-images/042003-*` are byte-identical (SHA-256) to the reviewed crops in `tmp/import-batch/042003A11/crops/`. Answer keys: 703/703 active occupation questions agree with `042003A11.pdf` (`node scripts/verifyAnswerKeys.mjs surveying-c`). The WDA source-drift gate passes. A pattern scan of all 704 questions for lost glyphs (private-use/replacement characters, empty or duplicate options, dangling operators, unexplained blank gaps) found no defects beyond those already repaired: the remaining hits are genuine ± signs and the blank gaps that the map-symbol figures fill. This is still not a word-by-word human proofread of every question.

Promotion caught one build bug before release: the five table questions (`03-152`, `04-132/142/143/147`) were built as text-only because nothing forced `SURVEYING_FIGURE_IDS` to be figures, so learners would have seen 「下表…」 with no table. `build-exam-packs.mjs` now forces them, and `questionBankIntegrity.test.ts` asserts every reviewed figure ships with existing images.

Original staging notes follow.

Previous status: staged only; do not publish. The answer markers match the staged official PDF. Identified formula and image defects have been repaired locally, but this is not a full visual proofread of all 704 questions. The separate WDA source-drift gate remains unresolved.

The official deletion marker on `04200-01-033` is preserved for provenance and is included in the staged `inactiveIds` list. The intended active total is therefore 703, pending promotion.

Run `node scripts/build-staged-image-review.mjs 042003A11` and open `tmp/import-batch/042003A11/image-review.html` locally. It compares 26 figure questions, including the four image options for `02-023` and `02-050`, against their official PDF pages. Gallery previews retain their natural display size, including `05-065`. The 35 crop PNGs remain under `tmp/import-batch/042003A11/crops/`, not `public/question-images/`.

## Crop review

- 1 four-option diagram question: `04200-01-049`. Manual rectangles show all four complete target diagrams.
- 2 four-option formula questions: `04200-02-023/050`. Their option images retain the official order; only their own crop bounds and undersized formulas were adjusted.
- 6 leveling-table questions: `04200-03-149` through `154`. Rectangles now contain the full respective table. Repeated tables are cropped from the cleaner occurrence on the same official page.
- 13 map-symbol questions: `04200-03-049`, `04200-05-011/012/036/063` through `071`. The symbols in `05-011`, `05-036`, `05-063`, and `05-065` needed manual rectangles: the original `05-011` crop clipped the envelope's right border, and `05-065` omitted the lower half of its circle. `05-068` was recropped to show the complete house symbol without neighboring text. The `05-065` source symbol remains low-resolution in the official PDF.
- 4 angle-observation table questions: `04200-04-132/142/143/147`. Manual rectangles now include the complete respective tables; `04-147` was narrowed to exclude neighboring question text.
- The 11 unsuitable formula crops (`02-061/076`, `03-155` through `162`, `04-154`) were removed. Their missing expressions were transcribed into selectable text from the PDF. `02-011` and 6 more four-option formula/symbol questions (`01-007/052`, `02-032/104`, `04-050`, `06-007`) were converted from tiny images to text options.

## Missing OCR text

- `04200-01-007/052/055/056/057`, `02-032/061/062/075/076/079/080/104`, `04-050`, `06-007`: missing formula glyphs or symbols restored in text options; `02-023/050` use image options. `01-052`, `02-050`, and `04-050` prompts also restore missing variables or subscripts.
- `04200-03-051/073/100/146` through `162`, `04-153/154`: missing roots, variables, subscripts, and numeric alternatives restored in the prompts/options.
- `04200-04-099`: the missing `AB` and `CA` line labels restored in the prompt.

This list is an identified minimum, not a claim that all 704 questions have been visually proofread. Keep `publishable: false` until the 26 cropped question panels have a final per-image sign-off, remaining text artifacts are audited, and the WDA source-drift gate passes. Do not copy staged crops into the public image directory yet.
