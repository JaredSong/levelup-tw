# Level Up / 升級吧 Multi-Exam Public App Plan

## Summary

Build **Level Up / 升級吧** as a multi-exam public-good study platform, starting with the existing **web PWA**. The current 網頁設計乙級 app becomes the first exam pack, then we add one or two mixed high-demand 丙級/技檢 exams with visible integrity reports before considering a mobile app.

Public version will be **offline-first, free, no live AI API calls**. AI-style explanations, memory cues, commute notes, and flashcards are pre-generated during content build and bundled with the app.

## Architecture

- Keep the repo as a single PWA project for now; do not pay the monorepo/mobile tax early.
- Extract in place:
  - `src/core`: pure exam model, question keys, scoring-ready types; no React, DOM, Dexie, localStorage, or fetch imports.
  - `src/domain`: study scheduling, queues, mocks, readiness, answer randomization.
  - `scripts`: official-source import, OCR audit, image maps, integrity reports.
- Keep current web progress safe:
  - Do not rename existing `level-b-*` localStorage, Dexie DB, or sync keys until a tested migration exists.
  - Add new multi-exam data model beside old data, then migrate existing `17300/900xx` progress into the new model.
- React Native/Expo stays a follow-on, not a launch dependency. Start it only if public PWA usage or personal OCR/import demand proves the need.

## Data Model

- Introduce an exam manifest format:
  - `examId`, `level`, `titleZh`, `titleEn`, `category`, `version`, `sourceUrl`, `sourceRevision`, `sections`, `mockRules`, `questionCount`, `activeQuestionCount`.
- Generalize questions with a **composite key**, not by renaming ids:
  - Keep the official/local `id` stable (e.g. `17300-01-001`) so it stays visible and progress/attempts/explanations/backups need no primary-key rewrite.
  - Add `examId` (e.g. `web-design-b`) as the exam namespace.
  - Derive `questionKey = questionKey(examId, id)` (e.g. `web-design-b:17300-01-001`) as the multi-exam-safe storage key. Storage migrates from bare id → questionKey behind a tested migration.
  - Keep `officialOptionNumber` stable even when UI shuffles choices.
  - Support single answer, multiple answer, text-only, code, graph/image, and image-option questions.
- Add content integrity outputs for every exam:
  - question count by section
  - answer-key count
  - deleted/inactive IDs
  - image/question linkage
  - OCR/text mismatch report
  - manual verification status: `unchecked`, `spot_checked`, `fully_verified`
- Pre-generated learning content:
  - `memoryCueZh`
  - `shortExplanationZh`
  - `commuteNoteZh`
  - optional `glossaryTerms`
  - generated only from official question + official answer, never altering answer keys.

## Content Pipeline

- Source of truth order:
  1. Official WDA/技能檢定 PDFs or official downloadable files.
  2. Official answer keys.
  3. OCR only as audit/second opinion.
  4. Third-party sites only for cross-check flags, never as authority.
- Import pipeline:
  - Parse official source into raw records.
  - Normalize spacing/code/text with deterministic correction rules.
  - Attach official answer keys.
  - Detect deleted questions and mark inactive, not removed.
  - Generate image map for all graph/code/image questions.
  - Run OCR audit to flag suspicious text differences.
  - Produce `questions.json`, `exam-manifest.json`, `integrity-report.json`.
- Manual QA workflow:
  - First verify all image/code/graph questions.
  - Then verify all multiple-answer questions.
  - Then verify answer-key distribution and random samples per section.
  - No exam becomes public unless integrity report passes and manual status is at least `spot_checked`.

## Product Model

Level Up is a **free public-good study tool**, secondarily a portfolio piece. Core exam practice stays free forever: question banks, mock exams, wrong-answer review, spaced repetition, flashcards, commute notes, and offline access. No paywall around essential exam prep.

Monetization, if any, must be non-blocking:

- **Donations first**: an optional "Support this project" page (Buy Me a Coffee / GitHub Sponsors / Line Pay for Taiwan users) with clear text: "Optional. The app stays free." Add only after public launch.
- **Ads only as a last resort**, and only outside active study flows: catalog footer, post-mock summary, or one small home-tab banner. Never on the question screen, mock exam, wrong-answer review, commute notes, or flashcards.
- Launch with **no ads and no donation ask**. If hosting costs ever become real, add a transparent note ("this costs about $X/month to run") before adding any monetization.

Cost basis supports this: static hosting on Cloudflare Pages is near-free and the public build makes no live AI calls, so per-user marginal cost is ~zero.

## Product Features

- Public PWA includes:
  - exam catalog
  - exam download/offline availability
  - study dashboard per exam
  - random practice
  - fresh/new questions
  - due review
  - wrong answers
  - mock exam
  - training mock with immediate feedback
  - flashcards from memory cues
  - commute notes
  - glossary
  - answer order setting: official order or randomized
- Public AI policy:
  - No user-facing live AI API by default.
  - Public app shows bundled explanations only.
  - Private/developer build may keep live AI generation behind a local/admin token.
- UX defaults:
  - Chinese-first learning content.
  - English only when helpful for technical terms.
  - Memory cues must explain the concept, not just say "do not memorize position."
  - Image questions show the relevant crop directly, not full official pages unless fallback is needed.

## Learning Model

Level Up should combine three layers without confusing them:

- **Memory layer**: spaced repetition for atomic knowledge cards generated from memory cues, traps, formulas, numbers, and fixed procedures. Do not simply clone every multiple-choice question into a flashcard.
- **Practice layer**: full official questions, section practice, wrong-answer review, training mocks, and official-style timed mocks.
- **Motivation layer**: short daily sessions, fresh questions, due review, weak-area missions, streaks or light progress signals. Avoid heavy gamification that distracts from exam trust.

The daily routine should feel like: finish a small fresh set, clear scheduled review, repair wrong answers, then periodically run a timed mock.

## Personal Banks

Personal imports are phase 2, not the core public promise.

- Supported first: structured paste/CSV/JSON or past papers with answer keys.
- OCR is assistive: extract, highlight uncertainty, require user confirmation.
- Personal banks are stored locally and marked **Personal · unverified**.
- Personal banks never mix into official readiness, official mocks, or public catalog integrity.
- Syllabus/textbook-only uploads are not trusted content unless the user supplies or confirms answers. AI-generated practice, if ever added, must be labeled **AI-generated · not official**.

## Mobile App Plan

- Use **Expo React Native + TypeScript**.
- Start only after the PWA proves demand.
- Navigation:
  - Catalog
  - Study
  - Practice
  - Mock
  - Review
  - Glossary
  - Settings
- Mobile storage:
  - Store progress per `examId`.
  - Store attempts, sessions, bookmarks, notes, and mock history.
  - Store content version used for each attempt so future bank updates do not corrupt old records.
- Mobile media:
  - Bundle common exam images with app release.
  - Support remote content pack updates later.
  - Voice/commute notes use device TTS first; pre-recorded/generated audio can be added later if needed.

## Rollout

1. Add the current 網頁設計乙級 exam manifest and `examId` while keeping visible behavior unchanged.
2. Introduce `questionKey(examId, id)` and a tested migration path from old bare IDs.
3. Extract pure exam/study logic in place; enforce that `src/core` stays platform-free.
4. Add public catalog and per-exam dashboard in the PWA.
5. Add one or two high-demand exams only after importer + integrity reports pass.
6. Add personal structured import, quarantined from official banks.
7. Add OCR-assisted personal import if users actually need it.
8. Start Expo mobile only after PWA demand justifies on-device OCR/store discovery.

## Test Plan

- Core tests:
  - scoring single/multiple questions
  - official option numbers preserved under randomization
  - image-option questions never shuffle
  - mock composition per exam manifest
  - due/wrong/fresh/high-yield queues
  - readiness by section and exam
- Import tests:
  - parsed question count matches official count
  - answer keys attached and valid
  - inactive/deleted questions excluded from practice
  - every image question has a valid crop or fallback page
  - OCR audit flags suspicious mismatches
- Migration tests:
  - existing Level B progress migrates without loss
  - old backups still import
  - old sync/local keys are not deleted
- UI tests:
  - web smoke test for catalog, practice, mock, wrong review
  - offline launch with bundled exam data
- Future mobile tests:
  - same catalog/practice/mock flows on iOS and Android once Expo begins
- Release checks:
  - build web
  - build Expo preview
  - verify app name: `Level Up / 升級吧`
  - verify no public screen requires AI token or internet for core studying

## Assumptions

- Stack choice for a future native app is **React Native/Expo**, not Flutter.
- Public release is **PWA first**; mobile is a later proven-demand step.
- Exam roadmap is **mixed top demand**, not IT-only.
- Live AI is not included for public users; explanations are pre-rendered.
- Existing 網頁設計乙級 users must not lose progress during the transition.
