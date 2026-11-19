# WhyN

**How many units do you need, and why that many?**

WhyN is a one-page tool that answers two questions about a planned
comparison: how many units do I need, and why that many. It returns the
required sample size, the smallest effect the study can detect, the
interval level, and the chance of each verdict — each with its reason
in one line — and writes a justification a reviewer can check.

It is built for researchers who were given their study's numbers, often
by an AI assistant. WhyN is the check they can set beside that advice:

- **Deterministic:** one formula; the same inputs always give the same
  answer, with nothing that can drift between visits.
- **Independent:** it owes nothing to whoever produced the number. Its
  reasoning can be inspected — math a reviewer can read in ten minutes,
  and a reference script that pins every number.
- **Short enough to read:** one equation and one line per number,
  before the money is spent, while changing the number is still free.

There is no server, no account, and nothing to install. Your inputs
live in the page's URL and nowhere else.

## The one equation

Every number comes from a single relation:

```
Δ / SE(n)  =  z_a + z_b  =  K
```

The left side is the **budget**: how many standard errors the smallest
effect worth detecting (Δ) spans. It grows with the square root of the
sample size and shrinks as the data get noisier. The right side is how
the budget is **spent**: z_a buys protection against false alarms
(claiming an effect that is not there), z_b against misses (failing to
find an effect that is there). Power is 1 − β.

With n fixed, the budget is fixed, so spending more on one protection
leaves less for the other. There are only three ways to buy more
budget: more units, less noise per unit, or a larger Δ.

## What it covers

One scenario — the **two-condition comparison** — in four designs:

| | Rate (yes/no) | Mean |
| --- | --- | --- |
| **Independent groups** | V = p₀(1−p₀) + p₁(1−p₁) | V = 2·SD² |
| **Paired** | V = p₀(1−p₀) + p₁(1−p₁) + σ² | V = SD² of the within-unit difference |

The claim is a main effect or an interaction (the difference of the
effect between two equal subgroups). An interaction has twice the
standard error of a main effect, so it needs four times the units for
the same Δ. Critical values share the family error rate across m
confirmatory claims by Bonferroni (α/m each). Sample sizes are always
rounded up, with the unrounded value shown.

Results are read three ways, not two: **holds** (the interval excludes
0 in the predicted direction), **does not hold** (the interval excludes
effects of Δ or more), or **inconclusive** (neither). When a size is
large enough that the interval is narrower than Δ, a fourth reading
appears — *an effect, but smaller than Δ* — and the engine's chances
still sum to 1.

If each unit is run more than once, the outcome part of the variance
shrinks with the runs but the spread of the effect across units (σ)
does not: below a floor of units, no number of runs reaches the
target. WhyN shows that floor whenever it applies.

## Two ways in

- **Check a number** (the primary path): enter the sample size you
  were given or can afford, then the design. WhyN shows what that
  number buys — its smallest detectable effect and its verdict
  chances — beside what the formula needs instead.
- **Plan from scratch**: enter the design and get the required size.

The page opens on a worked example of the first path: an AI assistant
recommended 400 exercises per group, and at the team's own settings
that number reliably detects only gains of 8 points.

## Run it

Open `index.html` in a browser, or serve the folder statically:

```
python3 -m http.server
```

No build step, no runtime dependencies.

## Check the numbers

The acceptance tests are the contract: every row of the spec's table
(the worked examples plus the generic designs) must be reproduced.

```
node --test                    # the acceptance tests, zero dependencies
python3 reference/two_condition.py   # prints every pinned number
node scripts/page_check.mjs    # boots the page and checks it (uses jsdom if installed)
```

The reference script uses only Python's standard library. If a number
on the page ever disagrees with it, the script is right and the page
has a bug.

## Layout

```
index.html                  the page
styles.css
src/core/normal.js          the normal distribution (accurate to 1e-9)
src/core/budget.js          K, power, MDE, verdict chances
src/core/multiplicity.js    alpha per claim (v1: Bonferroni)
src/core/plan.js            computePlan(request) -> result, the one public entry
src/scenarios/              one module per design family
  two-condition.js          v1's scenario: questions, variance model, seAt, nForSE
src/copy.js                 every explanation, keyed by concept
src/ui/                     questions, results, URL state, SVG charts, examples
tests/                      acceptance + architecture tests
reference/two_condition.py  the reference script for the scenario
```

The core never mentions a design: it sees only a standard-error
function and an α per claim. A new scenario is a new module, its own
reference script, and its own acceptance rows — no core edits. Growth
rules, and the choices made where the spec was silent, are recorded in
`DECISIONS.md`.

## Not in v1

Simulation check, a t correction for small samples, compromise mode,
export, and the assumption table are planned for v1.1. Observed
(post-hoc) power will not be added: computed from the observed effect
it adds nothing beyond the p-value. ANOVA, regression, survival,
cluster-randomized, sequential and Bayesian designs are out of scope —
for those, use the tools below. WhyN contains no AI or language-model
feature: every calculation is deterministic, and that independence is
the product.

## References

- Faul, Erdfelder, Lang & Buchner (2007). G*Power 3. *Behavior
  Research Methods* 39(2), 175–191.
- Lakens (2022). Sample Size Justification. *Collabra: Psychology*
  8(1).
- Lakens, Scheel & Isager (2018). Equivalence Testing for
  Psychological Research: A Tutorial. *Advances in Methods and
  Practices in Psychological Science*.
- Isager & Fitzgerald (2024). Three-Sided Testing to Establish
  Practical Significance: A Tutorial. Tinbergen Institute Discussion
  Paper TI 2024-077/III.

## License

MIT — see `LICENSE`.
