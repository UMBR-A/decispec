# Decispec Screenshot Plan

Capture the deployed production application with a clean browser profile. Do not include desktop controls, developer tools, automation overlays, secrets, local paths, provider output, or unrelated tabs.

| # | Filename | Viewport | State | Required content |
| --- | --- | --- | --- | --- |
| 1 | `decispec-landing-1440x900.png` | 1440×900 | `/`, fresh load | Product name, positioning, required inputs, and **Analyze my decision** |
| 2 | `decispec-live-input-1440x900.png` | 1440×900 | `/workspace/live` | Recommendation and evidence inputs, readiness state, and **Test decision** |
| 3 | `decispec-analysis-progress-1440x900.png` | 1440×900 | Analysis running | Honest processing state and current validation stage |
| 4 | `decispec-decision-broken-1440x900.png` | 1440×900 | Analysis complete | Dominant broken status, failure reason, and Decision Test Suite |
| 5 | `decispec-focused-path-1440x900.png` | 1440×900 | Broken result | Focused dependency path and readable node labels |
| 6 | `decispec-correction-preview-1440x900.png` | 1440×900 | Before applying correction | Semantic before/after change and correction action |
| 7 | `decispec-corrected-report-1440x900.png` | 1440×900 | Correction applied | Verified stamp, recomputed values, recommendation, and export controls |
| 8 | `decispec-mobile-live-workspace-390x844.png` | 390×844 | `/workspace/live` | Usable inputs and controls with no horizontal clipping |

Inspect every capture at full resolution. Failure red must dominate only broken states; a passed report uses verified green or graphite. Text, formulas, evidence, totals, status labels, and graph controls must remain legible.
