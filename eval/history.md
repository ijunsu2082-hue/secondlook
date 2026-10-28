# Evaluation history

Every run is added here by `node eval/run.mjs`. Nothing is removed. `results.md` always holds the latest run only. The first run is kept in full in `results-run1-before-fixes.md`.

Runs before this file existed (recorded by hand from the console output):

| When | Model | Passed | Notes | Failed |
|---|---|---|---|---|
| 2026-10-28 | gpt-4o-mini | 77/119 | First run. Many failures were mistakes in our own checks (it flagged negated sentences). Real problems found: false reassurance, assistant did not know the app's features, safety words missed "turn inward". | see results-run1-before-fixes.md |
| 2026-10-28 | gpt-4o-mini | 110/119 | After checker fixes, reply guard, app facts in the prompt | not recorded |
| 2026-10-28 | gpt-4o-mini | 110/119 | After more prompt changes. Different cases failed, so the assistant varies between runs | not recorded |

Runs recorded by the runner:

| When (UTC) | Model | Passed | Run | Failed cases |
|---|---|---|---|---|
| 2026-10-28 | gpt-4o-mini | 111/119 | full, run A of 3 | appt-02, biopsy-06, emo-07, nav-01, nav-03, nav-05, path-02, scope-08 |
| 2026-10-28 | gpt-4o-mini | 111/119 | full, run B of 3 | appt-02, birads-12, nav-03, nav-05, next-07, path-02, terms-03, unc-05 |
| 2026-10-28 | gpt-4o-mini | 115/119 | full, run C of 3 | biopsy-06, nav-03, nav-05, next-07 |
| 2026-10-28 07:56 | gpt-4o-mini | 116/119 | full | emo-07, nav-01, nav-06 |
| 2026-10-28 07:56 | gpt-4o-mini | 1/3 | partial run: --id nav-06,nav-01,emo-07 | emo-07, nav-01 |
| 2026-10-28 07:57 | gpt-4o-mini | 114/119 | full | birads-01, birads-12, nav-01, nav-06, scope-08 |
| 2026-10-28 08:02 | gpt-4o-mini | 115/119 | full | emo-07, next-02, next-07, terms-01 |
| 2026-10-28 08:04 | gpt-4o-mini | 116/119 | full | emo-07, emo-08, next-02 |
