# Decispec Demo Script

Target runtime: about 2 minutes 25 seconds.

## 0:00–0:20 — The wrong answer

“This memo recommends Vendor A for a three-year school-device purchase. It looks careful: it cites enrollment, applies the seven-percent spare policy, compares both vendors, and stays under budget. But a polished recommendation is not a proof.”

Open **Instant demonstration**. Point to **Select Vendor A** and the pending Decision Test Suite.

## 0:20–0:45 — Run the tests

Select **Verify decision**.

“Decispec binds every material claim to exact evidence, reruns structured calculations, checks units and policies, and tests whether the recommendation depends only on valid results.”

When verification completes, pause on the dominant label: **Decision broken**.

## 0:45–1:15 — Reveal the load-bearing failure

Open the Vendor A support claim and show the highlighted quotation: **$18 per device per month**, term 36 months.

“The memo multiplied that monthly rate by three years as though the rate were annual. The arithmetic produces a number, but the units do not produce a valid three-year support cost.”

Select **Break this decision**. Let the focused graph animate:

`Quote A → Support cost → Vendor A total → Recommendation`

“The error is load-bearing. It does not stay buried in a footnote; it breaks the final Vendor A recommendation.”

## 1:15–1:55 — Correct and recompute

Show the before/after diff, then select **Apply correction**.

“The evidence does not change. The operation changes from three annual periods to the quoted 36 monthly periods.”

Point out the recomputed values: Vendor A support $208,008; Vendor A total $268,677; Vendor B total $85,929.

“The deterministic selector now recommends Vendor B. GPT did not choose that winner; executable upstream values and the budget policy did.”

## 1:55–2:25 — The artifact and thesis

Open **View report**. Show the green **Proof passed** stamp, corrected recommendation state, exact source register, and JSON export.

“AI writes the recommendation. Decispec runs the tests—from exact evidence, through deterministic calculations and dependencies, to the decision.”
