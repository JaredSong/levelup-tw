# Official source drift audit (2026-10-30)

> **Status 2026-11-06: resolved by `d7f6723` (Refresh exam packs against current WDA sources) plus `813e587`, which corrects the 90011/90012 version labels in `scripts/build-exam-packs.mjs`.** With both, `npm run verify:official-drift` reports `WDA: 269 exam levels; 276 current PDFs; 0 errors`, the publication gate passes 40/40, and answer-key re-verification passes for every occupation and common subject (90001, 90006–90012). The table below is kept as the record of what drifted.

The WDA catalog refresh found 172 pack/source mismatches, representing 10 distinct
source documents. This is a release blocker, not 172 independent question banks.
The refreshed snapshot is `source/wda-catalog.json`; keep its failing integrity
check until the affected sources are reconciled.

| Code | Shipped source | Current WDA source | Initial finding |
| --- | --- | --- | --- |
| 90006 | 900060A18 | 900060A11 | PDF text differs only in title/version header on spot-check |
| 90007 | 900070A17 | 900070A10 | Not yet content-compared |
| 90008 | 900080A16 | 900080A17 | PDF text differs only in title/version header on spot-check |
| 90009 | 900090A11 | 900090A13 | Title/version plus one spacing correction on spot-check |
| 90010 | 900100A16 | 900100A17 | Not yet content-compared |
| 90012 | 900120A10 | 900120A11 | Not yet content-compared |
| 90011 | 900110A10 | 900110A12 | Not yet content-compared |
| 17800 | 178004A13 | 178004A13 | Same filename, new revision V115081713; question 82 in work item 04 is now marked deleted |
| 90001 | 900012A10 | 900012A10 | Same filename, changed PDF bytes; content not yet compared |
| 11700 | 117002A13 | 117002A13 | Same filename, changed PDF bytes; content not yet compared |

Current WDA PDF URL pattern:
`https://owinform.wdasec.gov.tw/owInform/DLowFile/<filename>.pdf`

Next: compare all current PDFs against the stored sources by work-item question ID,
answer key, deletion marker, and prompt/options. Update the source provenance and
active flags without changing stable question IDs. Rebuild and run the answer,
integrity, publication, and UI checks before any push or deployment.
