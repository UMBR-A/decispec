# Submission Checklist

## Blocking user decisions

- [ ] Approve deployment and hosting target; nothing is deployed yet.
- [x] Use `Decispec` as the visible product name. `ASSERT` remains only as the development codename in historical/internal references.
- [ ] Confirm public repository status and approve any commit/push/PR.
- [ ] Confirm eligibility and any required parent-or-guardian registration.
- [ ] Provide the required feedback session ID.

## Public artifact

- [ ] Record a public video with audio under three minutes using the production live-analysis workflow.
- [ ] Verify no desktop chrome, development overlay, Codex overlay, secret, or private document appears.
- [ ] Capture clean desktop and mobile screenshots from the current production workflow.
- [ ] Verify the final public URL on desktop and mobile.
- [ ] Check the competition deadline and timezone immediately before submission.

## Production configuration

- [ ] Add `OPENAI_API_KEY` to the hosting provider's server-only secret store; never bundle `.env.local`.
- [ ] Confirm model/project access and a bounded production spend policy.
- [ ] Confirm `store:false`, no tools, zero automatic retries, request timeout, input limits, and safe errors in the deployed environment.
- [x] Freeze the validated engine and native provider contract; no additional acceptance request is required before packaging.

## Final verification

- [ ] `npm ci`
- [ ] `npm run verify`
- [ ] `npm run test:e2e`
- [ ] Re-run secret/key-pattern audit and production dependency audit.
- [ ] Verify upload, analysis, focused/full graph, correction/undo, report, JSON export, keyboard focus, reduced motion, and 1440×900 / 390×844 layouts.
