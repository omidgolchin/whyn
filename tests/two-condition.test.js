// Scenario tests: the two-condition designs and the worked examples
// (spec section 11, rows 2-4, 8-16; sections 8-10).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { alphaPerClaim } from '../src/core/multiplicity.js';
import { budgetK, mdeAt, verdictChances } from '../src/core/budget.js';
import { invNorm, normCdf } from '../src/core/normal.js';
import { powerCostLine, exclusiveVerdicts } from '../src/copy.js';
import * as scenario from '../src/scenarios/two-condition.js';
import { computePlan } from '../src/core/plan.js';
import { EXAMPLES } from '../src/ui/examples.js';

function close(actual, expected, tol, label) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ± ${tol}, got ${actual}`,
  );
}

function plan(inputs) {
  const result = computePlan({ scenario: 'two-condition', inputs });
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  return result;
}

// Worked example 1's settings (spec section 8).
const example1 = {
  outcome: 'rate', assignment: 'paired', claim: 'main', delta: 0.05,
  deltaSource: 'substance', deltaSameAdvice: null,
  baseRateChoice: 'unknown', baseRate: null, sd: null, sigma: 0.2,
  claims: 2, claimsRule: 'one', alpha: 0.05, sides: 'two', power: 0.8,
  givenUnits: null, givenSize: null, givenBasis: null,
  runsPerUnit: 1, subgroups: 'yes',
};

function targetSE(inputs) {
  const { tail } = alphaPerClaim({ alpha: inputs.alpha, claims: inputs.claims, sides: inputs.sides });
  return inputs.delta / budgetK(tail, inputs.power);
}

test('rows 2-3: units per subgroup for sigma 0, 0.1, 0.2, 0.3 at 95% and 97.5%', () => {
  const at95 = [784.9, 800.6, 847.7, 926.2];
  const rounded95 = [785, 801, 848, 927];
  const at975 = [950.5, 969.5, 1026.5, 1121.6];
  const rounded975 = [951, 970, 1027, 1122];
  [0, 0.1, 0.2, 0.3].forEach((sigma, i) => {
    const one = { ...example1, sigma, claims: 1 };
    const perPart95 = scenario.nForSE(targetSE(one), one) / 2;
    close(perPart95, at95[i], 0.1, `row 2, sigma ${sigma}`);
    assert.equal(Math.ceil(perPart95), rounded95[i], `row 2 rounded, sigma ${sigma}`);
    const two = { ...example1, sigma, claims: 2 };
    const perPart975 = scenario.nForSE(targetSE(two), two) / 2;
    close(perPart975, at975[i], 0.1, `row 3, sigma ${sigma}`);
    assert.equal(Math.ceil(perPart975), rounded975[i], `row 3 rounded, sigma ${sigma}`);
  });
});

test('row 4: the interaction at twice the delta needs the same size', () => {
  for (const claims of [1, 2]) {
    const main = { ...example1, claims };
    const inter = { ...example1, claims, claim: 'interaction', delta: 0.10 };
    close(
      scenario.nForSE(targetSE(inter), inter),
      scenario.nForSE(targetSE(main), main),
      0.1,
      `row 4, claims ${claims}`,
    );
  }
});

test('row 8: MDE at the planned size of 2,064 units', () => {
  const seMain = scenario.seAt(2064, example1);
  const inter = { ...example1, claim: 'interaction', delta: 0.10 };
  const seInt = scenario.seAt(2064, inter);
  const k975 = budgetK(alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' }).tail, 0.8);
  const k95 = budgetK(alphaPerClaim({ alpha: 0.05, claims: 1, sides: 'two' }).tail, 0.8);
  close(100 * mdeAt(seMain, k975), 4.99, 0.01, 'main MDE at 97.5%');
  close(100 * mdeAt(seInt, k975), 9.97, 0.01, 'interaction MDE at 97.5%');
  close(100 * mdeAt(seMain, k95), 4.53, 0.01, 'main MDE at 95%');
  close(100 * mdeAt(seInt, k95), 9.06, 0.01, 'interaction MDE at 95%');
});

test('row 9: power at rates 0.135 and 0.185 (a pooled 16% split by the effect)', () => {
  const inputs = { ...example1, baseRate: 0.135 };
  const se = scenario.seAt(2064, inputs);
  const { tail } = alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' });
  const zA = invNorm(1 - tail);
  const p = 1 - normCdf(zA - 0.05 / se);
  close(p, 0.968, 0.001, 'row 9 power');
});

test('row 10: the units floor set by sigma', () => {
  const floor = scenario.minUnitsPerPart(targetSE(example1), example1);
  close(2 * floor, 152.1, 0.1, 'row 10 floor, total units');
  close(floor, 76.05, 0.1, 'row 10 floor, per subgroup');
});

test('row 11: runs needed with only 150 units per subgroup', () => {
  const runs = scenario.runsNeededPerUnit(150, targetSE(example1), example1);
  assert.equal(runs.feasible, true);
  close(runs.runsPerPart, 1928, 1, 'row 11 runs per subgroup and condition');
  close(4 * runs.runsPerPart, 7711, 4, 'row 11 runs in all');
  // Below the floor, no number of runs is enough.
  const stuck = scenario.runsNeededPerUnit(50, targetSE(example1), example1);
  assert.equal(stuck.feasible, false);
});

test('row 12: independent rates, 10% vs 12%', () => {
  const inputs = {
    outcome: 'rate', assignment: 'independent', claim: 'main', delta: 0.02,
    deltaSource: 'substance', baseRate: 0.10, sd: null, sigma: 0,
    claims: 1, alpha: 0.05, sides: 'two', power: 0.8,
    givenUnits: null, runsPerUnit: 1, subgroups: 'no',
  };
  close(scenario.nForSE(targetSE(inputs), inputs) / 2, 3838.1, 0.1, 'row 12 per group');
});

test('row 13: independent means, SD 1, delta 0.5 (z value; the t value is v1.1)', () => {
  const inputs = {
    outcome: 'mean', assignment: 'independent', claim: 'main', delta: 0.5,
    deltaSource: 'substance', baseRate: null, sd: 1, sigma: 0,
    claims: 1, alpha: 0.05, sides: 'two', power: 0.8,
    givenUnits: null, runsPerUnit: 1, subgroups: 'no',
  };
  close(scenario.nForSE(targetSE(inputs), inputs) / 2, 62.8, 0.1, 'row 13 per group');
});

test('row 14: paired main effect and interaction with sigma 0', () => {
  const main = { ...example1, sigma: 0, claims: 1, subgroups: 'no' };
  close(scenario.nForSE(targetSE(main), main), 1569.8, 0.1, 'row 14 main effect');
  const inter = { ...example1, sigma: 0, claims: 1, claim: 'interaction' };
  close(scenario.nForSE(targetSE(inter), inter), 6279.1, 0.1, 'row 14 interaction');
});

test('row 15: MDE of the interaction with only 250 units per subgroup', () => {
  const inter = { ...example1, claim: 'interaction', delta: 0.10 };
  const se = scenario.seAt(500, inter);
  const k975 = budgetK(alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' }).tail, 0.8);
  close(100 * mdeAt(se, k975), 20.3, 0.1, 'row 15 MDE');
});

test('row 16: checking the given number of example 3', () => {
  const result = plan({ ...example1, givenUnits: 800 });
  close(100 * result.given.se, 2.60, 0.01, 'row 16 SE');
  close(100 * result.given.mde, 8.01, 0.01, 'row 16 MDE');
  const atDelta = result.given.verdicts.delta;
  close(atDelta.holds, 0.376, 0.001, 'row 16 holds at delta');
  close(atDelta.doesNotHold, 0.012, 0.001, 'row 16 doesNotHold at delta');
  close(atDelta.inconclusive, 0.612, 0.001, 'row 16 inconclusive at delta');
  const atZero = result.given.verdicts.zero;
  close(atZero.holds, 0.012, 0.001, 'row 16 holds at 0');
  close(atZero.doesNotHold, 0.376, 0.001, 'row 16 doesNotHold at 0');
  close(atZero.inconclusive, 0.612, 0.001, 'row 16 inconclusive at 0');
  assert.equal(result.required.roundedPerPart, 1027, 'row 16: the formula needs 1,027 per subgroup');
});

test('example 1: required size, planned size, verdict chances', () => {
  const result = plan(example1);
  close(result.required.perPart, 1026.5, 0.1, 'example 1 units per subgroup');
  assert.equal(result.required.roundedPerPart, 1027);
  const atPlan = plan({ ...example1, givenUnits: 2064 }).given;
  close(100 * atPlan.se, 1.62, 0.01, 'example 1 SE at planned size');
  close(100 * atPlan.mde, 4.99, 0.01, 'example 1 MDE at planned size');
  close(0.05 / atPlan.se, 3.09, 0.01, 'example 1 budget ratio');
  close(atPlan.verdicts.zero.holds, 0.012, 0.001, 'example 1 holds at 0');
  close(atPlan.verdicts.zero.doesNotHold, 0.802, 0.001, 'example 1 doesNotHold at 0');
  close(atPlan.verdicts.half.holds, 0.243, 0.001, 'example 1 holds at delta/2');
  close(atPlan.verdicts.half.inconclusive, 0.513, 0.001, 'example 1 inconclusive at delta/2');
  close(atPlan.verdicts.delta.holds, 0.802, 0.001, 'example 1 holds at delta');
});

test('example 2: same total, MDE doubled, and the cost of a 5-point delta', () => {
  const inter = { ...example1, claim: 'interaction', delta: 0.10 };
  const result = plan(inter);
  close(result.required.perPart, 1026.5, 0.1, 'example 2 units per subgroup');
  const atPlan = plan({ ...inter, givenUnits: 2064 }).given;
  close(100 * atPlan.mde, 9.97, 0.01, 'example 2 MDE at planned size');
  close(100 * atPlan.se, 3.24, 0.01, 'example 2 SE at planned size');
  const at5 = plan({ ...inter, delta: 0.05 });
  close(at5.required.total, 8212.4, 1.5, 'example 2 total at a 5-point delta');
});

test('validation reports problems instead of throwing', () => {
  const result = computePlan({ scenario: 'two-condition', inputs: { ...example1, delta: null } });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.startsWith('delta')));
  const unknown = computePlan({ scenario: 'nope', inputs: {} });
  assert.equal(unknown.ok, false);
});

test('guardrails fire on the inputs that should trigger them', () => {
  const ids = (r) => r.guardrails.map((g) => g.id);
  assert.ok(ids(plan({ ...example1, deltaSource: 'pilot' })).includes('deltaFromPilot'));
  assert.ok(ids(plan({ ...example1, deltaSource: 'advice', givenUnits: 800 })).includes('sameSource'));
  assert.ok(ids(plan({ ...example1, givenUnits: 800 })).includes('givenBelow'));
  assert.ok(ids(plan({ ...example1, claim: 'interaction', delta: 0.10 })).includes('interactionCost'));
  const big = plan({ ...example1, givenUnits: 5000 });
  assert.ok(ids(big).includes('givenAbove'));
  assert.ok(big.given.bothPossible);
  assert.ok(ids(plan({ ...example1, baseRateChoice: 'known', baseRate: 0.05 })).includes('floorCeiling'));
});

// --- The 2026-11-18 question-set ruling: rows Q1-Q6 -------------------

// The rehearsal's check: an AI assistant said "300 people per group"
// for a 4-point improvement; the base rate was not known.
const q2base = {
  outcome: 'rate', assignment: 'independent', claim: 'main', delta: 0.04,
  deltaSameAdvice: 'no', baseRateChoice: 'unknown', baseRate: null,
  sd: null, sigma: null, claims: 1, claimsRule: null,
  alpha: 0.05, sides: 'two', power: 0.8,
  givenSize: 300, givenBasis: 'per-group', runsPerUnit: 1, subgroups: 'no',
};

test('Q1: the check path computes nothing until per group or in total is chosen', () => {
  const noBasis = computePlan({ scenario: 'two-condition', inputs: { ...q2base, givenBasis: null } });
  assert.equal(noBasis.ok, false);
  assert.ok(noBasis.problems.some((p) => p.startsWith('givenBasis')), JSON.stringify(noBasis.problems));
  assert.equal(noBasis.required, undefined);
});

test('Q2: 300 per group vs 300 in total (pinned against the reference script)', () => {
  // Reference (NormalDist, script sections I/J formulas): per group 300
  // -> MDE 11.4374 points, holds at delta 0.16350; per group 150
  // -> MDE 16.17496 points, holds 0.10255. The ruling states these as
  // 11.44 / 16.4% and 16.17 / 10.3%.
  const perGroup = plan(q2base);
  assert.equal(perGroup.given.totalUnits, 600);
  close(100 * perGroup.given.mde, 11.44, 0.01, 'Q2 MDE, 300 per group');
  close(perGroup.given.verdicts.delta.holds, 0.164, 0.001, 'Q2 holds, 300 per group');
  const echoFmt = { num: (x) => Number(x.toFixed(2)).toLocaleString('en-US') };
  assert.equal(
    scenario.sizeEcho(perGroup.inputs, echoFmt),
    'You entered 300 per group (600 in total).',
  );
  const inTotal = plan({ ...q2base, givenBasis: 'total' });
  assert.equal(inTotal.given.totalUnits, 300);
  close(100 * inTotal.given.mde, 16.17, 0.01, 'Q2 MDE, 300 in total');
  close(inTotal.given.verdicts.delta.holds, 0.103, 0.001, 'Q2 holds, 300 in total');
});

test('Q3: no input without a convention arrives pre-filled', () => {
  const d = scenario.defaults();
  for (const key of ['givenSize', 'givenBasis', 'outcome', 'assignment', 'claim', 'delta',
    'deltaSameAdvice', 'baseRateChoice', 'baseRate', 'sd', 'sigma', 'claims', 'claimsRule']) {
    assert.equal(d[key], null, `${key} should start empty`);
  }
  // The pre-fills that survive are the published conventions. (The
  // claim started pre-filled too, until the addendum to the ruling
  // removed its default; Q7 pins the gating that replaced it.)
  assert.equal(d.alpha, 0.05);
  assert.equal(d.sides, 'two');
  assert.equal(d.power, 0.8);
  assert.equal(d.runsPerUnit, 1);
  assert.equal(d.subgroups, 'no');
  // And an unanswered question blocks the calculation rather than
  // silently taking a value: the spread on a paired rate design...
  const noSigma = computePlan({ scenario: 'two-condition', inputs: { ...example1, sigma: null } });
  assert.equal(noSigma.ok, false);
  assert.ok(noSigma.problems.some((p) => p.startsWith('sigma')), JSON.stringify(noSigma.problems));
  // ...and the base rate, until "I don't know" is chosen explicitly.
  const noChoice = computePlan({ scenario: 'two-condition', inputs: { ...example1, baseRateChoice: null } });
  assert.equal(noChoice.ok, false);
  assert.ok(noChoice.problems.some((p) => p.startsWith('baseRateChoice')), JSON.stringify(noChoice.problems));
});

test('Q4: every pre-filled value and every "I don\'t know" appears in the assumption line', () => {
  const fmt = { pct: (x, digits = 1) => `${(100 * x).toFixed(digits)}%` };
  const line = scenario.assumptionLine(plan(q2base).inputs, fmt).join(' · ');
  assert.ok(line.includes('5% error rate, two-sided'), line);
  assert.ok(line.includes('80% power'), line);
  assert.ok(line.includes("base rate 50% (you didn't know it)"), line);
  assert.ok(line.includes('1 run'), line);
  // A base rate the researcher entered is an answer, not an assumption.
  const known = plan({ ...q2base, baseRateChoice: 'known', baseRate: 0.135, givenSize: null, givenBasis: null });
  const knownLine = scenario.assumptionLine(known.inputs, fmt).join(' · ');
  assert.ok(!knownLine.includes('base rate'), knownLine);
  // The paired design's subgroup split is an assumption too.
  const paired = scenario.assumptionLine(plan(example1).inputs, fmt).join(' · ');
  assert.ok(paired.includes('two equal subgroups'), paired);
});

test('Q6: "all must hold" shows the not-yet-sized message and no n', () => {
  const all = computePlan({ scenario: 'two-condition', inputs: { ...example1, claimsRule: 'all' } });
  assert.equal(all.ok, false);
  assert.ok(
    all.problems.some((p) => p.includes('does not size "all must hold" yet')),
    JSON.stringify(all.problems),
  );
  assert.equal(all.required, undefined);
  const unanswered = computePlan({ scenario: 'two-condition', inputs: { ...example1, claimsRule: null } });
  assert.equal(unanswered.ok, false);
  assert.ok(unanswered.problems.some((p) => p.startsWith('claimsRule')));
});

test('question 7: a Δ from the same advice fires the independence guardrail', () => {
  const ids = (r) => r.guardrails.map((g) => g.id);
  assert.ok(ids(plan({ ...example1, deltaSameAdvice: 'yes', givenUnits: 800 })).includes('sameSource'));
  assert.ok(ids(plan({ ...example1, deltaSameAdvice: 'unsure', givenUnits: 800 })).includes('sameSource'));
  assert.ok(!ids(plan({ ...example1, deltaSameAdvice: 'no', givenUnits: 800 })).includes('sameSource'));
});

// --- The addendum to the ruling: rows Q7-Q9 ---------------------------

test('Q7: the claim is asked only when subgroups are set, and then with no default', () => {
  const claimQ = scenario.questions.find((q) => q.key === 'claim');
  assert.equal(claimQ.default, null);
  assert.equal(typeof claimQ.appliesWhen, 'function');
  assert.equal(claimQ.appliesWhen({ assignment: 'paired', subgroups: 'yes' }), true);
  assert.equal(claimQ.appliesWhen({ assignment: 'paired', subgroups: 'no' }), false);
  assert.equal(claimQ.appliesWhen({ assignment: 'independent', subgroups: 'no' }), false);
  // With subgroups set and no claim chosen, nothing computes.
  const unanswered = computePlan({ scenario: 'two-condition', inputs: { ...example1, claim: null } });
  assert.equal(unanswered.ok, false);
  assert.ok(unanswered.problems.some((p) => p.startsWith('claim')), JSON.stringify(unanswered.problems));
  assert.equal(unanswered.required, undefined);
  // With no subgroups there is nothing to ask: an unanswered claim
  // takes the main effect, and the assumption line names it.
  const noSub = plan({ ...example1, subgroups: 'no', claim: null });
  assert.equal(noSub.inputs.claim, 'main');
  const fmt = { pct: (x, digits = 1) => `${(100 * x).toFixed(digits)}%` };
  const noSubLine = scenario.assumptionLine(noSub.inputs, fmt).join(' · ');
  assert.ok(noSubLine.includes('claim: main effect'), noSubLine);
  // With subgroups set, the claim is the researcher's own answer, not
  // an assumption: the line does not name it.
  const chosenLine = scenario.assumptionLine(plan(example1).inputs, fmt).join(' · ');
  assert.ok(!chosenLine.includes('claim:'), chosenLine);
});

// A one-claim version of the rehearsal design (Q2's settings without
// the given size), for the rows that pin the cost line at one claim:
// 5% two-sided, so the verdict chances at Δ split at a 2.5% tail.
const oneClaim = {
  outcome: 'rate', assignment: 'independent', claim: 'main', delta: 0.04,
  deltaSameAdvice: null, baseRateChoice: 'unknown', baseRate: null,
  sd: null, sigma: null, claims: 1, claimsRule: null,
  alpha: 0.05, sides: 'two', power: 0.8,
  givenSize: null, givenBasis: null, runsPerUnit: 1, subgroups: 'no',
};

test('Q8: the justification states the cost of power', () => {
  const result = plan(oneClaim);
  assert.ok(
    result.justification.includes(
      'At the required size, if the true effect is exactly Δ, 20% of studies end without holds: 17.5% inconclusive, 2.5% does not hold.',
    ),
    result.justification,
  );
});

test('Q9: at 90% power the cost line reads 10%: 7.5% inconclusive, 2.5% does not hold', () => {
  // Pinned against the reference script before this test was written:
  // outcome_probs at the target SE (delta / K, K from k_value(0.95,
  // 0.90) = 3.241516) gives holds 0.900000, doesNotHold 0.025000,
  // inconclusive 0.075000 — the addendum's figures exactly.
  const result = plan({ ...oneClaim, power: 0.9 });
  assert.ok(
    result.justification.includes(
      'At the required size, if the true effect is exactly Δ, 10% of studies end without holds: 7.5% inconclusive, 2.5% does not hold.',
    ),
    result.justification,
  );
});

// --- Addendum 2, after the live repo was checked: rows Q10-Q12 --------

test('Q10: the cost line names the required size and matches the verdict chances there', () => {
  // In the check path (q2base: one claim, 5% two-sided, 80% power)
  // the line is the plan's own verdict chances at Δ at the standard
  // error the formula asks for, stated once, under the required size.
  const result = plan(q2base);
  const atRequired = verdictChances({
    effect: result.inputs.delta, se: result.inputs.delta / result.K,
    delta: result.inputs.delta, zA: result.zA,
  });
  const line = powerCostLine(result.inputs.power, {
    inconclusive: atRequired.inconclusive,
    doesNotHold: atRequired.doesNotHold - atRequired.both,
  });
  assert.equal(
    line,
    'At the required size, if the true effect is exactly Δ, 20% of studies end without holds: 17.5% inconclusive, 2.5% does not hold.',
  );
  assert.ok(line.startsWith('At the required size, if the true effect is exactly Δ'), line);
  // Once in the justification; the results-side placement (once,
  // under number 1) is pinned by the page check's boot assertions.
  assert.equal(result.justification.split(line).length - 1, 1, result.justification);
});

test('Q11: example 3 enters the size its story tells, and its numbers do not move', () => {
  const ex3 = EXAMPLES.find((e) => e.id === 'ex3');
  assert.equal(ex3.inputs.givenSize, 400);
  assert.equal(ex3.inputs.givenBasis, 'per-group');
  assert.equal(ex3.inputs.deltaSameAdvice, 'no');
  assert.equal(ex3.inputs.givenUnits, undefined);
  // 400 per subgroup across two subgroups is the same 800 in total
  // the example always checked: row 16's numbers, unchanged.
  const result = plan({ ...scenario.defaults(), ...ex3.inputs });
  assert.equal(result.given.totalUnits, 800);
  close(100 * result.given.mde, 8.01, 0.01, 'Q11 MDE at the given size');
  close(result.given.verdicts.delta.holds, 0.376, 0.001, 'Q11 holds at delta');
  // The echo speaks in the design's own word for its parts: this
  // design has subgroups, so "per subgroup" — the same word the
  // basis option and the story use.
  const echoFmt = { num: (x) => Number(x.toFixed(2)).toLocaleString('en-US') };
  assert.equal(
    scenario.sizeEcho(result.inputs, echoFmt),
    'You entered 400 per subgroup (800 in total).',
  );
  const basisQ = scenario.questions.find((q) => q.key === 'givenBasis');
  const perGroup = basisQ.options.find((o) => o.value === 'per-group');
  assert.equal(perGroup.label(result.inputs), 'per subgroup');
  assert.equal(perGroup.label({ assignment: 'independent', subgroups: 'no' }), 'per group');
  assert.ok(ex3.story.includes('400 per subgroup'), ex3.story);
});

test('Q12: an unanswered Δ-source counts as "not sure" on a checked size', () => {
  const fmt = { pct: (x, digits = 1) => `${(100 * x).toFixed(digits)}%` };
  const unanswered = plan({ ...q2base, deltaSameAdvice: null });
  assert.equal(unanswered.inputs.deltaSource, 'advice');
  assert.ok(
    unanswered.guardrails.map((g) => g.id).includes('sameSource'),
    JSON.stringify(unanswered.guardrails),
  );
  const line = scenario.assumptionLine(unanswered.inputs, fmt).join(' · ');
  assert.ok(line.includes('Δ source: not stated, treated as not sure'), line);
  // A size named directly (a pre-ruling link) is a check too.
  const viaUnits = plan({ ...example1, deltaSource: undefined, givenUnits: 800 });
  assert.equal(viaUnits.inputs.deltaSource, 'advice');
  // With no size to check, the question was never in play: the
  // default stands and nothing fires.
  const noCheck = plan(oneClaim);
  assert.equal(noCheck.inputs.deltaSource, 'substance');
  assert.ok(!noCheck.guardrails.map((g) => g.id).includes('sameSource'));
  // A source named directly still wins over the blank.
  const named = plan({ ...q2base, deltaSameAdvice: null, deltaSource: 'substance' });
  assert.equal(named.inputs.deltaSource, 'substance');
  assert.ok(!named.guardrails.map((g) => g.id).includes('sameSource'));
});

// --- Addendum 3, the owner's own rulings: rows Q13-Q15 ----------------

test('Q13: every displayed verdict row sums to 100%, the fourth verdict carved out', () => {
  const fmtPct = (x) => `${(100 * x).toFixed(1)}%`;
  const checkVerdicts = (verdicts, label) => {
    for (const k of ['zero', 'half', 'delta']) {
      const v = verdicts[k];
      const c = exclusiveVerdicts(v);
      // The partition is exact before any rounding.
      close(c.holds + c.doesNotHold + c.smaller + c.inconclusive, 1, 1e-9, `Q13 ${label} ${k}: cells sum to 1`);
      // And as displayed (one decimal each), within the row's ±0.1.
      const displayed = [c.holds, c.doesNotHold, c.inconclusive, c.smaller]
        .reduce((s, x) => s + parseFloat(fmtPct(x)), 0);
      assert.ok(Math.abs(displayed - 100) <= 0.1 + 1e-9, `Q13 ${label} ${k}: displayed sum ${displayed}`);
      // A reversal is part of "does not hold", never on top of it.
      assert.ok(c.reversal <= c.doesNotHold + 1e-12, `Q13 ${label} ${k}: reversal inside does-not-hold`);
      // Power keeps its standard meaning: the two cells that clear 0
      // together are the core's holds chance.
      close(c.holds + c.smaller, v.holds, 1e-12, `Q13 ${label} ${k}: holds + smaller = power's chance`);
    }
  };
  for (const ex of EXAMPLES) {
    const r = plan({ ...scenario.defaults(), ...ex.inputs });
    checkVerdicts((r.given ?? r.planned).verdicts, ex.id);
  }
  // At a size large enough for the fourth verdict to show, it is
  // carved out of both cells it used to be counted in.
  const ex1 = EXAMPLES.find((e) => e.id === 'ex1');
  const big = plan({ ...scenario.defaults(), ...ex1.inputs, givenUnits: 5000 });
  assert.ok(big.given.verdicts.half.both > 0, 'the fourth verdict occurs at 5,000 units');
  const c = exclusiveVerdicts(big.given.verdicts.half);
  assert.ok(c.holds < big.given.verdicts.half.holds, 'the fourth verdict is carved out of holds');
  assert.ok(c.doesNotHold < big.given.verdicts.half.doesNotHold, 'the fourth verdict is carved out of does-not-hold');
  checkVerdicts(big.given.verdicts, 'ex1 at 5000');
});

test('Q14: the page opens on the plain check — 300 students per group, a 4-point rise', () => {
  // Pinned against the reference script before this test was written:
  // independent groups, rates 0.5/0.5 (the base rate is not known),
  // Δ = 0.04, K = k_value(0.95, 0.80) = 2.801585. Required per group:
  // 0.5 * K^2 / 0.04^2 = 2452.7749 -> 2,453 per group, 4,906 in all.
  // At 300 per group, outcome_probs gives MDE 11.4374 points and
  // holds at Δ 0.16350 — Q2's pins, the same case by construction.
  const first = EXAMPLES[0];
  assert.equal(first.id, 'ex4');
  assert.equal(first.path, 'check');
  assert.ok(first.story.includes('300 per group'), first.story);
  assert.equal(first.inputs.deltaSameAdvice, 'no');
  assert.equal(first.inputs.baseRateChoice, 'unknown');
  const result = plan({ ...scenario.defaults(), ...first.inputs });
  assert.equal(result.required.roundedPerPart, 2453, 'Q14: 2,453 per group');
  assert.equal(result.required.roundedTotal, 4906, 'Q14: 4,906 in all');
  assert.equal(result.given.totalUnits, 600);
  close(100 * result.given.mde, 11.44, 0.01, 'Q14 MDE at 300 per group');
  close(result.given.verdicts.delta.holds, 0.164, 0.001, 'Q14 holds at delta');
  const echoFmt = { num: (x) => Number(x.toFixed(2)).toLocaleString('en-US') };
  assert.equal(
    scenario.sizeEcho(result.inputs, echoFmt),
    'You entered 300 per group (600 in total).',
  );
  // The Δ was the team's own question, not the advice's: the
  // independence guardrail does not fire.
  assert.ok(!result.guardrails.map((g) => g.id).includes('sameSource'));
});

test('Q15: examples 1 to 3 keep their numbers', () => {
  const byId = (id) => EXAMPLES.find((e) => e.id === id);
  const ex1 = plan({ ...scenario.defaults(), ...byId('ex1').inputs });
  assert.equal(ex1.required.roundedTotal, 2054, 'Q15 example 1 required total');
  close(100 * ex1.given.mde, 4.99, 0.01, 'Q15 example 1 MDE at the planned size');
  const ex2 = plan({ ...scenario.defaults(), ...byId('ex2').inputs });
  assert.equal(ex2.required.roundedTotal, 2054, 'Q15 example 2 required total');
  close(100 * ex2.given.mde, 9.97, 0.01, 'Q15 example 2 MDE at the planned size');
  const ex3 = plan({ ...scenario.defaults(), ...byId('ex3').inputs });
  assert.equal(ex3.required.roundedTotal, 2054, 'Q15 example 3 required total');
  close(100 * ex3.given.mde, 8.01, 0.01, 'Q15 example 3 MDE at the given size');
  close(ex3.given.verdicts.delta.holds, 0.376, 0.001, 'Q15 example 3 holds at delta');
});

// --- Addendum 4, the justification at high power: row Q16 -------------

test('Q16: at 99% power the justification partitions its chances and names the fourth verdict', () => {
  // The plain check's inputs (ex4, Q14) with the power set to 99% —
  // above 1 − α/2, where the fourth verdict can occur at the required
  // size. The justification states its three chances in the same
  // mutually exclusive partition as the table (Addendum 3), so each
  // line adds up to 100% and names the fourth verdict. Before this
  // addendum the lines stated the core's overlapping chances and
  // added up to 101.5% at 0 and Δ, 114.5% at Δ/2.
  const ex4 = EXAMPLES[0];
  const result = plan({ ...scenario.defaults(), ...ex4.inputs, power: 0.99 });
  const lines = result.justification.split('\n')
    .filter((l) => l.startsWith('If the true effect is'));
  assert.equal(lines.length, 3, result.justification);
  for (const line of lines) {
    const shown = [...line.matchAll(/([\d.]+)%/g)].map((m) => parseFloat(m[1]));
    const sum = shown.reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(sum - 100) <= 0.1 + 1e-9, `Q16: line sums to ${sum}: ${line}`);
    assert.ok(line.includes('an effect, but smaller than Δ'), `Q16: fourth verdict named: ${line}`);
  }
  // The partition behind the words is exact, and power keeps its
  // standard meaning: holds + smaller is the core's holds chance.
  for (const k of ['zero', 'half', 'delta']) {
    const raw = result.planned.verdicts[k];
    const c = exclusiveVerdicts(raw);
    assert.ok(raw.both > 0, `Q16 ${k}: the fourth verdict occurs at 99% power`);
    close(c.holds + c.doesNotHold + c.smaller + c.inconclusive, 1, 1e-9, `Q16 ${k}: cells sum to 1`);
    close(c.holds + c.smaller, raw.holds, 1e-12, `Q16 ${k}: holds + smaller = power's chance`);
  }
  // At the default 80% power the partition is the identity: no
  // justification line names a fourth verdict that cannot occur.
  const atDefault = plan({ ...scenario.defaults(), ...ex4.inputs });
  for (const line of atDefault.justification.split('\n')
    .filter((l) => l.startsWith('If the true effect is'))) {
    assert.ok(!line.includes('smaller than Δ'), `Q16: default line unchanged: ${line}`);
  }
});
