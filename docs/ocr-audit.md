# OCR Audit Pipeline

Use OCR as a second opinion, not as the source of truth.

## Batch flow

1. Refresh the secondary discovery inventory with `npm run refresh:catalog`.
2. Download the latest official WDA PDF and use `pdftotext -layout` for the primary extraction.
3. Parse and structurally validate every question, option set, section and answer marker.
4. Build a Paddle review queue for figure pages, malformed option sets and suspicious split identifiers.
5. Run PP-StructureV3 only on those flagged pages.
6. Compare the result with the parsed bank and review disagreements manually.
7. Independently re-extract every official answer marker with `npm run verify:answers`.

## Stage several new exams

Use the six-digit WDA occupation/level code to download and prepare several
official papers in one pass:

```bash
npm run refresh:official-catalog
npm run stage:exams -- 028003 120003 016003
```

The staging command writes only under `tmp/import-batch/`; the web app cannot
load those files. Each candidate receives its official PDF and SHA-256,
`questions.json`, `candidate-config.json`, `review-queue.json`, and a concise
`report.md`. Answer-key disagreement, unmatched questions, duplicate IDs, or a
subject-code mismatch marks the candidate `blocked`. Figure, suspicious-spacing
and deletion-marker pages are queued for review.

Add `--force` to re-download cached PDFs, `--offline` to prohibit downloads, or
`--paddle` to render and OCR only the flagged pages. A staged candidate still
needs its manual configuration fields completed and must pass the normal answer,
crop and publication gates before it can be copied into `public/data/exams/`.

技檢通 is a discovery and secondary comparison source. It is never allowed to
override the latest official WDA PDF. The generated snapshot records this as
`authority: secondary-discovery-only`, and its version comparison is named
`versionMatchesTechcerti` on purpose — it is a hint for discovery, never a
publication signal.

## Publication gate

`npm run build` refuses to build (via the npm `prebuild` hook running
`scripts/publicationGate.mjs`) unless every pack under `public/data/exams/`
records `integrity.status: fully_verified` and can name its official revision,
subject codes and source. Cloudflare Pages builds with `npm run build`, so an
unverified pack cannot be published by forgetting to run a check — the deploy
itself fails. Run it manually with `npm run verify:publication`.

`answerKeyVerification.test.ts` provides the deeper layer on machines with
poppler: it re-extracts every official answer marker from the source PDFs and
fails on any disagreement. Both layers enumerate the shipped packs dynamically,
so a new pack is gated the moment it lands.

## What to measure

The pending list is an inventory of what exists, not an import queue. The
bottleneck of this factory is verification throughput, not extraction speed —
a pack that ships with wrong keys is worse than a pack that does not ship.
Judge a batch by:

- OCR flag count / flag rate per bank
- image-question count needing manual crops
- answer-key verification result
- estimated manual audit queue (pages a human must look at)

not by packs imported per week.

## Catalog inventory

```bash
npm run refresh:catalog
```

This writes `source/techcerti-catalog.json`, including installed/pending status
matched by official occupation code and level. The parser counts rendered cards
rather than trusting page metadata, because those totals can be stale.

## PaddleOCR setup

Paddle is isolated from the web app and is never shipped to users:

```bash
npm run setup:paddle
```

The setup installs `paddleocr[doc-parser]` and ONNX Runtime into
`.venv-paddle`. To use a different Python interpreter:

```bash
PADDLE_BOOTSTRAP_PYTHON=/path/to/python3 npm run setup:paddle
```

First generate the review queue without running OCR:

```bash
npm run audit:paddle -- \
  source/900110A10.pdf \
  public/data/exams/web-design-b/questions.json \
  90011 \
  tmp/paddle/90011
```

After checking the queue, append `--run`. All flagged pages are rendered first
and then processed in one Python process so the model stack loads once per bank:

```bash
npm run audit:paddle -- \
  source/900110A10.pdf \
  public/data/exams/web-design-b/questions.json \
  90011 \
  tmp/paddle/90011 \
  --run
```

Outputs include `review-queue.json`, page PNGs, structured JSON, Markdown and
detected figure crops. These are temporary review artifacts under `tmp/`.

## Record-level comparison

If reviewed OCR text has been assigned to question IDs, save it as JSON:

```json
[
  {
    "id": "17300-02-156",
    "text": "PHP 程式 $x + $y 輸出為何？ ①Hello+World ②Hello World ③HelloWorld ④0"
  }
]
```

Then run:

```bash
npm run audit:ocr -- path/to/ocr-records.json tmp/ocr-audit-report.json
```

Review the flagged diffs manually, then apply approved fixes through
`scripts/textCorrections.mjs` or explicit importer overrides.

Never replace the published bank directly from OCR output.
