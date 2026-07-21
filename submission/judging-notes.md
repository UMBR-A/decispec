# Decispec Judging Notes

Live application: https://decispec.vercel.app

Repository: https://github.com/UMBR-A/decispec

## What problem does this solve?

AI-written recommendations often compress evidence, arithmetic, assumptions, policy constraints, and the final conclusion into persuasive prose. A document can cite the correct source and still apply it incorrectly. Decispec makes the evidence-to-decision chain executable and inspectable, so a reviewer can see exactly where a result stops following.

## Who would use it?

Teams reviewing consequential recommendations: procurement, finance, operations, policy, compliance, technical governance, and consultants preparing decisions for approval. The proof model is domain-independent within its typed operation vocabulary.

## Why is this more than a chatbot wrapper?

The model is not the judge. It may propose semantic structure, but strict schemas and local validators recover evidence, numeric values, and units; validate the graph; materialize calculation dependencies; and reject unsupported structure. A deterministic TypeScript engine performs arithmetic, unit checking, failure propagation, correction, policy-aware selection, integrity scoring, report generation, and export.

## What is technically difficult about it?

The difficult part is preserving a useful AI boundary without transferring authority to the model. Decispec combines stable source segmentation, strict structured output, exact source materialization, numeric and unit provenance recovery, a typed calculation contract, DAG validation, deterministic execution, atomic correction dependency materialization, safe diagnostics, and agreement between UI, report, and export. These parts must reject plausible but unsupported output without silently falling back.

## How does the proof graph work?

Each node is a fact, policy, calculation, comparison, assumption, or recommendation. Typed edges express calculation inputs, policy constraints, evidence support, or semantic relationships. Calculation references are authoritative and are locally materialized as edges. The engine rejects unknown nodes, invalid edges, and cycles, then evaluates the DAG in topological order. A node with an unavailable broken dependency becomes broken, and that status propagates downstream.

## How are corrections propagated?

A correction targets a specific calculated node and supplies a replacement structured operation. Before evaluation, Decispec validates every operand, removes obsolete calculation-input edges, materializes the new dependencies, and rejects self-dependencies or cycles. The graph then reevaluates from the corrected operation.

## How is deterministic behavior preserved?

The engine accepts enumerated operations and typed units, not arbitrary expressions or generated code. Provider statuses and calculated values are reset or overwritten locally. Source-bound values and units are recovered from exact evidence. The same evaluated graph drives the workspace, semantic diff, report, and JSON export. Captured provider replays and randomized IDs/orderings verify that semantics do not depend on opaque provider identifiers or array position.

## What role can AI play?

AI is useful for proposing a compact semantic plan from unstructured evidence: likely claims, source relationships, structured operations, dependencies, assumptions, candidate-selection structure, and possible corrections. It accelerates compilation from prose. It does not determine whether those proposals pass or what the final winner is.

## How does the AI provider remain constrained?

The core product is the deterministic verification engine and proof experience. The provider proposes structure only after explicit user action. A provider outage or invalid response produces a safe error and is never disguised as a valid result.

## How does Decispec prevent fabricated confidence?

- Unsupported evidence or unknown segment IDs are rejected.
- Numeric facts must bind to numeric-evidence atoms and be recoverable from exact source text.
- Derived values require executable operations.
- Unit conversion must be explicit.
- Assumptions remain labeled as assumptions.
- Broken dependencies invalidate dependent conclusions.
- The model cannot authoritatively set status, integrity, or the winner.
- Live failures never fall back to fabricated evaluated output.
- Reports distinguish not verified, broken, valid, and corrected states.

## What happens when evidence is missing?

The validator rejects missing or unknown evidence references before execution. In the deterministic engine, a missing source binding breaks the claim and propagates through dependent nodes. If evidence is insufficient for a live proposal, the provider is instructed to return the smallest honest graph rather than invent facts; local validation still decides whether it is usable.

## What are the limitations?

Decispec cannot guarantee that all relevant evidence was supplied or that a real-world policy was interpreted correctly. Its calculation and unit vocabulary is deliberately narrow. It does not support OCR, scanned/image-only PDFs, spreadsheets, or image reasoning. Live semantic proposals can be rejected and require human review. Durable user accounts, project storage, collaboration, approvals, and signed artifacts are not yet implemented. Live AI analysis is not configured on the public deployment.

## What would be built next?

1. OCR and structured spreadsheet evidence with the same provenance guarantees.
2. More typed policy, eligibility, currency, and time operations without introducing arbitrary code.
3. Versioned decision workspaces, reviewer comments, approval workflows, and signed proof artifacts.
4. Domain-specific evaluation sets and adversarial provider regression suites.
5. Enterprise evidence connectors, retention controls, and deployment governance.

## What was completed during the hackathon?

- A responsive landing page, deterministic workspace, live-input workspace, proof graph, Decision Test Suite, correction experience, report, and JSON export.
- A deterministic DAG engine with typed units, arithmetic, failure propagation, semantic diffs, correction/undo/replay, and candidate selection.
- Exact evidence and source-segment models, server-side TXT/text-PDF extraction, strict provider schemas, provenance recovery, safe diagnostics, and prompt-injection defenses.
- Captured provider replay, randomized-ID/order regression coverage, export lifecycle tests, component/route tests, and six Playwright end-to-end scenarios.
- A Vercel production deployment with public canonical/social metadata and a credential-free judge path.

## Strongest judging points

1. **Clear problem and visible failure:** the monthly/year error is understandable in seconds and materially changes the decision.
2. **Real technical boundary:** AI proposes; deterministic validation and execution decide.
3. **End-to-end coherence:** exact evidence, formulas, graph, correction, report, and export all agree.
4. **Honest failure behavior:** missing credentials or invalid provider output produce safe errors, never fake success.
5. **Workflow reliability:** the complete experience is deployed, responsive, and guarded by safe failure behavior.

## Concise closing answer

Decispec does not ask a second model whether the first model looks correct. It converts the recommendation into a constrained, source-bound program and runs it. That is the difference between another opinion and a testable decision artifact.
