# Level Up / 升級吧 Interface Spec

## Product Feel

Level Up should feel like a calm hybrid of:

- Anki: focused review and memory work.
- Duolingo: light daily motivation and one clear next action.
- Certification apps: clear exam structure, sections, mocks, and progress.

The app is PWA-first and local-first, so the interface should stay lightweight, modular, and fast. Avoid heavy dashboards, marketing pages, or decorative gamification. The product promise is trustworthy exam prep, not entertainment.

## Navigation Model

Use five primary destinations:

- **Home**: what should I do now?
- **Practice**: work through official questions.
- **Review**: clear due memory cards.
- **Mock Exam**: simulate the real test.
- **Insights**: understand weak points and readiness.

Mobile uses bottom tabs. Desktop uses the same five destinations in a left rail. The mental model should stay identical across form factors.

The shortest product rule set:

- **Home = decide for me.**
- **Practice = let me work full questions.**
- **Review = let me clear due memory items.**
- **Mock Exam = test me under exam conditions.**
- **Insights = show me where I am weak.**
- **Catalog = choose exam.**
- **Settings = manage local app behavior.**

## Home

Home is the daily entry point. It should remove decision friction and feel encouraging.

Primary jobs:

- Show current exam pack and local/offline status.
- Show today’s study bundle.
- Provide one obvious continue action.
- Surface recent mistakes and due work without overwhelming the user.
- Surface wrong-answer retry count.
- Surface weak-area recommendation.
- Surface mini mock or last mock summary.
- Show daily streak or daily completion status lightly.

Suggested layout:

- Header: exam name, streak or daily status, local profile badge, offline-ready indicator.
- Main card: **Today’s Mission** with three counters, such as due reviews, wrong-answer retries, and mini mock.
- Secondary entry points: Resume Practice, Due Now, Recent Mistakes, Last Mock Score.

Home can borrow a little Duolingo energy, but keep it quiet. Streaks and celebrations should support studying, not become the product.

## Practice

Practice should feel like an exam question-bank app, not a flashcard app.

Primary jobs:

- Browse or launch official-question sessions.
- Filter by exam, section, topic, question count, common subjects, and mode.
- Answer one question at a time with large tap targets.
- Capture wrong answers, bookmarks, and review candidates.
- Show short feedback after answering.
- Preserve official option numbering even when display order is randomized.
- Show the relevant media/image crop when needed.
- Support retry later and high-yield/review-candidate marking.

Suggested layout:

- Filter bar or sheet: exam, section/topic, count, mode, answer-order setting.
- Question workspace: prompt, media/crops, options, bookmark, add-to-review.
- After-answer panel: correct/incorrect state, short Chinese explanation, retry later, extract atom, next.

Avoid crowded tables inside Practice. One question per screen is the right default, especially on phones.

## Review

Review should be the most focused screen in the app. It should feel closer to Anki than a question bank.

Primary jobs:

- Show one due memory item.
- Reveal answer/explanation.
- Grade recall quickly.
- Keep scheduling state separate from full-question attempts.
- Show next interval preview.
- Link back to the source official question.
- Support suspend or skip for a card.
- Keep review history separate from question-attempt history.

Suggested layout:

- Minimal top strip: due count, topic tag, source badge, suspend icon.
- Card body: front prompt first; answer and memory cue after reveal.
- Bottom grade bar: Again, Good, Easy for MVP. Add Hard later only if needed.
- Small metadata drawer: next interval preview, related official question, stability/difficulty if useful.

This screen should be almost blank. It needs concentration, not feature density.

## Mock Exam

Mock Exam should feel serious and disciplined. Keep gamification low here.

Primary jobs:

- Run official-style timed exams.
- Support free navigation, flags, unanswered review, and submit confirmation.
- Hide answers during official mock mode.
- Feed missed items back into wrong-answer and memory workflows.
- Build the question set from exam rules.
- Show answered, unanswered, and flagged counts.
- Support training mock mode with immediate feedback.
- Score pass/fail against the exam threshold.

Suggested layout:

- Sticky top bar: countdown, answered count, flagged count, submit.
- Main area: one full question and options.
- Navigator sheet: question numbers with answered/flagged/current states.
- End screen: score, pass/fail, weak sections, review missed, practice weak group, send mistakes to review.

Training mock can show feedback after each answer. Official mock should stay answer-hidden until submit.

## Insights

Insights should behave like a study coach, not a BI dashboard.

Primary jobs:

- Show weak topics.
- Show due and overdue load.
- Show mock trend against pass line.
- Show habit consistency.
- Point the user toward the next useful action.
- Show unresolved wrong-answer clusters.
- Show tomorrow or near-future review load forecast.
- Show readiness by section or exam.

Suggested cards:

- Weak Topics: ranked by wrong frequency, unresolved mistakes, and recent accuracy.
- Review Load: due today, overdue, expected tomorrow.
- Mock Trend: last five scores and pass line.
- Habit: streak, weekly completion, mission consistency.

Desktop can use two columns. Mobile should be one column. Keep charts simple and readable.

## Visual Language

Use a soft exam-serious style:

- Warm neutral background.
- Quiet cards with restrained borders.
- One primary accent color for study actions.
- One warning color for overdue or urgent states.
- Gold/flame only for streaks or mission celebration.

Screen tone:

- Home: encouraging.
- Practice: utilitarian.
- Review: minimal.
- Mock Exam: disciplined.
- Insights: analytical but calm.

Do not make it neon, arcade-like, or startup-gamified. Trust is the brand.

## Component Map

Keep page files light. Put reusable pieces into focused components.

Home:

- `HomePage`
- `TodayMissionCard`
- `ResumeCard`
- `RecentMistakesCard`
- `OfflineStatusBadge`

Practice:

- `PracticePage`
- `PracticeFilters`
- `QuestionCard`
- `QuestionMedia`
- `AnswerOptionList`
- `AnswerFeedbackPanel`

Review:

- `ReviewPage`
- `ReviewCardView`
- `ReviewRevealPanel`
- `ReviewGradeBar`
- `ReviewMetaDrawer`

Mock Exam:

- `MockExamPage`
- `ExamTopBar`
- `ExamQuestionView`
- `QuestionNavigatorSheet`
- `MockResultBreakdown`

Insights:

- `InsightsPage`
- `WeakTopicsCard`
- `LoadForecastCard`
- `MockTrendCard`
- `HabitCard`

Catalog, Exam Pack, and Settings are secondary shell surfaces for the multi-exam phase. They should stay out of the bottom navigation until the app has more than one public exam pack.

Catalog:

- `CatalogPage`
- `ExamCatalogList`
- `ExamCatalogCard`
- `DownloadExamPackButton`
- `IntegrityStatusBadge`

Exam Pack:

- `ExamPackPage`
- `ExamPackHeader`
- `ExamPackStats`
- `ExamPackSections`
- `ExamPackActions`

Settings:

- `SettingsPage`
- `AnswerOrderSetting`
- `ThemeSetting`
- `BackupActions`
- `OfflinePackManager`
- `VersionInfo`

## Implementation Notes

- Keep UI pages thin; push learning logic into `src/core`, `src/domain`, and local services.
- Do not merge Practice and Review into one overloaded screen. Full-question practice and memory-card review are different mental modes.
- Always preserve official option numbers, even when the UI randomizes display order.
- Image questions should show the relevant crop directly and keep fallback source pages out of the default view.
- Public build should not require live AI. Explanations and memory cues should be bundled or locally generated from trusted content.

## Near-Term UI Sequence

1. Keep current Study tab working while contracts/services evolve.
2. Introduce Home as the new default once `DailyMission` exists.
3. Split current study actions into Practice, Review, and Mock Exam destinations.
4. Move readiness and weak-group work into Insights.
5. Add catalog only after the current exam behaves like an exam pack.

This sequence avoids a cosmetic redesign before the learning model is ready.
