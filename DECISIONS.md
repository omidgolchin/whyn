# Decisions taken where the spec was silent or ambiguous

The spec (v2) is the contract. Where it left a choice open, the simpler
option was taken and is recorded here.

1. **Base rate convention (acceptance row 9).** Section 5 defines
   p1 = p0 + Δ, so the entered base rate is the rate under the first
   condition. Worked example 1's pilot story speaks of a pooled 16%
   (13.5% with one style, 18.5% with the other), and row 9 names the
   two rates outright. The engine follows section 5; row 9 is
   reproduced by entering 0.135. A user whose pilot measured a pooled
   rate enters the first condition's rate (pooled minus Δ/2).
   **The "pooled minus Δ/2" advice is retired (2026-11-18, see #8):**
   the question now asks for the rate under the first condition — the
   one you know now — and example 1's story gives that rate (13.5%)
   rather than the pooled 16%. Row 9 stands as the engine always
   computed it.

2. **"Units per group" in the examples.** In the worked examples the
   paired units are split into two equal subgroups, so the engine
   carries a `subgroups` input for paired designs. With it, the main
   effect averages the two subgroup means (variance V over the total),
   and "per group" figures are totals divided by two. Without it, a
   paired design is one body of units, as in row 14.

3. **Runs for paired means.** The SD of a within-unit difference
   already contains everything a repeat run could shrink, so the runs
   lever (and the units floor) applies to rates and to independent
   means, not to paired means.

4. **Budget-bar sliders explore; they do not edit.** The sliders in
   the error-budget view show the α–power trade-off at the current
   size, or the size the shown rates would need. The plan's own
   answers stay in the questions; nothing is written back silently.

5. **Inverse normal.** Acklam's approximation plus two Halley steps
   against an exact-series/continued-fraction Φ. Checked against
   Python's statistics.NormalDist: worst error 1.1e-11 over the range
   the tool uses, inside the spec's 1e-9 requirement.

6. **The check path's size is a total.** Question 9 asks for total
   units (the form a given number usually takes: "800 in all"). The
   results also state it per group/cell/subgroup.
   **Reversed (2026-11-18, see #8):** the check path now asks "What
   size were you given?" with a required choice — per group or in
   total — and computes nothing until the choice is made. The engine's
   `givenUnits` is still always a total; the scenario's validate()
   translates the entered size into it. A size named directly as
   `givenUnits` (the worked examples; links shared before the ruling)
   keeps this decision's meaning: a total.

7. **The AI rule (owner, 2026-11-18).** v1 contains no AI or
   language-model feature of any kind. The core — every calculation,
   explanation and verdict — is deterministic permanently. The spec's
   blanket "no AI, now or later" is broader than the owner's position:
   a future, input-side access layer (a visitor describes their
   experiment in plain words; an AI selects the scenario and pre-fills
   the settings, all visible and editable, on the visitor's own key)
   is an allowed direction. It is not built here, and it may never
   touch a number.

8. **The question-set ruling (2026-11-18).** Ruled by Claude at the
   owner's request; applied on the owner's proceed the same day. A
   question may arrive pre-filled only if a published convention
   exists for it, and only if the results show the value as an
   assumption (the decision log's #6). Changes, all in the scenario's
   questions and the results copy — no core file changed, the math
   and the 17 acceptance rows untouched:
   - Seven questions are asked with nothing filled in: the given size
     with its per-group-or-in-total choice (reversing #6); outcome;
     assignment; Δ (check-path hint: "If you were told an improvement,
     it goes here."); spread — for rates, the rate under the first
     condition, with an explicit "I don't know: use 50%, the safest"
     instead of a blank becoming 50% (retiring #1's pooled advice);
     the confirmatory count, with a follow-up when it exceeds one —
     "one is enough" sizes with Bonferroni as before, "all must hold"
     shows a plain not-yet-sized message and no n; and, on the check
     path, "Did this Δ come from the same advice as the size you're
     checking?" (yes / no / not sure), replacing "Where does that
     effect come from?" — yes or not sure fires the independence
     guardrail.
   - Error rate (5%, two-sided) and power (80%) keep their defaults;
     runs (1) and subgroups (none) stay pre-filled. All of them, and
     every "I don't know", appear in an assumption line under the four
     numbers. The results also echo the size as entered ("You entered
     300 per group (600 in total)."), state power's cost wherever
     power is shown ("1 study in 5 ends without holds, almost always
     as inconclusive", at 80%), and, when a given size falls short,
     tell the reader to ask whoever gave them the number which Δ,
     base rate or SD, error rate and power they assumed.
   - Six acceptance rows Q1–Q6 were added as named tests; Q2's numbers
     were pinned against the reference script before the test was
     written (per group: MDE 11.4374 points, holds 0.16350; in total:
     16.17496, 0.10255 — the ruling's 11.44 / 16.4% and 16.17 / 10.3%
     within the rows' usual tolerances). A guardrail test holds every
     reason text to the decision log's #2: at most three sentences
     and about 60 words.
   - The scenario version is now 2. Links shared before the ruling
     keep working with their original meaning: a `givenUnits` in an
     old link is still read as a total (see #6), and values the old
     defaults used to supply silently (outcome, assignment) are now
     asked, so an old link that relied on them opens with the
     questions unanswered rather than computing on a silent default.

9. **The addendum to the question-set ruling (2026-11-18).** Ruled
   by Claude; applied on the owner's proceed the same day. It
   answers the two interpretation points the build had flagged,
   finds both were handled correctly under the ruling as written,
   and changes the ruling on both — plus one correction to the
   ruling's own wording:
   - The claim question is asked only when the design has two
     subgroups, and then with no default: with subgroups set and no
     claim chosen, nothing computes. With no subgroups a main effect
     is the only possible claim, so an unanswered claim takes it and
     the assumption line says "claim: main effect". This supersedes
     the build's reading under #8, which kept the claim's 'main'
     default because the ruling's table never mentioned it (pinned
     in Q3; Q3 now pins the opposite, and Q7 pins the gating). A
     claim named directly in the inputs — the worked examples, the
     acceptance rows — is still taken as given.
   - The no-core fence of #8 is lifted for one change: the
     justification template in src/core/plan.js states the cost of
     power. Nothing else in the core changed — the math, the 17
     rows and the architecture test are untouched — and the line
     uses no design vocabulary.
   - The cost line itself is corrected. "Almost always as
     inconclusive" holds at 80% power but not at 90%, so the line
     is computed from the plan instead: "If the true effect is
     exactly Δ, 20% of studies end without holds: 17.5%
     inconclusive, 2.5% does not hold." The first figure is
     1 − power; the split is the verdict chances at Δ at the size
     the formula asks for. The line appears in the results and the
     justification alike.
   - Rows Q7–Q9 were added as named tests. Q9's figures were
     pinned against the reference script before the test was
     written (outcome_probs at the target SE: holds 0.900000,
     doesNotHold 0.025000, inconclusive 0.075000 at 90% power, one
     claim, 5% two-sided — the addendum's 10% / 7.5% / 2.5%
     exactly).
   - The scenario version is now 3. A link shared before this
     change that sets subgroups and relied on the claim's old
     default now opens with the claim unanswered rather than
     computing on a silent "main" — the addendum's intent, as with
     the defaults the ruling itself retired in #8.

10. **Addendum 2 to the ruling (2026-11-18).** Ruled by Claude
    after cloning the shipped repo (`ca260ca`), running all 38
    tests and the page check, and probing the landing page;
    applied on the owner's proceed the same day. Four fixes, all
    in the questions, the copy and the rendering — the math, the
    17 rows and Q1–Q9's figures untouched:
    - The cost-of-power line sits once in the results, under
      number 1 (the required size), and opens "At the required
      size, if the true effect is exactly Δ…". The justification
      uses the same opening — the line is shared copy, so one
      wording serves both. Before, it was computed at the required
      size but printed under the entered size and again under the
      assumption line, where on the landing page it read 20%
      beside a table showing 62.4% at the entered 800; the ruling
      had said "wherever power is shown" without saying which
      size. Q5, Q8 and Q9 pin the new opening; their numbers are
      unchanged.
    - Example 3 enters its size as its story tells it — givenSize
      400, per-group basis, Δ-source "no" — instead of a hidden
      givenUnits: 800 behind a blank question. 400 across two
      subgroups is the same 800 in total, so its numbers (MDE
      8.01 points, holds 37.6% at Δ) do not move; the question
      renders answered and the size echo appears. One word for
      the parts everywhere: the basis option, the echo and the
      story say "per subgroup" when the design has subgroups and
      "per group" when it does not. (Q11's "per group chosen"
      names the basis choice; the landing design has subgroups,
      so its option reads "per subgroup".)
    - An unanswered Δ-source question counts as "not sure" when
      a size is being checked: validate() no longer lets the
      blank fall through to "substance", the independence
      guardrail fires, and the assumption line names it ("Δ
      source: not stated, treated as not sure"). A deltaSource
      named directly in the inputs still stands, as before, and
      with no size to check the question was never in play. On
      the page, a hand path switch drops an example's
      engine-level deltaSource, so it cannot answer the question
      silently either.
    - The paired-means SD question's label says what the engine
      already means — "the SD of each unit's difference between
      conditions" — and number 3's false-holds figure is the
      verdict table's own holds chance at a true effect of 0,
      formatted by the same function, so the two agree (1.2%,
      not 1.3%, for the same 1.25%).
    - Rows Q10–Q12 were added as named tests. The scenario
      version is now 4: a check link shared before this change
      that names a size but no Δ-source now fires the guardrail
      and names the assumption, where before the blank silently
      counted as "no".
    The reversal column and the choice of landing example still
    wait for the owner's own ruling and are untouched.

11. **Addendum 3 to the ruling (2026-11-18).** The owner's own
    rulings — decision log #7 (the verdict table) and #8 (the
    landing example) — relayed by Claude after he re-checked the
    shipped build (`fa63282`: 41 of 41 tests, the page check, the
    landing page) and confirmed this build's reading of Q11 in
    #10. Applied on the owner's proceed the same day.
    - The verdict categories the page displays are mutually
      exclusive, and every displayed row adds up to 100%. The
      core's chances overlap by design: an interval that lands
      strictly between 0 and Δ counts in both "holds" and "does
      not hold", and a reversal counts inside "does not hold"
      while also standing as its own column — the landing table's
      top row added up to 101.2%. The partition is made where the
      chances are displayed, not in the core: `exclusiveVerdicts`
      in src/copy.js carves the fourth verdict out of both cells,
      and the reversal shows inside "does not hold" as a sub-line
      ("37.6% (incl. 1.2% reversal)"). The note under the table
      that explained the reversal is gone. The results table and
      the verdict curve — whose marked points are the table's
      chances at 0, Δ/2 and Δ — both use the partition. No core
      file changed and no probability changed; only the cell a
      chance is displayed in. Power keeps its standard meaning,
      an interval that excludes 0; when the fourth column shows,
      one line under the table says that "holds" and "smaller
      than Δ" together make up the power. The justification keeps
      the core's three chances at the required size, where the
      fourth verdict cannot occur at power below about 97.5%.
    - The page opens on the plainest check (decision log #8). A
      new fictional example stands first in the bar: a team asked
      an AI assistant how many students to enroll to detect a
      4-point rise in a course's pass rate, and was told 300 per
      group. Its inputs are Q2's case — check path, independent
      groups, a rate, Δ = 4 points, the base rate not known, one
      claim, Δ source "no" — so its numbers are Q2's pins plus
      the required size: MDE 11.44 points and holds 16.4% at Δ,
      and 4,906 students in all (2,453 per group). The required
      size was pinned against the reference script before Q14
      was written (per group 0.5 · K² / 0.04² = 2452.7749 at
      K = 2.801585). Example 3 stays, as a later button, and
      examples 1–3 keep their numbers (Q15); the README's
      opening-example paragraph names the new example. The new
      example's why-lines follow the reasons rule (decision log
      #2: at most three sentences, about 60 words), and the
      guardrail test now holds every example's why-lines to it,
      not only the texts in src/copy.js.
    - Rows Q13–Q15 were added as named tests. The scenario
      version is now 5: no input changed its meaning, but a link
      shared before this change displays its verdict table
      partitioned differently — at sizes where the fourth verdict
      can occur, the "holds" it shows no longer includes the
      fourth verdict's share.
