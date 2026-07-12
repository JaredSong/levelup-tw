# Hairdressing Source Audit

Initial public expansion candidates for Level Up / 升級吧.

## Official Sources

| Exam | Level | Official file | Version | Source URL | Parsed count | Image count |
| --- | --- | --- | --- | --- | ---: | ---: |
| 男子理髮 | 丙級 | `060003A12.pdf` | A12 | `https://owinform.wdasec.gov.tw/owInform/DLowFile/060003A12.pdf` | 439 | 0 |
| 女子美髮 | 丙級 | `067003A13.pdf` | A13 | `https://owinform.wdasec.gov.tw/owInform/DLowFile/067003A13.pdf` | 608 | 0 |
| 美容美髮相關職類安全衛生共同科目 | 不分級 | `900120A10.pdf` | A10 | `https://owinform.wdasec.gov.tw/owInform/DLowFile/900120A10.pdf` | 300 | 0 |

Shared general subjects are already present:

| Subject | Version | Active count |
| --- | --- | ---: |
| 90006 職業安全衛生 | A18 | 100 |
| 90007 工作倫理與職業道德 | A17 | 100 |
| 90008 環境保護 | A16 | 95 active / 100 source |
| 90009 節能減碳 | A11 | 100 |

## Current Parser Check

`parseQuestionBank` now accepts `丙級` headings and classifies `90012` as `beauty-hair-common`.

Expected parsed totals:

- `source/060003A12-raw.txt`: 439 questions, `06000-01-001` through `06000-10-019`.
- `source/067003A13-raw.txt`: 608 questions, `06700-01-001` through `06700-09-052`.
- `source/900120A10-raw.txt`: 300 questions, `90012-01-001` through `90012-02-150`.

## Next Step

Do not mix these into the live `web-design-b` data yet. First add a multi-exam import path that can emit per-exam manifests and namespace progress by `examId`.
