# Phase 2 live analysis provider boundary

The live provider is implemented behind a strict server-only boundary and is invoked only after explicit user action.

The live provider:

- Implement the existing `AnalysisProvider` contract without changing graph evaluation or product state.
- Run only on the server.
- Read `OPENAI_API_KEY` only in the server environment and never expose it to client code, logs, exports, or browser-visible configuration.
- Uses the OpenAI Responses API with the configured `OPENAI_MODEL` (default `gpt-5.6`), `store: false`, no tools, and zero SDK retries.
- Use Structured Outputs that match the runtime domain schema.
- Normalize source documents and draft memo text before analysis.
- Send files at an intentional detail level appropriate to the evidence task, avoiding unnecessary fidelity and data exposure.
- Return source-bound claims, typed calculation specifications, declared assumptions, dependency edges, and proposed corrections for review.
- Never execute generated code and never silently repair evidence.

The deterministic proof engine remains authoritative for graph validation, cycle rejection, source-ID validation, calculation execution, unit tests, state propagation, corrections, diffs, and proof reports. Provider-produced semantic judgments remain visible and reviewable.

Local configuration lives only in ignored `.env.local`:

```dotenv
OPENAI_API_KEY=your-project-key
OPENAI_PROVIDER=openai
OPENAI_MODEL=gpt-5.6
```

`GET /api/analyze/status` returns only readiness booleans plus provider/model names. It never returns, logs, hashes, or partially reveals the key. Missing keys, unsupported providers, invalid model names, authentication, quota, rate limits, timeouts, transport failures, refusals, schema rejections, and local validation rejections use distinct safe codes. Failed analysis never substitutes fabricated evaluated state.
