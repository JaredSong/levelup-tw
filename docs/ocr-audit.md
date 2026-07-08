# OCR Audit Pipeline

Use OCR as a second opinion, not as the source of truth.

## Flow

1. Extract the official PDF text into the current bank.
2. Run PaddleOCR or another OCR engine on suspicious pages/crops.
3. Save OCR output as JSON:

```json
[
  {
    "id": "17300-02-156",
    "text": "PHP 程式 $x + $y 輸出為何？ ①Hello+World ②Hello World ③HelloWorld ④0"
  }
]
```

4. Run:

```bash
npm run audit:ocr -- path/to/ocr-records.json tmp/ocr-audit-report.json
```

5. Review the flagged diffs manually.
6. Apply approved fixes through `scripts/textCorrections.mjs` or explicit importer overrides.

Never replace the published bank directly from OCR output.
