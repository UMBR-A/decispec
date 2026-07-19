# Decispec Screenshot Plan

Capture from https://decispec.vercel.app with browser chrome hidden where the recording tool permits. Use PNG, 100% browser zoom, and the exact dimensions listed. Do not include Codex/ChatGPT overlays, developer tools, terminal windows, account menus, desktop controls, local paths, provider output, or secrets.

## Required product screenshots

| # | Filename | Dimensions | Route and state | Must be visible | Intended use | Caption |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `decispec-landing-1440x900.png` | 1440×900 | `/`, fresh load | Decispec wordmark, “Turn AI recommendations into tests,” explanation, **Instant demonstration**, **Analyze my decision**, and proof preview | Submission hero image | “Decispec turns an AI-written recommendation and its evidence into an executable decision test.” |
| 2 | `decispec-workspace-initial-1440x900.png` | 1440×900 | `/workspace/demo`, before verification | Imported **Select Vendor A**, pending Decision Test Suite, evidence rail, memo, claim inspector, graph, and **Run decision tests** | Product-overview gallery image | “Before verification, every claim is pending and the imported Vendor A recommendation is not yet treated as valid.” |
| 3 | `decispec-decision-test-suite-failure-1440x900.png` | 1440×900 | Run tests; stop on verified/broken state before focused mode | Dominant **Decision broken**, failed unit/dependency/recommendation categories, Vendor A broken state, and failure context | Problem/result image | “The deterministic suite detects a monthly-versus-year unit failure and invalidates the dependent recommendation.” |
| 4 | `decispec-evidence-formula-inspector-1440x900.png` | 1440×900 | Broken state with Vendor A support selected | Quote A passage with `$18 per device per month`, `36 months`, formula `321 × $18 × 3 years`, machine reason, and failed Unit compatibility result | Technical-evidence image | “Exact evidence and the executable formula reveal why an arithmetically plausible support total is dimensionally invalid.” |
| 5 | `decispec-focused-broken-path-1440x900.png` | 1440×900 | Select **Break this decision**; wait for animation to finish | Exactly four centered nodes—Quote A, Support cost, Vendor A total, Recommendation—plus **Decision broken** and **Show full graph** | Core-innovation image | “A load-bearing failure propagates through the four-node path to the final recommendation.” |
| 6 | `decispec-semantic-correction-preview-1440x900.png` | 1440×900 | Focused state before applying correction | Before/after diff showing `$17,334 → $208,008`, `$78,003 → $268,677`, `Vendor A → Vendor B`, the 3-years/36-months explanation, and **Apply source-bound correction** | Correction-workflow image | “The correction changes the operation—not the evidence—then previews every material downstream change.” |
| 7 | `decispec-corrected-proof-report-1440x900.png` | 1440×900 | Apply correction, open `/report/demo?state=corrected` | Green **PROOF PASSED**, corrected state, **Select Vendor B**, `$182,748` advantage, `$208,008`, `$268,677`, `$85,929`, and source register or before/after table | Final-result image | “The corrected report recomputes the totals, selects Vendor B deterministically, and preserves the exact source register.” |
| 8 | `decispec-mobile-corrected-workspace-390x844.png` | 390×844 | `/workspace/demo`, corrected state | Decispec branding, **Select Vendor B**, corrected summary, usable controls, visible **View report**, and no horizontal clipping | Mobile/responsiveness image | “The same proof and corrected recommendation remain usable on a 390-pixel mobile viewport.” |

## Optional technical-validation screenshot

| # | Filename | Dimensions | State | Must be visible | Intended use | Caption |
| ---: | --- | --- | --- | --- | --- | --- |
| 9 | `decispec-technical-validation-1440x900.png` | 1440×900 | Clean terminal crop after verification, or public GitHub repository README if terminal capture cannot hide local context | Only passing test/build totals and Decispec project identity; no shell prompt, username, absolute path, auth state, or environment output | Technical appendix, only if the submission form supports an extra image | “Decispec is covered by unit, provider, replay, export, component, and browser end-to-end verification.” |

## Capture sequence

1. Start with a fresh production tab at `/` and set 1440×900.
2. Capture the landing page.
3. Enter the deterministic workspace and capture the initial state.
4. Run the tests; capture the broad failure state.
5. Select Vendor A support and frame the evidence and formula inspector.
6. Enter focused-path mode; wait until all four nodes are visible and capture.
7. Frame the semantic diff before applying the correction and capture.
8. Apply the correction, open the report, and capture the corrected proof.
9. Set 390×844, reload the workspace, repeat the deterministic flow, and capture the corrected mobile state.
10. Inspect every image at full resolution before using it.

## Visual acceptance checklist

- Decispec is the only public product name.
- Failure red is dominant only in broken states; the corrected report stamp is green.
- The focused graph contains exactly four nodes.
- Text, formulas, evidence, status labels, and totals are readable at native resolution.
- No control is confusingly cropped and there is no page-level horizontal overflow.
- The mobile **View report** control is visible and usable.
- No screenshot shows localhost, a deployment-specific hostname, local file paths, account details, raw provider content, or secrets.
- Values are exactly `$208,008`, `$268,677`, `$85,929`, and `$182,748`; the final recommendation is Vendor B.
- Use the product screenshots as the primary gallery. Include screenshot 9 only if it remains clean and adds evidence beyond the repository link.
