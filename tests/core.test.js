// Core tests: the normal distribution, the error budget, and the
// acceptance rows that belong to no single design
// (spec section 11, rows 1, 5, 6, 7 and 17).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normCdf, invNorm } from '../src/core/normal.js';
import { alphaPerClaim } from '../src/core/multiplicity.js';
import { budgetK, powerAt, verdictChances, bothThresholdMultiple } from '../src/core/budget.js';
import * as scenario from '../src/scenarios/two-condition.js';
import { COPY, GUARDRAILS, powerCostLine } from '../src/copy.js';

function close(actual, expected, tol, label) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ± ${tol}, got ${actual}`,
  );
}

test('invNorm hits known values to 1e-9', () => {
  const known = [
    [0.8, 0.8416212335729143],
    [0.9, 1.2815515655446004],
    [0.975, 1.959963984540054],
    [0.9875, 2.241402727604947],
    [0.995, 2.5758293035489004],
    [0.999, 3.090232306167813],
  ];
  for (const [p, z] of known) close(invNorm(p), z, 1e-9, `invNorm(${p})`);
});

test('normCdf and invNorm round-trip', () => {
  for (const p of [0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999]) {
    close(normCdf(invNorm(p)), p, 1e-12, `round trip at ${p}`);
  }
  close(normCdf(0), 0.5, 1e-15, 'normCdf(0)');
  close(normCdf(1.959963984540054), 0.975, 1e-12, 'normCdf at z(0.975)');
});

test('row 1: K values', () => {
  const tail = (level) => (1 - level) / 2;
  close(budgetK(tail(0.95), 0.8), 2.8016, 0.0001, 'K 95%/80%');
  close(budgetK(tail(0.975), 0.8), 3.0830, 0.0001, 'K 97.5%/80%');
  close(budgetK(tail(0.99), 0.8), 3.4175, 0.0001, 'K 99%/80%');
  close(budgetK(tail(0.95), 0.9), 3.2415, 0.0001, 'K 95%/90%');
});

test('row 5: splitting alpha over two claims costs x1.211 units', () => {
  const one = alphaPerClaim({ alpha: 0.05, claims: 1, sides: 'two' });
  const two = alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' });
  const ratio = (budgetK(two.tail, 0.8) / budgetK(one.tail, 0.8)) ** 2;
  close(ratio, 1.211, 0.001, 'cost of m = 2');
});

test('multiplicity: one-sided puts the whole claim alpha in one tail', () => {
  const { perClaim, tail } = alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'one' });
  close(perClaim, 0.025, 1e-12, 'per claim');
  close(tail, 0.025, 1e-12, 'one-sided tail');
});

// The planned size of worked example 1: 1,032 exercises per subgroup,
// paired rates, worst case, sigma 0.2.
const example1 = {
  outcome: 'rate', assignment: 'paired', claim: 'main', delta: 0.05,
  deltaSource: 'substance', baseRate: null, sd: null, sigma: 0.2,
  claims: 2, alpha: 0.05, sides: 'two', power: 0.8,
  givenUnits: null, runsPerUnit: 1, subgroups: 'yes',
};

test('row 6: power at the fixed planned size, by interval level', () => {
  const se = scenario.seAt(2064, example1);
  const expected = new Map([
    [0.90, 0.926], [0.95, 0.871], [0.975, 0.802], [0.99, 0.697], [0.995, 0.612],
  ]);
  for (const [level, power] of expected) {
    const { tail } = alphaPerClaim({ alpha: 1 - level, claims: 1, sides: 'two' });
    const zA = invNorm(1 - tail);
    close(powerAt(0.05, se, zA), power, 0.001, `power at level ${level}`);
  }
});

test('row 7: verdict chances at the planned size', () => {
  const se = scenario.seAt(2064, example1);
  const { tail } = alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' });
  const zA = invNorm(1 - tail);
  // [effect, holds, doesNotHold, reversal, inconclusive]
  const rows = [
    [-0.025, 0.000, 0.992, 0.243, 0.008],
    [0, 0.012, 0.802, 0.012, 0.185],
    [0.0125, 0.071, 0.531, 0.001, 0.398],
    [0.025, 0.243, 0.243, 0.000, 0.513],
    [0.0375, 0.531, 0.071, 0.000, 0.398],
    [0.05, 0.802, 0.012, 0.000, 0.185],
    [0.075, 0.992, 0.000, 0.000, 0.008],
  ];
  for (const [effect, holds, notHold, reversal, inconclusive] of rows) {
    const v = verdictChances({ effect, se, delta: 0.05, zA });
    close(v.holds, holds, 0.001, `holds at ${effect}`);
    close(v.doesNotHold, notHold, 0.001, `doesNotHold at ${effect}`);
    close(v.reversal, reversal, 0.001, `reversal at ${effect}`);
    close(v.inconclusive, inconclusive, 0.001, `inconclusive at ${effect}`);
    close(v.both, 0, 1e-12, `both at ${effect}`);
    close(v.holds + v.doesNotHold - v.both + v.inconclusive, 1, 1e-12, `chances sum at ${effect}`);
  }
});

test('the fourth verdict appears only past its threshold, and chances still sum to 1', () => {
  const { tail } = alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' });
  const zA = invNorm(1 - tail);
  const K = budgetK(tail, 0.8);
  const requiredSE = 0.05 / K;
  // At three times the required size the interval is narrower than delta.
  const se = requiredSE / Math.sqrt(3);
  const v = verdictChances({ effect: 0.025, se, delta: 0.05, zA });
  assert.equal(v.bothPossible, true);
  assert.ok(v.both > 0, 'both should be positive past the threshold');
  close(v.holds + v.doesNotHold - v.both + v.inconclusive, 1, 1e-12, 'chances sum with both');
  const atRequired = verdictChances({ effect: 0.025, se: requiredSE, delta: 0.05, zA });
  assert.equal(atRequired.bothPossible, false);
  assert.equal(atRequired.both, 0);
});

test('row 17: the multiple of the required size where "both" becomes possible', () => {
  const at975 = alphaPerClaim({ alpha: 0.05, claims: 2, sides: 'two' });
  const at95 = alphaPerClaim({ alpha: 0.05, claims: 1, sides: 'two' });
  close(bothThresholdMultiple(invNorm(1 - at975.tail), budgetK(at975.tail, 0.8)), 2.114, 0.001, 'multiple at 97.5%');
  close(bothThresholdMultiple(invNorm(1 - at95.tail), budgetK(at95.tail, 0.8)), 1.958, 0.001, 'multiple at 95%');
});

test('Q5: the cost of power is stated wherever power is shown', () => {
  // The split at a true effect of Δ, from the verdict chances at the
  // size the formula asks for. Pinned against the reference script
  // (outcome_probs at the target SE, one claim, 5% two-sided): at 80%
  // power, inconclusive 0.175000 and doesNotHold 0.025000; at 90%,
  // 0.075000 and 0.025000. The line opens by naming the required size
  // (Addendum 2); the figures are the addendum's, unchanged.
  const split = (power) => {
    const { tail } = alphaPerClaim({ alpha: 0.05, claims: 1, sides: 'two' });
    const zA = invNorm(1 - tail);
    const v = verdictChances({ effect: 0.05, se: 0.05 / budgetK(tail, power), delta: 0.05, zA });
    return { inconclusive: v.inconclusive, doesNotHold: v.doesNotHold - v.both };
  };
  assert.equal(
    powerCostLine(0.8, split(0.8)),
    'At the required size, if the true effect is exactly Δ, 20% of studies end without holds: 17.5% inconclusive, 2.5% does not hold.',
  );
  assert.equal(
    powerCostLine(0.9, split(0.9)),
    'At the required size, if the true effect is exactly Δ, 10% of studies end without holds: 7.5% inconclusive, 2.5% does not hold.',
  );
});

test('decision log #2: reasons run to at most three sentences and about 60 words', () => {
  const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0).length;
  const words = (t) => t.split(/\s+/).filter(Boolean).length;
  const texts = [];
  for (const [key, entry] of Object.entries(COPY)) {
    texts.push([`COPY.${key}`, entry.text]);
    if (entry.warn) texts.push([`COPY.${key} (warn)`, entry.warn]);
  }
  for (const [key, value] of Object.entries(GUARDRAILS)) {
    texts.push([`GUARDRAILS.${key}`, typeof value === 'function' ? value(50) : value]);
  }
  // The split shown here is the pinned one from Q5 (80% power, one
  // claim, 5% two-sided); only the line's length is on trial here.
  texts.push(['powerCostLine(0.8, split at Δ)', powerCostLine(0.8, { inconclusive: 0.175, doesNotHold: 0.025 })]);
  for (const [name, text] of texts) {
    assert.ok(sentences(text) <= 3, `${name}: ${sentences(text)} sentences`);
    assert.ok(words(text) <= 60, `${name}: ${words(text)} words`);
  }
});
