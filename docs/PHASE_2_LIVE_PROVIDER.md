# Phase 2 live analysis provider boundary

Phase 1 stops at a schema-validated provider interface and a deterministic demo implementation. It does not call an AI service, include an SDK, inspect credentials, or configure secrets.

The future live provider will:

- Implement the existing `AnalysisProvider` contract without changing graph evaluation or product state.
- Run only on the server.
- Read `OPENAI_API_KEY` only in the server environment and never expose it to client code, logs, exports, or browser-visible configuration.
- Use the OpenAI Responses API with the `gpt-5.6` model alias.
- Use Structured Outputs that match the runtime domain schema.
- Normalize source documents and draft memo text before analysis.
- Send files at an intentional detail level appropriate to the evidence task, avoiding unnecessary fidelity and data exposure.
- Return source-bound claims, typed calculation specifications, declared assumptions, dependency edges, and proposed corrections for review.
- Never execute generated code and never silently repair evidence.

The deterministic proof engine remains authoritative for graph validation, cycle rejection, source-ID validation, calculation execution, unit tests, state propagation, corrections, diffs, and proof reports. Provider-produced semantic judgments remain visible and reviewable.

Phase 2 should add server-route tests for schema failures, provider timeouts, malformed source references, and safe error disclosure before the live provider is enabled in the interface.
