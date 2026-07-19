# Decispec Project Description

Live demo: https://decispec.vercel.app

Source: https://github.com/UMBR-A/decispec

## One-sentence description

Decispec turns AI-written recommendations into executable, source-bound tests that show whether the conclusion follows from the evidence, calculations, units, dependencies, assumptions, and decision rule.

## Short description

AI can write a recommendation that sounds rigorous while quietly mixing billing periods, omitting a recurring cost, or carrying a broken number into the conclusion. Decispec compiles that prose into an executable decision specification. It binds claims to exact source evidence, recalculates typed operations, checks units and policies, and propagates failures through a proof graph. Corrections change the executable dependency structure rather than rewriting evidence, and a deterministic selector recomputes the winner. The bundled demonstration catches a monthly-versus-year error, corrects Vendor A to `$268,677`, preserves Vendor B at `$85,929`, and deterministically recommends Vendor B.

## Full description

Generative AI is increasingly used to draft procurement memos, policy recommendations, investment cases, operating plans, and other decisions. The output can look complete: it cites evidence, presents arithmetic, and ends with a confident recommendation. But the chain from source material to conclusion usually remains prose. A monthly rate can be treated as annual, a policy constraint can be omitted, or an unsupported assumption can become load-bearing without a reviewer seeing exactly where the proof stopped working.

Decispec addresses that gap by compiling an AI-written recommendation into an executable decision specification. Each material claim is represented as a typed node bound to exact source evidence or declared explicitly as an assumption. Derived claims use a constrained set of structured operations. Calculation and policy dependencies form a directed acyclic graph that is evaluated in topological order by deterministic TypeScript code.

The core innovation is the separation between semantic proposal and evaluated truth. An optional AI provider may identify source relationships, claims, calculations, dependencies, assumptions, corrections, and candidate-selection structure. It may not authoritatively decide claim status, arithmetic, unit compatibility, integrity, diffs, or the winner. Stable source segments, strict schemas, provenance validators, and the deterministic proof engine control those results. If the provider fails or produces invalid structure, Decispec rejects it safely; it does not substitute a convincing demonstration result.

The bundled synthetic demonstration makes this visible. A school-device memo recommends Vendor A using a three-year cost of `$78,003`. The evidence says support costs `$18 per device per month` for 36 months, but the memo multiplies that monthly rate by three years. Decispec marks the support calculation dimensionally incompatible and propagates the break through Vendor A’s total to the recommendation. A focused graph isolates `Quote A → Support cost → Vendor A total → Recommendation`.

The user can then inspect a semantic before/after correction. No evidence is changed. The operation replaces the incompatible three-year duration with the source-bound 36-month term, materializes the corrected calculation dependency, and recomputes the graph. Vendor A support becomes `$208,008`; Vendor A totals `$268,677`; Vendor B remains `$85,929`; and the deterministic selector recommends Vendor B with a `$182,748` cost advantage. The corrected report and JSON export use the same evaluated graph, so statuses and values agree.

Decispec is useful for teams that must review consequential AI-assisted recommendations: procurement, finance, operations, policy, compliance, and technical governance. It provides a concrete artifact for asking not merely “does this answer sound right?” but “which evidence and executable steps make this conclusion follow?”

The project does not claim to guarantee correctness. It can only verify the evidence, assumptions, operations, policies, and dependencies represented in the proof. Text-based TXT/PDF extraction is supported, but OCR, scanned documents, spreadsheets, broad domain reasoning, and durable collaborative projects are future work. The public deployment intentionally leaves optional live AI analysis unconfigured; the complete deterministic demonstration requires no credentials.

## Problem

AI recommendations can hide arithmetic, unit, evidence, and dependency errors inside persuasive prose. Reviewers lack a compact way to trace a conclusion back through executable steps to exact source material.

## Solution

Compile the recommendation into a source-bound proof DAG, validate the graph and provenance, execute calculations deterministically, propagate failures, and produce an auditable correction and report.

## Key innovation

AI proposes semantic structure; deterministic code and exact source evidence remain authoritative. This makes the provider useful without allowing model confidence to become proof.

## Impact

Decispec can make AI-assisted decision review faster and more inspectable while preserving human responsibility for evidence completeness, policy interpretation, and the decision itself.

## Technical implementation

Next.js, React, and TypeScript power the application. Zod and custom validators enforce strict provider and domain contracts. React Flow renders the proof DAG. The engine performs dependency materialization, topological execution, dimensional checking, correction, semantic diffing, policy-aware selection, and report/export generation. Vitest, Testing Library, captured provider replays, randomized-ID tests, and Playwright cover the trust boundary and end-to-end experience.

## Limitations

Decispec does not discover every missing fact or guarantee real-world correctness. Its operation and unit vocabulary is intentionally constrained. OCR and image/scanned PDF understanding are not implemented. Live AI analysis can fail validation and is not configured in the public deployment.

## Future roadmap

Add OCR and structured spreadsheet evidence, expand typed policy operations, create durable versioned decision workspaces, support review/approval workflows and signed proof artifacts, build domain-specific evaluation sets, and connect enterprise evidence sources under explicit privacy controls.
