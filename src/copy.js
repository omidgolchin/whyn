// Every explanation the tool shows, keyed by concept. The wording is the
// product: one short text per idea, used beside the inputs and again in
// the justification. Edit wording here; the math never lives in this file.

export const COPY = {
  sesoi: {
    text: 'The smallest effect worth detecting (Δ) is the smallest difference that would matter to your theory or to a decision. Choose it from substance before you see any data: practical relevance, theory, or the size of effects in close studies. It drives the sample size more than anything else.',
    warn: "Taking Δ from a pilot's observed effect, or from a label like \"medium\".",
  },
  alpha: {
    text: 'α is how often you accept claiming an effect that is not there. 5% is the common default; a smaller α costs units.',
    warn: 'Treating α as the chance your hypothesis is wrong.',
  },
  power: {
    text: 'Power is the chance of finding the effect if it is exactly Δ. 80% is a convention: it accepts missing a real Δ-sized effect one time in five. 90% halves that risk and costs about a third more units.',
    warn: 'Powering for the effect you hope for rather than the smallest one that matters.',
  },
  budget: {
    text: 'For a fixed sample, α and power pull against each other: making false alarms rarer makes misses more common. Only more units, less noise or a larger Δ make both rarer.',
    warn: 'Saying you "maximize" α and β: you want both small.',
  },
  interval: {
    text: 'The interval level is 1 − α per hypothesis. The result is read from where the interval falls relative to 0 and Δ.',
    warn: 'Reading a 95% interval as a 95% chance the true effect is inside it.',
  },
  sides: {
    text: 'A two-sided interval guards against surprises in both directions. If you claim an effect only in the predicted direction, its false-alarm rate is half of (1 − level).',
    warn: 'Choosing one-sided after seeing which way the data point.',
  },
  multiplicity: {
    text: 'When m confirmatory hypotheses each get a verdict, splitting α across them (Bonferroni: α/m each) keeps the chance of any false claim at or below α. Exploratory and secondary results can stay unadjusted if labelled as such.',
    warn: 'Testing several primary outcomes at 5% each and reporting whichever wins.',
  },
  three_way: {
    text: 'With Δ set, a result has three readings: holds (interval excludes 0 in the predicted direction), does not hold (interval excludes effects of Δ or more), inconclusive (neither). An interval wholly on the wrong side of 0 is a reversal.',
    warn: 'Reading "not significant" as "no effect".',
  },
  inconclusive: {
    text: 'Inconclusive is an honest answer: the data cannot tell an effect of Δ from none. True effects between 0 and Δ often land here, because the study was sized to separate those two points.',
    warn: 'Sizing a study so small that inconclusive is the most likely outcome.',
  },
  mde: {
    text: 'The minimum detectable effect is the effect your sample would find with the chosen power. If the budget cannot reach Δ, keep Δ and report the MDE you can reach.',
    warn: 'Raising Δ until the sample fits the budget.',
  },
  base_rate: {
    text: 'For yes/no outcomes the noise per unit is p(1 − p), largest at 50%. If you do not know the base rate, assume 50%: the plan then holds whatever it turns out to be.',
    warn: 'Planning on an optimistic base rate that a pilot later contradicts.',
  },
  spread: {
    text: 'Effects usually differ from unit to unit. That spread (σ) adds noise that repeating the same unit cannot remove; only more units do.',
    warn: 'Running a few units many times and counting runs as if they were units.',
  },
  units_runs: {
    text: 'A unit is what the treatment is assigned to and what you generalize over (a person, a school, an exercise). Runs on the same unit are not independent evidence about other units.',
    warn: 'Reporting n as total runs when units drive the precision.',
  },
  interaction: {
    text: 'A difference between two effects has twice the standard error of one effect, so it needs four times the units for the same Δ.',
    warn: 'Planning a study for its main effect and then testing an interaction.',
  },
  pilot: {
    text: 'A pilot checks that the procedure works and that the outcome can vary. It is too small to estimate the effect, so its effect should not set Δ or n.',
    warn: 'Running a pilot, seeing a big effect, and shrinking the main study.',
  },
  floor_ceiling: {
    text: 'If almost nobody (or almost everybody) shows the outcome in both conditions, no sample size can reveal a difference. Check that the expected rate leaves room to move, for example between 10% and 90%.',
    warn: 'Sizing by formula for an outcome stuck at 0% or 100%.',
  },
  rounding: {
    text: 'Round up, and up again to fill balanced cells (equal units per subgroup or block).',
    warn: 'Rounding down "because it is close".',
  },
  check: {
    text: 'WhyN is a second, independent calculation: the same inputs always give the same answer. If its number differs from the one you were given, compare the inputs first: Δ, the base rate, the spread σ, how many claims share α, and whether runs were counted as units. A different answer usually means a different assumption.',
    warn: 'Treating a deterministic answer as automatically right: it is only as good as its inputs.',
  },
  given_number: {
    text: "Every sample size buys a smallest detectable effect. If your number's MDE is larger than Δ, your study can only find effects bigger than the ones you care about; if it is far smaller, you are paying for precision beyond Δ.",
    warn: 'Asking whether a number is "enough" without saying enough for which effect.',
  },
};

// Guardrail notes, triggered by inputs (spec section 7). They never block
// the calculation; they say what a choice costs.
export const GUARDRAILS = {
  deltaFromPilot: 'This Δ comes from a pilot or a convention. Set Δ on substance instead: a pilot’s effect is too noisy to size a study, and a label like "medium" says nothing about what would matter.',
  floorCeiling: 'Floor or ceiling risk: at a base rate this close to 0% or 100%, the outcome may have no room to move in either condition, and no sample size can reveal a difference.',
  interactionCost: 'This needs 4× the units of a main effect of the same size.',
  oneSided: 'A one-sided interval claims an effect only in the predicted direction. It is honest only if that direction was fixed before any data were seen.',
  lowPower: (missPct) => `At this power you accept missing a Δ-sized effect about ${missPct} times in 100.`,
  lowLevel: (falsePct) => `At this interval level you accept a false "holds" about ${falsePct} times in 100 claims in the predicted direction.`,
  fewUnits: 'Fewer than 30 units: the normal approximation is optimistic here. A t correction is planned for a later version.',
  runsFloor: 'Runs past this point are wasted: re-running the same units cannot average away the spread of the effect between units. Only more units help.',
  givenBelow: 'The size you entered is below what the formula needs. Beside it are the size the formula needs and what your number buys instead: its smallest detectable effect and the verdict chances at Δ. If the number cannot grow, report its MDE rather than raising Δ.',
  givenAbove: 'The size you entered is about twice the required size or more. The extra units buy precision beyond Δ — enough that a fourth verdict becomes possible: "an effect, but smaller than Δ".',
  sameSource: 'This check is only as independent as its inputs: the calculation is independent, but an assumption taken from the same advice as the number is not. Compare each input with the advice before trusting the agreement.',
  observedPower: 'WhyN does not compute power from observed data: observed power adds nothing beyond the p-value. What a finished study can honestly report is its interval and the smallest effect it could detect.',
};

// What the chosen power costs, stated wherever power is shown — in
// the results and in the justification alike (2026-11-18 ruling, as
// corrected by its addendum). The first figure is 1 − power; the
// split is the verdict chances at a true effect of exactly Δ, worked
// out by the caller from the plan's own numbers: the share that ends
// inconclusive and the share whose interval excludes effects of Δ or
// more. Whole percentages print without a decimal, as in the
// ruling's example ("20%", "17.5%", "2.5%").
function pct1(x) {
  const s = (100 * x).toFixed(1);
  return `${s.endsWith('.0') ? s.slice(0, -2) : s}%`;
}

export function powerCostLine(power, { inconclusive, doesNotHold }) {
  return `If the true effect is exactly Δ, ${pct1(1 - power)} of studies end without holds: ${pct1(inconclusive)} inconclusive, ${pct1(doesNotHold)} does not hold.`;
}
