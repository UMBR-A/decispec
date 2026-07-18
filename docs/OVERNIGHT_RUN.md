# ASSERT Overnight Run

## Honest outcome

The offline product, live user workflow, real TXT/PDF input, Decision Test Suite, branding preparation, documentation, and local quality gates are complete. The project is **not** ready to call fully complete or deploy: all three permitted paid requests were exhausted without one live response reproducing the expected monthly-versus-year unit failure through the final semantic postcondition.

Overall local completion estimate: **88%**.

- Core engine: **98%** — deterministic fixture, strict provider validation, semantic graph traversal, correction, selector, reports, and exports pass.
- Live product: **84%** — server-only live UI and real documents work with safe errors and mocked coverage; the bounded real-provider acceptance proof remains blocked.
- Submission readiness: **86%** — README, architecture, demo script, checklist, screenshots, and QA exist; public name, live acceptance, deployment, video, and eligibility confirmations remain.

## Safety envelope observed

- `OPENAI_API_KEY` remained in ignored, untracked `.env.local`; its value was never read into output, printed, logged, returned, screenshot, or committed.
- Every paid request used `gpt-5.6-terra`, low reasoning, `store:false`, no tools, no conversation linkage, zero retries, and a 90-second timeout.
- No deployment, commit, push, PR, billing change, destructive action, or automatic dependency fix was performed.
- Provider/document content was not inspected after rejection. Only safe stage/code/path/ID/count/request metadata was retained.

## Live requests used

**3 of 3 additional requests. No further paid request is authorized.**

| # | Safe result | Request ID | Latency | Usage |
|---|---|---|---:|---:|
| 1 | `recommendation / CANDIDATE_LABEL_MISMATCH / $.graph.recommendation` | `req_27362f5a45404663b89fdabe17b0af6f` | 26.360 s | 1,866 input / 3,897 output / 5,763 total |
| 2 | `numeric-provenance / NUMERIC_VALUE_NOT_BOUND / $.graph.nodes[3].value`, safe node ID `comparison-period` | `req_06f8de2acd6444fd879cbf1c2b450735` | 17.861 s | 2,053 input / 2,971 output / 5,024 total |
| 3 | `units / PATH_ASSERTION_FAILED / $.evaluation.nodes`, `unitFailures: 0` | `req_b502ee8efbe74e03a095ced138aeea02` | 29.902 s | 2,107 input / 3,575 output / 5,682 total |

Request 1 was repaired by making recommendation metadata exact candidate-label references. Request 2 was repaired with conservative lexical period provenance: only one-through-twelve immediately coupled to `month(s)` or `year(s)` can map to the exactly compatible unit. Request 3 passed earlier provider checks and deterministic execution, but its graph contained no locally detectable unit failure; validation correctly rejected it instead of weakening the engine.

## Work completed

- Replaced brittle fixture-ID/array-order smoke assertions with typed candidate validation and semantic dependency paths.
- Added stable safe codes for candidate, policy, and path failures; preserved metadata after engine/postcondition failures.
- Added randomized-ID, reordered-node/edge/candidate, invalid-reference, selector, tie, policy, provenance, and no-leak tests.
- Connected **Analyze my decision** to the server provider only after explicit user action, with honest progress, duplicate-submit prevention, cancellation, and no demo fallback.
- Added server-side TXT and text-PDF extraction with stable SHA-256-based IDs, page labels, size/content limits, and safe encrypted/empty/image-only/malformed errors. OCR is explicitly unavailable.
- Added the engine-derived **Decision Test Suite**: evidence, provenance, arithmetic, units, policies, dependencies, and recommendation validity.
- Generalized full proof-graph layout for opaque provider IDs while preserving the four-node demo focus mode.
- Centralized product name, description, metadata, report label, and social text in `lib/config/brand.ts`.
- Prepared README, architecture, demo script, submission checklist, and clean screenshots.
- Skipped a second deterministic example: it was optional and not worth expanding the engine while the real live acceptance proof remained unresolved.

## Verification results

| Check | Result |
|---|---|
| Fresh `npm ci` | Pass — 618 packages installed from lockfile |
| TypeScript | Pass |
| ESLint | Pass — zero errors, zero warnings |
| Unit/component/provider/route tests | Pass — 71 passed, 1 paid smoke test skipped by default |
| Production build | Pass — landing, two workspaces, report, analyze API, extraction API |
| Playwright | Pass — 4/4 |
| Deterministic hero/correction/report/export | Pass |
| Focused/full graph switching | Pass |
| Mocked live provider and no fallback | Pass |
| Real TXT + real text PDF extraction | Pass |
| Keyboard navigation + reduced motion | Pass |
| 1440×900 and 390×844, no horizontal overflow | Pass; visually inspected |
| Browser console errors in hero/live tests | None |
| Secret/key-pattern audit | Pass |

Clean screenshots are in `docs/qa/`, including landing, live input, focused failure path, correction diff, corrected report, and mobile live input.

## Dependency audit

`npm audit --omit=dev` reports 3 installed findings: 1 high and 2 moderate.

- `ws` high severity is installed through Cloudflare development tooling and as an optional OpenAI peer. ASSERT's production path uses the Responses HTTP API and does not open WebSockets, so the vulnerable WebSocket paths are not application-reachable in the current product.
- Next's nested `postcss` moderate advisory concerns CSS stringification. ASSERT does not accept or stringify user CSS at runtime; the vulnerable behavior is not application-reachable in the current routes.
- The full audit reports 14 findings (1 low, 7 moderate, 6 high), largely in development/build tooling.

No automatic fix was applied. The suggested forced fix would install an incompatible/breaking Next version and is outside scope.

## Security audit

- `.env.local`: ignored, untracked, and never included in response/screenshot output.
- Key-shaped values outside environment files: none found.
- Frontend `OPENAI_API_KEY` references: none.
- Client responses: validated proposal/evaluation or safe diagnostics only; no raw provider response/error.
- Model-generated code/arbitrary expressions: never executed.
- Screenshots: no secrets, provider output, development overlay, Codex overlay, or desktop chrome.
- Git: no commit, push, or publication. The workspace has no useful tracked baseline, so `git diff` cannot provide a complete change inventory; the explicit file inventory below is authoritative for this run.

## Files changed in this run

- Configuration: `.gitignore`, `.env.example`, `package.json`, `package-lock.json`
- App: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/api/analyze/route.ts`, `app/api/documents/extract/route.ts`, `app/workspace/live/page.tsx`
- Components: `DecisionWorkspace.tsx`, `ProofGraph.tsx`, `ProofReportView.tsx`, `DecisionTestSuite.tsx`, `LiveAnalysisWorkspace.tsx`
- Domain/provider: `lib/domain/engine.ts`, `lib/domain/schemas.ts`, `lib/domain/test-suite.ts`, `lib/providers/analysis-provider.ts`, `lib/providers/openai-analysis-provider.ts`, `lib/providers/safe-validation.ts`, `lib/providers/live-proof.ts`
- New support: `lib/config/brand.ts`, `lib/documents/extract.ts`
- Tests: `tests/analysis-provider.test.ts`, `tests/analyze-route.test.ts`, `tests/document-extraction.test.ts`, `tests/live-analysis-smoke.test.ts`, `tests/live-proof.test.ts`, `tests/live-workspace.test.tsx`, `e2e/hero-flow.spec.ts`, `e2e/live-flow.spec.ts`
- Documentation: `README.md`, `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md`, `docs/SUBMISSION_CHECKLIST.md`, `docs/OVERNIGHT_RUN.md`, `docs/qa/*.png`

## Remaining blockers

1. **End-to-end live acceptance:** no permitted request produced the expected local monthly/year failure and complete corrected proof. A future run needs a new explicit paid-request allowance and a provider-contract repair that makes the erroneous memo calculation explicit without hard-coding the expected answer.
2. **Public name:** assert.dev is an existing software company. User must approve a final public name before submission/deployment.
3. **Release authority:** deployment, repository publication, video, eligibility/guardian confirmation, feedback session ID, and deadline verification require user action.
4. **Dependency findings:** currently not reachable in the used application paths, but should be re-evaluated against compatible upstream releases before production.

## Exact resume commands/actions

```powershell
cd path\to\Decispec
npm ci
npm run verify
npm run test:e2e
npm audit --omit=dev
```

Before another live smoke test: approve one additional paid request, repair the semantic unit-mismatch contract offline, rerun all local gates, then run exactly one bounded smoke request. Before deployment: choose the public name, resolve/accept the audit posture, provision the server-only production key, and complete `docs/SUBMISSION_CHECKLIST.md`.

## Deployment recommendation

**Not yet safe to deploy as a public submission.** The deterministic demo is release-quality locally, and the live UI is safe behind mocked/route validation, but public live mode should remain gated until the real end-to-end acceptance proof passes and the public name is approved.
