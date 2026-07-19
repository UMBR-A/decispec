# Decispec Video Shot List

Target runtime: **2:10–2:25**. Hard maximum: **2:45** to leave margin under a three-minute submission limit. Record the production deterministic demonstration at 1440×900 and 100% browser zoom.

| Shot | Timestamp | Max duration | Page state | Cursor action | Narration | Framing | Transition |
| ---: | --- | ---: | --- | --- | --- | --- | --- |
| 1 | 0:00–0:10 | 10s | Landing page | Hold cursor away from headline | “AI can write a persuasive recommendation. Decispec tests whether the conclusion follows.” | Full first viewport; headline and proof preview balanced | Straight cut from title slate or begin directly |
| 2 | 0:10–0:20 | 10s | Landing inputs and actions | Point once to Source evidence, AI-written recommendation, then **Instant demonstration** | “It compiles the recommendation and its evidence into an executable decision specification.” | No digital zoom; keep both actions visible | Click through normally |
| 3 | 0:20–0:34 | 14s | Initial workspace | Point to **Select Vendor A**, pending suite, evidence rail, and memo | “This synthetic school memo recommends Vendor A. Before verification, every claim is honestly pending.” | Full workspace; slow cursor movement | No transition effect |
| 4 | 0:34–0:46 | 12s | Verification starts | Select **Run decision tests**; point across suite categories | “Decispec checks source bindings, numeric provenance, calculations, units, dependencies, policies, and the recommendation.” | Keep suite and banner visible | Let UI transition carry the shot |
| 5 | 0:46–1:00 | 14s | Broken state | Pause on **Decision broken**, then select Vendor A support if necessary | “The quote is 18 dollars per device per month for 36 months, but the memo multiplies by three years.” | Crop only enough to keep quote and formula readable | Gentle cut after selection if needed |
| 6 | 1:00–1:10 | 10s | Claim inspector | Point to formula and unit failure; briefly point to **Price stability** assumption | “The arithmetic produces a number, but the units fail. Price stability remains a declared assumption, not supported evidence.” | Evidence, formula, and status should share frame | Straight cut |
| 7 | 1:10–1:24 | 14s | Focused graph | Select **Break this decision**; stop moving while the path animates | “The error is load-bearing. It breaks Support cost, Vendor A total, and the recommendation.” | Center exactly four nodes; unrelated graph content hidden | Use product animation only |
| 8 | 1:24–1:34 | 10s | Focused graph complete | Point once from Quote A through Recommendation; indicate **Show full graph** without clicking | “The focused DAG shows the complete failure path without hiding the option to inspect the full graph.” | Keep **Decision broken** label and control visible | Straight cut |
| 9 | 1:34–1:48 | 14s | Semantic correction preview | Scroll only enough to center the three before/after rows | “The correction rewrites no evidence. It replaces the incompatible duration with the quote’s source-bound 36 months.” | Values and 3-years/36-months explanation readable | No flourish |
| 10 | 1:48–1:59 | 11s | Apply correction | Select **Apply source-bound correction**; wait for corrected banner | “Decispec rematerializes dependencies and recomputes downstream nodes in topological order.” | Keep action and resulting banner in frame | Product transition only |
| 11 | 1:59–2:10 | 11s | Corrected workspace | Point to `$208,008`, `$268,677`, `$85,929`, and **Select Vendor B** | “Vendor A becomes 268,677 dollars; Vendor B remains 85,929; the deterministic selector chooses Vendor B, 182,748 dollars lower.” | Do not zoom so tightly that labels disappear | Straight cut |
| 12 | 2:10–2:21 | 11s | Corrected report | Select **View report**; switch to the opened tab if needed | “The report and JSON export use the same evaluated graph.” | Green **PROOF PASSED**, corrected state, and totals visible | Browser tab change only |
| 13 | 2:21–2:30 | 9s | Report source register/final frame | Point to exact source register, then rest cursor | “AI may propose the structure. Exact evidence and deterministic code control the result.” | End on Decispec report identity, proof stamp, or source register | Clean fade to black after narration |

## Cursor and crop guidance

- Use one purposeful cursor movement per idea; do not circle controls.
- Do not use cinematic pans, fake depth, animated text overlays, or repeated zooms.
- A single static crop for evidence/formula readability is acceptable. Return to the full product layout before the graph and report.
- Keep the four focused graph nodes entirely inside frame.
- Never crop away the labels that give a number meaning.
- If **View report** opens a second tab, switch to it once; do not click repeatedly.

## Delay fallbacks

- Verification delay: “Every stage shown here is deterministic; no live model is being called.”
- Graph-animation delay: “The path is animating in dependency order from the quoted rate to the recommendation.”
- Report delay: “The report is generated from the corrected evaluated graph, not from a separate model summary.”
- Unexpected scroll position: use a straight cut to the correct state rather than recording frantic scrolling.

## Audio and export

- Record clean narration separately if room noise is noticeable.
- Keep music absent or very low; spoken explanation and UI evidence are primary.
- Export at the recording resolution, 30 fps, H.264, with readable text and no added sharpening halos.
- Watch the exported file once at normal speed and once muted to confirm the visual story remains understandable.
