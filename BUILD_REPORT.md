# WhyN v1 — build report

Built locally on 2026-11-18, exactly to Claude's revised spec (v2).
Nothing has been pushed or published; there is no remote. The repo is
ready for the owner's review and for him to create the GitHub repo
when he chooses.

## What was built, by milestone

- **M0 Math.** `src/core/` (normal, budget, multiplicity, plan with the
  single public `computePlan(request) -> result`), the two-condition
  scenario module, the concept-keyed copy library, the reference script
  under `reference/`, and the acceptance tests. Commit `b37bea1`.
- **M1–M3 The page.** One static page (`index.html`, `styles.css`,
  `src/ui/`): both entry paths (check a number first-class, plan from
  scratch), the nine questions in plain words with the explanation
  library beside them, the four numbers each with its why-line, the
  error-budget bar with trade-off sliders and the keep-size/keep-rates
  toggle, the verdict curve with the three key points marked,
  guardrails, the paste-ready justification with copy button,
  shareable URL state (`?s=&v=&inputs`), and the three worked examples
  — the page opens on example 3, checking a number you were given.
  The three milestones were built and verified as a single page and
  land in one commit, `d0600df`.
- **M4 Ship (local).** README (formulas, references, how to check the
  numbers), MIT LICENSE, the CI workflow (tests + page check on every
  push; Pages deploy from `main` only when they pass — inert until a
  remote exists), and an accessibility pass: every input labelled,
  sliders keyboard-usable, results in an aria-live region, curves
  distinguished by dash pattern as well as colour, WCAG-AA-minded
  contrast in both colour schemes.

Not in v1, per spec: the assumption table (v1.1 S5), simulation check,
t correction, compromise mode, export — and no AI feature of any kind.

## Test results

- **Acceptance: 27 of 27 tests pass** (`node --test`, zero
  dependencies). All 17 rows of the spec's §11 table are reproduced
  within their stated tolerances, each as a named test:
  rows 1, 5, 6, 7, 17 in `tests/core.test.js`; rows 2, 3, 4, 8, 9, 10,
  11, 12, 13, 14, 15, 16 in `tests/two-condition.test.js`, which also
  reproduces the worked examples' numbers (§8: 1,027 per subgroup,
  MDE 4.99 at the planned size; §9: same total, MDE 9.97, 8,212.4 at a
  5-point Δ; §10 = row 16) and the guardrail triggers.
- **Numerics:** `invNorm`/`normCdf` checked against Python's
  `statistics.NormalDist` over a grid — worst error 1.1e-11, inside
  the spec's 1e-9 requirement.
- **Reference script:** `reference/two_condition.py` output is
  byte-identical to the governing `reference_numbers_output-2.txt`.
- **Page check** (`scripts/page_check.mjs`, boot run under jsdom):
  all checks pass — the page opens on example 3 with its exact numbers
  (2,054 required; MDE 8.01 points; 37.6%), examples 1 and 2 reproduce
  theirs, editing Δ recomputes, a missing Δ is reported plainly, and
  observed power is refused with its reason.
- **Page weight: 79.5 KB** total (HTML + CSS + JS), under the 200 KB
  limit.

## The "second scenario" criterion

Verified three ways. (1) `tests/architecture.test.js` fails if any
design vocabulary (paired, subgroup, cell, sigma, base rate, arms)
appears in `src/core/normal.js`, `budget.js` or `multiplicity.js`, or
design prose in `plan.js`, or any DOM/network/randomness call in the
core or the scenario. (2) The scenario contract is the only seam:
`plan.js` reaches design knowledge solely through the scenario's
exports (`questions`, `validate`, `seAt`, `nForSE`, `units`,
`describe`, `extraGuardrails`). (3) The registry in `plan.js` is one
line per scenario. A second scenario needs a new module, its reference
script and its test rows — no core edits.

## Deviations and judgement calls

All recorded in `DECISIONS.md`. The ones a reviewer should know:

1. **Base-rate convention (row 9).** §5 defines p₁ = p₀ + Δ; example
   1's pilot story speaks of a pooled 16%. The engine follows §5 and
   row 9 (which names both rates, 0.135 and 0.185) is reproduced by
   entering 0.135. No number or tolerance was adjusted.
2. **A `subgroups` input** carries the examples' two-equal-subgroups
   structure for paired designs; without it a paired design is one
   body of units (row 14). The spec's formulas imply it; the question
   list does not name it.
3. **Runs** apply to rates and independent means, not paired means
   (that SD already contains the spread).
4. **Budget sliders explore; they do not edit** the plan's answers.
5. **M1–M3 in one commit** (see above) instead of three.
6. **The owner's AI rule** (§2c of the hand-back) supersedes the
   spec's blanket ban as a *future* direction; v1 builds no AI
   feature either way. Recorded as DECISIONS #7.

No acceptance row failed at any point after the engine's subgroup
algebra was corrected during development (an early draft divided the
paired main effect's variance by the subgroup count twice; the tests
caught it, the algebra was fixed, no expected value was touched).

## What remains before it could be published

- The owner creates the GitHub repo (`whyn`) and pushes; CI then runs
  and Pages deploys from `main`.
- The owner's review of the page and of this report; Claude's
  monitoring checkpoints per the brief (after M0 math — this report
  covers it — and after the full build).
- The "done means" human test is still open: three people who are not
  statisticians saying, after five minutes, what they gave up to get
  80% power. That needs people, not code.
- Small honesty note: the page was verified by booting it in jsdom,
  not in a graphical browser; a visual once-over after the first
  deploy is worth five minutes.
