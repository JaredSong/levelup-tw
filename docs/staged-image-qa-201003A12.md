# 視覺傳達設計丙級 (201003A12) source QA

Status: **promoted 2026-11-06 to the publishable pack `visual-communication-design-c`.** Jared signed off the 20 三視圖 cards after the second crop pass (288-dpi render, no painted-out word boxes — the first pass dropped hairline borders). The 100 shipped PNGs in `public/question-images/201003-*` are byte-identical (SHA-256) to the reviewed set. Answer keys: 602/602 active occupation questions agree with `201003A12.pdf`; the six 本題刪題 questions are inactive. 997 active questions with the four general common subjects.

Previous status: staged; crops ready for sign-off.

Run `node scripts/build-question-crops.mjs 201003A12 && node scripts/build-staged-image-review.mjs 201003A12`, then open `tmp/import-batch/201003A12/image-review.html`. Each card shows the question's crops beside its official PDF page.

- **`20100-05-001` through `020` (三視圖):** 100 crops, one 3D object plus four option blocks per question. The rects in `scripts/build-question-crops.mjs` were derived from the PDF itself. Text was masked out, the remaining ink was grouped into views, and each option was taken as its top view plus the front and side views beneath it. Every option had to come out with exactly three views and no drawing left unassigned, or the question was flagged; all 20 passed. Where a marker or prompt word sits beside a drawing, the crop edge is pulled in to the word box instead of painting the word out. Options that wrap to the next line (for example `05-002` ③ and `05-015` ④) are placed by the drawing that opens that line. An agent check of the contact sheets found no stray glyphs, clipped edges or mixed options, and `05-012`'s per-option differences match the source. **Sign-off on option order (①–④) and completeness is still Jared's.** The faint WDA watermark is part of the source page and shows through in a few crops.
- **`20100-03-040` is not a figure question.** The crop showed only the question text: 「下列何者與彩色打樣印效不佳無關 ①製版的疏忽 ②完稿人員的錯誤 ③所附圖片影響 ④頁數太多」. The parser flagged it because of the gap before 「。」, and the parsed prompt and options already match it. It is excluded from cropping, and the pack config must list it in `excludedFigureIds`.
- **Deletions confirmed.** The official PDF text marks exactly six questions 「(本題刪題)」: `20100-02-069`, `20100-03-045`, `20100-04-029`, `20100-04-036`, `20100-04-085`, `20100-05-053`. All six go in `inactiveIds`. There are no other deletion markers in the file.

Regenerating these crops: `node scripts/build-question-crops.mjs 201003A12` only (the bank uses `oversample: 2`). Never run the full re-crop.
