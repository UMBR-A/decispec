# Decispec Demo Scripts

Use the production site at https://decispec.vercel.app. Record at 1440×900 with the browser zoom at 100%. Keep the cursor deliberate and do not expose browser developer tools, local paths, account menus, or environment configuration.

The deterministic demonstration is the primary path. It requires no API key and makes no OpenAI request.

## 60-second version

| Time | Visual action | Narration |
| --- | --- | --- |
| 0:00–0:07 | Show the landing page headline, then select **Instant demonstration**. | “AI can write a persuasive recommendation. Decispec tests whether the conclusion actually follows.” |
| 0:07–0:14 | Pause on **Select Vendor A**, the pending suite, and the source/memo layout. Select **Run decision tests**. | “This synthetic memo selects Vendor A. Decispec binds its claims to evidence and executes the decision graph.” |
| 0:14–0:23 | Wait for **Decision broken**. Point to the exact `$18 per device per month` evidence and the formula `321 × $18 × 3 years`. | “The quote is monthly, but the memo used three years without conversion. The arithmetic returns a number; the units fail.” |
| 0:23–0:31 | Select **Break this decision**. Pause when the four-node graph is centered. | “That failure propagates through Support cost, Vendor A total, and the recommendation.” |
| 0:31–0:42 | Point to **Price stability** as a declared assumption, then show the semantic correction preview. Select **Apply source-bound correction**. | “Assumptions stay visible. The correction changes no evidence; it replaces the incompatible duration with the quoted 36 months.” |
| 0:42–0:52 | Point to `$208,008`, `$268,677`, `$85,929`, and **Select Vendor B**. | “The engine recomputes Vendor A support to 208,008 dollars, Vendor A to 268,677, and Vendor B to 85,929. The deterministic selector changes the winner to Vendor B.” |
| 0:52–1:00 | Select **View report** and show **PROOF PASSED**, corrected state, source register, and JSON control. | “The report and proof export preserve the same evaluated graph. AI proposes structure; exact evidence and deterministic code control the result.” |

Fallback if verification or graph animation is delayed: “While the deterministic checks finish, notice that the interface distinguishes source-supported facts, calculated values, declared assumptions, and broken dependencies.” Continue as soon as **Decision broken** or the focused path appears.

## 2-minute version

| Time | Visual action | Narration |
| --- | --- | --- |
| 0:00–0:12 | Landing page. Frame the headline and two inputs: source evidence and AI-written recommendation. | “A recommendation can cite the right document and still misuse a billing period or depend on a broken total. Decispec turns that prose into tests.” |
| 0:12–0:22 | Select **Instant demonstration**. Pause on the imported Vendor A recommendation and the four source files. | “This credential-free demonstration uses synthetic school procurement evidence and an AI-style memo recommending Vendor A.” |
| 0:22–0:34 | Show the pending Decision Test Suite, claim inspector, and proof graph. Select **Run decision tests**. | “Decispec checks evidence bindings, numeric provenance, arithmetic, units, dependencies, policy constraints, and recommendation validity.” |
| 0:34–0:48 | On **Decision broken**, select or point to Vendor A support. Keep the exact quote and formula visible. | “The source says 18 dollars per device per month for 36 months. The memo multiplies by three years. That operation is dimensionally incompatible.” |
| 0:48–1:00 | Briefly open **Review declared assumptions** or select **Price stability**. | “Decispec also keeps the price-stability assumption explicit. It is reviewable, but it is never presented as source-supported.” |
| 1:00–1:13 | Select **Break this decision** and let the focused path finish. | “The broken support value is load-bearing. The proof graph isolates Quote A, Support cost, Vendor A total, and Recommendation while unrelated nodes fade away.” |
| 1:13–1:27 | Show the semantic correction preview and exact before/after values. | “The proposed correction rewrites no source. It replaces the incompatible three-year operand with the source-bound 36-month duration.” |
| 1:27–1:39 | Select **Apply source-bound correction**. Point to updated totals and the corrected recommendation. | “Dependencies rematerialize and the graph recomputes in topological order: support is 208,008 dollars, Vendor A is 268,677, and Vendor B remains 85,929.” |
| 1:39–1:49 | Point to **Select Vendor B** and “Vendor B is `$182,748` less.” | “A deterministic policy-aware selector—not the model—chooses Vendor B, 182,748 dollars lower and within budget.” |
| 1:49–2:00 | Select **View report**. Show the green **PROOF PASSED** stamp, corrected recommendation state, source register, and JSON/print controls. | “The final report and JSON export agree with the evaluated graph. Decispec does not guarantee truth; it proves whether the represented decision follows.” |

Fallback narration:

- If **Run decision tests** is still progressing: “The stages are real UI states, but every result comes from the already-bundled deterministic graph.”
- If the focused path is still animating: “The path animates in dependency order; the four nodes are the complete load-bearing chain.”
- If the report opens slowly: “The report is generated from the corrected evaluated graph, not from a separate summary.”

## 3-minute version

| Time | Visual action | Narration |
| --- | --- | --- |
| 0:00–0:16 | Landing page, headline, explanation, and proof preview. | “Teams increasingly receive AI-written procurement, finance, and policy recommendations. The prose can look rigorous even when the evidence-to-conclusion chain is not.” |
| 0:16–0:30 | Point to “Source evidence” and “AI-written recommendation,” then select **Instant demonstration**. | “Decispec takes those two inputs and compiles them into an executable decision specification. This demonstration is synthetic, deterministic, and needs no API credential.” |
| 0:30–0:46 | Initial workspace. Show the memo, evidence rail, claim inspector, pending graph, disabled report/export, and **Select Vendor A**. | “Before verification, every claim is honestly pending and report export is unavailable. The memo recommends Vendor A for 321 devices.” |
| 0:46–1:00 | Select **Run decision tests** and point through the suite categories as they update. | “The suite checks exact evidence, numeric provenance, arithmetic, unit compatibility, dependency integrity, policy constraints, and the recommendation.” |
| 1:00–1:18 | Show **Decision broken**. Select Vendor A support if needed. Frame the exact quotation and executable formula. | “The quote states 18 dollars per device per month, term 36 months. The memo used 321 times 18 times three years. The number 17,334 is arithmetically computable but dimensionally invalid.” |
| 1:18–1:30 | Select **Price stability** through **Review declared assumptions**. | “Price stability is a material assumption. Decispec marks it as assumed rather than quietly upgrading it to supported evidence.” |
| 1:30–1:46 | Select **Break this decision**. Let the graph center the four nodes. | “The engine propagates the failure. Quote A feeds Support cost; Support cost feeds Vendor A total; that total feeds the recommendation. Red communicates both state and dependency failure, not just a low score.” |
| 1:46–2:02 | Point to **Show full graph**, briefly restore it, then return to **Focus broken path** if useful. | “The reviewer can restore the complete DAG, but the focused view makes the load-bearing chain impossible to miss.” |
| 2:02–2:18 | Show the semantic correction preview. Keep `$17,334 → $208,008`, `$78,003 → $268,677`, and `Vendor A → Vendor B` visible. | “This is a semantic correction, not an edited answer. The evidence remains unchanged; only the operation moves from three years to the source-bound 36 months.” |
| 2:18–2:32 | Select **Apply source-bound correction**. Point to the corrected table and graph. | “The correction atomically rematerializes its calculation input and reevaluates downstream nodes in topological order.” |
| 2:32–2:44 | Show the final banner and totals. | “Vendor A support becomes 208,008 dollars, Vendor A totals 268,677, Vendor B totals 85,929, and Vendor B has a 182,748-dollar advantage.” |
| 2:44–2:54 | Point to **Select Vendor B**, then briefly show **Replay propagation** and **Undo correction** without activating them. | “The winner is produced by executable totals and the budget rule. Replay and undo keep the correction reviewable.” |
| 2:54–3:00 | Select **View report** and land on the green **PROOF PASSED** stamp. | “The report and proof JSON preserve the same evaluated state. AI can propose the map; Decispec runs the proof.” |

Fallback narration:

- During any delayed transition: “Nothing is being fetched from a live model in this demo; the UI is presenting a fixed deterministic evaluation.”
- If an evidence panel is below the fold: “The same exact passage appears in the corrected report’s source register.”
- If the report opens in another tab: move to that tab and continue; do not repeat the click.

## Recording checklist

- Use the public production URL, not localhost.
- Record one continuous take when possible.
- Keep the final video at or below the event’s time limit.
- Do not open live analysis, developer tools, environment settings, Vercel, or local files.
- Do not claim that the public site has live OpenAI analysis configured.
- Do not say “guarantees correctness.” Prefer “tests whether the represented conclusion follows.”
