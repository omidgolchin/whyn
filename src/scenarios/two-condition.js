import { GUARDRAILS } from '../copy.js';

// The two-condition comparison: one scenario, four designs.
//
// A unit is measured under one condition (independent groups) or under
// both (paired). The claim is a main effect (A vs B) or an interaction
// (the A-vs-B effect in one subgroup minus the same effect in another,
// the two subgroups equal in size). Outcomes are rates (yes/no, effects
// in the rate's own units) or means (effects in the outcome's units,
// noise given by a standard deviation).
//
// The scenario owns its variance model. The core owns the equation
// delta / SE = z_a + z_b; this module only turns sizes into standard
// errors and back.
//
// Units and runs: `units` is always the TOTAL number of units. If each
// unit is run r times per condition, the outcome part of the variance
// shrinks by r; the spread of the true effect across units (sigma) does
// not shrink, because re-running the same unit says nothing new about
// other units.
//
// The question set follows the 2026-11-18 ruling (DECISIONS #8) and
// its addendum (#9): a question arrives pre-filled only where a
// published convention exists (error rate, power, runs, subgroups),
// and the results name those values as assumptions. Everything else
// is asked with nothing filled in. The claim is asked only when the
// design has two subgroups, and then with no default; with no
// subgroups an unanswered claim takes the main effect, the only
// claim such a design can make, and the assumption line names it. The engine's `givenUnits` is always a total; the check path asks
// the size as `givenSize` plus a required per-group-or-in-total choice
// (`givenBasis`) and validate() translates. `givenUnits` stays a
// question-shaped input (never rendered) so links shared before the
// ruling keep the meaning they were created with.

export const id = 'two-condition';
export const version = 3;

export const questions = [
  { key: 'givenSize', label: 'What size were you given?', kind: 'number',
    default: null, copyKey: 'given_number', paths: ['check'] },
  { key: 'givenBasis', label: 'Is that size per group, or in total?', kind: 'choice',
    options: [
      { value: 'per-group', label: 'per group' },
      { value: 'total', label: 'in total' },
    ],
    default: null, copyKey: null, paths: ['check'] },
  { key: 'givenUnits', label: 'The sample size you were given or can afford (total units)', kind: 'number',
    default: null, copyKey: 'given_number', hidden: true },
  { key: 'outcome', label: 'Is the outcome a yes/no rate, or a measurement?', kind: 'choice',
    options: [
      { value: 'rate', label: 'a yes/no rate (effects in percentage points)' },
      { value: 'mean', label: 'a measurement (needs a standard deviation)' },
    ],
    default: null, copyKey: null },
  { key: 'assignment', label: 'Does each unit get one condition, or both?', kind: 'choice',
    options: [
      { value: 'paired', label: 'both conditions (paired)' },
      { value: 'independent', label: 'one condition (independent groups)' },
    ],
    default: null, copyKey: 'units_runs' },
  { key: 'claim', label: 'What is the claim?', kind: 'choice',
    options: [
      { value: 'main', label: 'a main effect (A vs B)' },
      { value: 'interaction', label: 'a difference in that effect between two equal subgroups (interaction)' },
    ],
    default: null, copyKey: 'interaction',
    appliesWhen: (inputs) => inputs.assignment === 'paired' && inputs.subgroups === 'yes' },
  { key: 'delta', label: 'Smallest effect worth detecting', kind: 'number',
    default: null, copyKey: 'sesoi', hintCheck: 'If you were told an improvement, it goes here.' },
  { key: 'deltaSameAdvice', label: "Did this Δ come from the same advice as the size you're checking?", kind: 'choice',
    options: [
      { value: 'yes', label: 'yes' },
      { value: 'no', label: 'no' },
      { value: 'unsure', label: 'not sure' },
    ],
    default: null, copyKey: null, paths: ['check'] },
  { key: 'baseRateChoice', label: 'The rate under the first condition — the one you know now', kind: 'choice',
    options: [
      { value: 'known', label: 'I know it' },
      { value: 'unknown', label: "I don't know: use 50%, the safest" },
    ],
    default: null, copyKey: 'base_rate', appliesTo: { outcome: 'rate' } },
  { key: 'baseRate', label: 'Rate under the first condition', kind: 'number',
    default: null, copyKey: 'base_rate', appliesTo: { outcome: 'rate', baseRateChoice: 'known' } },
  { key: 'sd', label: 'Standard deviation of the outcome', kind: 'number',
    default: null, copyKey: null, appliesTo: { outcome: 'mean' } },
  { key: 'sigma', label: 'How much does the effect vary between units? (spread of the effect)', kind: 'number',
    default: null, copyKey: 'spread', appliesTo: { outcome: 'rate', assignment: 'paired' } },
  { key: 'claims', label: 'How many results will you report as confirmatory?', kind: 'number',
    default: null, copyKey: 'multiplicity' },
  { key: 'claimsRule', label: 'Must all of them hold, or is one enough?', kind: 'choice',
    options: [
      { value: 'one', label: 'one is enough' },
      { value: 'all', label: 'all must hold' },
    ],
    default: null, copyKey: 'multiplicity', appliesWhen: (inputs) => (inputs.claims ?? 0) > 1 },
  { key: 'alpha', label: 'Family error rate', kind: 'number',
    default: 0.05, copyKey: 'alpha' },
  { key: 'sides', label: 'Interval sides', kind: 'choice',
    options: [
      { value: 'two', label: 'two-sided' },
      { value: 'one', label: 'one-sided' },
    ],
    default: 'two', copyKey: 'sides' },
  { key: 'power', label: 'Power', kind: 'number',
    default: 0.8, copyKey: 'power' },
  { key: 'runsPerUnit', label: 'Runs per unit, per condition (if more than one)', kind: 'number',
    default: 1, copyKey: 'units_runs' },
  { key: 'subgroups', label: 'The units are split into two equal subgroups (needed for an interaction on paired units)', kind: 'choice',
    options: [
      { value: 'no', label: 'no' },
      { value: 'yes', label: 'yes' },
    ],
    default: 'no', copyKey: 'interaction', appliesTo: { assignment: 'paired' } },
];

export const copyKeys = [
  'sesoi', 'alpha', 'power', 'budget', 'interval', 'sides', 'multiplicity',
  'three_way', 'inconclusive', 'mde', 'base_rate', 'spread', 'units_runs',
  'interaction', 'pilot', 'floor_ceiling', 'rounding', 'check', 'given_number',
];

export function defaults() {
  const out = {};
  for (const q of questions) out[q.key] = q.default;
  return out;
}

// Fill defaults, then check the inputs make sense. Returns a list of
// problems (empty when the inputs are usable); never throws on user data.
export function validate(raw) {
  const inputs = { ...defaults(), ...raw };
  const problems = [];

  // The check path's Δ-source question ("did this Δ come from the same
  // advice as the size?") replaces the old "where does that effect come
  // from?". Yes or not sure means an assumption came from the same
  // advice as the number, which is what the core's independence
  // guardrail reads (as deltaSource: 'advice'). Inputs that name a
  // deltaSource directly (the worked examples, the guardrail tests)
  // keep it untouched.
  if (inputs.deltaSource == null) inputs.deltaSource = 'substance';
  if (inputs.deltaSameAdvice === 'yes' || inputs.deltaSameAdvice === 'unsure') {
    inputs.deltaSource = 'advice';
  } else if (inputs.deltaSameAdvice === 'no') {
    inputs.deltaSource = 'substance';
  }

  // The check path asks the size with a required per-group-or-in-total
  // choice; the engine's givenUnits is always the total, so translate
  // here. A size entered with no basis chosen computes nothing.
  if (inputs.givenSize != null) {
    if (!(inputs.givenSize > 0)) {
      problems.push('givenSize: a given size must be a positive number of units.');
    } else if (inputs.givenBasis == null) {
      problems.push('givenBasis: say whether the size you were given is per group or in total; the check runs only once that is chosen.');
    } else {
      inputs.givenUnits = inputs.givenBasis === 'per-group'
        ? inputs.givenSize * partsCount(inputs)
        : inputs.givenSize;
    }
  }

  if (inputs.outcome == null) problems.push('outcome: say whether the outcome is a yes/no rate or a measurement.');
  if (inputs.assignment == null) problems.push('assignment: say whether each unit gets one condition, or both.');

  // The claim is asked only when the design has two subgroups (the
  // question's appliesWhen), and then with no default: the two claims
  // need very different sizes, so an unanswered claim blocks. With no
  // subgroups a main effect is the only possible claim, so an
  // unanswered claim takes it, and the assumption line names it. A
  // claim named directly in the inputs (the worked examples, the
  // acceptance rows) is taken as given, as before.
  const subgroupsSet = inputs.assignment === 'paired' && inputs.subgroups === 'yes';
  if (inputs.claim == null) {
    if (subgroupsSet) {
      problems.push('claim: say whether the claim is a main effect or an interaction (the difference of the effect between the two subgroups); the two need very different sizes, so nothing is calculated until you choose.');
    } else {
      inputs.claim = 'main';
    }
  }
  if (!(inputs.delta > 0)) problems.push('delta: the smallest effect worth detecting must be entered, as a positive number.');
  if (inputs.outcome === 'rate') {
    if (inputs.baseRateChoice == null) {
      problems.push('baseRateChoice: say whether you know the rate under the first condition, or choose "I don\'t know: use 50%, the safest".');
    } else if (inputs.baseRateChoice === 'unknown') {
      inputs.baseRate = null;
    } else if (inputs.baseRateChoice === 'known' && inputs.baseRate == null) {
      problems.push('baseRate: enter the rate under the first condition, or choose "I don\'t know".');
    }
    if (inputs.baseRate != null && !(inputs.baseRate > 0 && inputs.baseRate < 1)) {
      problems.push('baseRate: a rate must lie between 0 and 1.');
    }
    if (inputs.delta != null && inputs.baseRate != null && inputs.baseRate + inputs.delta >= 1) {
      problems.push('baseRate: the base rate plus the effect would pass 100%; the outcome has no room to move.');
    }
  }
  if (inputs.outcome === 'mean') {
    if (!(inputs.sd > 0)) problems.push('sd: a mean outcome needs its standard deviation (for paired units, the SD of the within-unit difference).');
  }
  if (inputs.sigma == null) {
    if (inputs.outcome === 'rate' && inputs.assignment === 'paired') {
      problems.push('sigma: enter how much the effect varies between units (0 if it is the same for every unit).');
    } else {
      inputs.sigma = 0;
    }
  }
  if (!(inputs.sigma >= 0)) problems.push('sigma: the spread of the effect cannot be negative.');
  if (inputs.claims == null) {
    problems.push('claims: enter how many results you will report as confirmatory.');
  } else if (!Number.isInteger(inputs.claims) || inputs.claims < 1) {
    problems.push('claims: the number of hypotheses must be a whole number of 1 or more.');
  }
  if (inputs.claims > 1) {
    if (inputs.claimsRule === 'all') {
      problems.push('claimsRule: v1 does not size "all must hold" yet. It sizes "one is enough", splitting the error rate across the claims (Bonferroni). A design where every result must hold is not sized here, so no size is shown.');
    } else if (inputs.claimsRule == null) {
      problems.push('claimsRule: say whether all of them must hold, or one is enough.');
    }
  }
  if (!(inputs.alpha > 0 && inputs.alpha < 1)) problems.push('alpha: the family error rate must lie between 0 and 1.');
  if (!(inputs.power > 0 && inputs.power < 1)) problems.push('power: power must lie between 0 and 1.');
  if (inputs.givenUnits != null && !(inputs.givenUnits > 0)) problems.push('givenUnits: a given size must be a positive number of units.');
  if (!(inputs.runsPerUnit >= 1)) problems.push('runsPerUnit: runs per unit cannot be below 1.');
  return { inputs, problems };
}

// The two rates under the null-side and effect-side conditions. With no
// base rate given, both sit at 0.5: the largest variance, so the plan
// holds whatever the rate turns out to be.
function rates(inputs) {
  if (inputs.baseRate == null) return { p0: 0.5, p1: 0.5 };
  return { p0: inputs.baseRate, p1: inputs.baseRate + inputs.delta };
}

// Variance of one unit's contribution, before any division by size.
// With r runs per condition the outcome part shrinks by r; sigma does not.
export function variancePerUnit(inputs, runs = inputs.runsPerUnit ?? 1) {
  const r = Math.max(1, runs);
  if (inputs.assignment === 'paired') {
    if (inputs.outcome === 'rate') {
      const { p0, p1 } = rates(inputs);
      return (p0 * (1 - p0) + p1 * (1 - p1)) / r + inputs.sigma ** 2;
    }
    // Paired mean: the SD is of the within-unit difference, which
    // already contains the effect's spread across units.
    return inputs.sd ** 2;
  }
  if (inputs.outcome === 'rate') {
    const { p0, p1 } = rates(inputs);
    return (p0 * (1 - p0) + p1 * (1 - p1)) / r;
  }
  return (2 * inputs.sd ** 2) / r;
}

// How the total splits into parts (arms, cells, subgroups), and how the
// variance of one part's estimate combines into the claim's variance.
// A main effect averages the parts, which divides the variance; an
// interaction differences two parts, which doubles it; independent
// arms were already summed inside V, so their main effect takes the
// variance of one arm's worth of units as it stands.
function partsCount(inputs) {
  if (inputs.assignment === 'paired') {
    return inputs.subgroups === 'yes' ? 2 : 1;
  }
  return inputs.claim === 'interaction' ? 4 : 2;
}

function contrastFactor(inputs) {
  if (inputs.claim === 'interaction') return 2;
  return inputs.assignment === 'paired' && inputs.subgroups === 'yes' ? 0.5 : 1;
}

// Standard error of the estimate at a total of `units` units.
export function seAt(units, inputs) {
  if (!(units > 0)) return Infinity;
  const v = variancePerUnit(inputs);
  const perPart = units / partsCount(inputs);
  return Math.sqrt(v * contrastFactor(inputs) / perPart);
}

// Total units at which the standard error reaches `targetSE`.
export function nForSE(targetSE, inputs) {
  const v = variancePerUnit(inputs);
  return partsCount(inputs) * contrastFactor(inputs) * v / targetSE ** 2;
}

// The size of one part of the design (a group, a cell, or a subgroup),
// what to call the parts, and how effects are stated: in points for a
// rate (a difference of 0.05 is 5 points), in outcome units for a mean.
export function units(inputs) {
  const parts = partsCount(inputs);
  let partName;
  if (inputs.assignment === 'paired') {
    partName = inputs.subgroups === 'yes' ? 'per subgroup' : 'in total';
  } else {
    partName = inputs.claim === 'interaction' ? 'per cell' : 'per group';
  }
  return {
    unitName: 'units',
    parts,
    partName,
    runsPerUnit: inputs.runsPerUnit ?? 1,
    scale: inputs.outcome === 'rate' ? 100 : 1,
    effectUnit: inputs.outcome === 'rate' ? 'points' : 'units',
  };
}

// The check path's echo of the size as it was entered, before its
// translation to the total the engine uses. Null when no size came in
// through the question (a size named directly, as the examples name
// one, needs no echo).
export function sizeEcho(inputs, fmt) {
  if (inputs.givenSize == null || inputs.givenUnits == null) return null;
  const u = units(inputs);
  if (inputs.givenBasis === 'per-group') {
    return `You entered ${fmt.num(inputs.givenSize)} ${u.partName} (${fmt.num(inputs.givenUnits)} in total).`;
  }
  return `You entered ${fmt.num(inputs.givenSize)} in total (${fmt.num(inputs.givenUnits / u.parts)} ${u.partName}).`;
}

// The values the calculation took from a published convention or from
// an explicit "I don't know", listed so the results can name them as
// assumptions instead of letting them pass silently.
export function assumptionLine(inputs, fmt) {
  const items = [];
  items.push(`${fmt.pct(inputs.alpha, 0)} error rate, ${inputs.sides === 'one' ? 'one' : 'two'}-sided`);
  items.push(`${fmt.pct(inputs.power, 0)} power`);
  if (inputs.claim === 'main' && !(inputs.assignment === 'paired' && inputs.subgroups === 'yes')) {
    // The claim was never asked: with no subgroups a main effect is
    // the only possible claim, and the line says so.
    items.push('claim: main effect');
  }
  if (inputs.outcome === 'rate' && inputs.baseRate == null) {
    items.push("base rate 50% (you didn't know it)");
  }
  items.push(inputs.runsPerUnit === 1 ? '1 run' : `${inputs.runsPerUnit} runs`);
  if (inputs.assignment === 'paired') {
    items.push(inputs.subgroups === 'yes' ? 'two equal subgroups' : 'no subgroups');
  }
  return items;
}

// Plain-word description of the design, for the justification. The
// wording of a design belongs to its scenario; the assembler in plan.js
// only puts the pieces in order. `fmt` carries the shared formatters.
export function describe(inputs, fmt) {
  const outcomeText = inputs.outcome === 'rate'
    ? 'a rate (yes/no outcome; effects in percentage points)'
    : 'a mean (effects in outcome units)';
  const assignmentText = inputs.assignment === 'paired'
    ? 'each unit is measured under both conditions (paired)'
    : 'each unit is measured under one condition (independent groups)';
  const claimText = inputs.claim === 'interaction'
    ? 'the claim is an interaction: the difference of the effect between two equal subgroups'
    : 'the claim is a main effect of one condition against the other';
  const noiseLines = [];
  if (inputs.outcome === 'rate') {
    noiseLines.push(inputs.baseRate == null
      ? 'Base rate: not known, so 50% is assumed — the largest variance, so the plan holds whatever the rate turns out to be.'
      : `Base rate: ${fmt.pct(inputs.baseRate)}.`);
    if (inputs.assignment === 'paired' && inputs.sigma > 0) {
      noiseLines.push(`Spread of the effect between units: σ = ${fmt.num(inputs.sigma)}. Effects differ from unit to unit; that spread adds noise that repeating the same unit cannot remove.`);
    }
  } else {
    noiseLines.push(`Standard deviation: ${fmt.num(inputs.sd)}${inputs.assignment === 'paired' ? ' (of the within-unit difference)' : ''}.`);
  }
  return { outcomeText, assignmentText, claimText, noiseLines };
}

// Guardrails that depend on this scenario's inputs (the rest are
// assembled in plan.js from concepts every scenario shares).
export function extraGuardrails(inputs) {
  const notes = [];
  if (inputs.outcome === 'rate' && inputs.baseRate != null) {
    const p1 = inputs.baseRate + inputs.delta;
    if (inputs.baseRate < 0.1 || inputs.baseRate > 0.9 || p1 < 0.1 || p1 > 0.9) {
      notes.push({ id: 'floorCeiling', text: GUARDRAILS.floorCeiling });
    }
  }
  if (inputs.sigma > 0 && inputs.runsPerUnit > 1) {
    notes.push({ id: 'runsFloor', text: GUARDRAILS.runsFloor });
  }
  return notes;
}

// Runs per unit needed to reach a target standard error with a fixed
// number of units per part, when re-running units can still help.
// Returns null when the design has no runs lever (paired means), and
// { feasible: false } when the units alone are below the floor set by
// sigma: no number of runs reaches the target.
export function runsNeededPerUnit(unitsPerPart, targetSE, inputs) {
  if (inputs.assignment === 'paired' && inputs.outcome === 'mean') return null;
  const atRuns = (r) => {
    const trial = { ...inputs, runsPerUnit: r };
    return seAt(unitsPerPart * partsCount(inputs), trial);
  };
  if (atRuns(1) <= targetSE) return { feasible: true, runsPerUnit: 1, runsPerPart: unitsPerPart };
  // As runs grow, the standard error settles at the floor set by sigma.
  const floorSE = (() => {
    const trial = { ...inputs, runsPerUnit: 1e12 };
    return seAt(unitsPerPart * partsCount(inputs), trial);
  })();
  if (floorSE >= targetSE) return { feasible: false, runsPerUnit: Infinity, runsPerPart: Infinity };
  let lo = 1;
  let hi = 2;
  while (atRuns(hi) > targetSE) { lo = hi; hi *= 2; }
  for (let i = 0; i < 100; i++) {
    const mid = Math.sqrt(lo * hi);
    if (atRuns(mid) > targetSE) lo = mid; else hi = mid;
  }
  const runs = hi;
  return { feasible: true, runsPerUnit: runs, runsPerPart: unitsPerPart * runs };
}

// The smallest units per part at which any number of runs could still
// reach the target, when sigma > 0. Null when there is no such floor.
export function minUnitsPerPart(targetSE, inputs) {
  if (!(inputs.sigma > 0)) return null;
  if (inputs.assignment === 'paired' && inputs.outcome === 'mean') return null;
  const atParts = (parts) => {
    const trial = { ...inputs, runsPerUnit: 1e12 };
    return seAt(parts * partsCount(inputs), trial);
  };
  let lo = 1e-9;
  let hi = 1;
  while (atParts(hi) > targetSE) { lo = hi; hi *= 2; }
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (atParts(mid) > targetSE) lo = mid; else hi = mid;
    if (hi / lo < 1 + 1e-12) break;
  }
  return hi;
}
