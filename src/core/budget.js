// The error budget: everything in WhyN comes from one equation,
//
//     delta / SE(n) = z_a + z_b = K
//
// The left side is the budget: how many standard errors the smallest
// effect worth detecting (delta) spans. The right side is how the budget
// is spent: z_a buys protection against false alarms, z_b against
// misses. This module knows nothing about any particular design; it
// works with standard errors, deltas and error rates only.

import { normCdf, invNorm } from './normal.js';

// z_a: the critical value for one claim, from the tail probability
// (alpha per claim, already split by sidedness in multiplicity.js).
export function zCritical(tail) {
  return invNorm(1 - tail);
}

// z_b: the critical value bought by the target power.
export function zPower(power) {
  if (!(power > 0 && power < 1)) {
    throw new RangeError(`zPower: power must lie between 0 and 1, got ${power}`);
  }
  return invNorm(power);
}

// K: how many standard errors delta must span.
export function budgetK(tail, power) {
  return zCritical(tail) + zPower(power);
}

// Power at a true effect e, given a standard error and z_a:
// the chance the interval clears 0 in the predicted direction.
export function powerAt(effect, se, zA) {
  return 1 - normCdf(zA - effect / se);
}

// Minimum detectable effect at a given standard error: K * SE.
export function mdeAt(se, K) {
  return K * se;
}

// The sample size a target standard error needs, from a function that
// gives the standard error at any size. Sizes are continuous here;
// callers round up.
export function nForSE(seAt, targetSE) {
  if (!(targetSE > 0)) throw new RangeError(`nForSE: target SE must be positive, got ${targetSE}`);
  let lo = 1e-9;
  let hi = 1;
  // Standard errors fall as size grows, so bracket then bisect.
  while (seAt(hi) > targetSE) {
    hi *= 2;
    if (hi > 1e15) throw new RangeError('nForSE: no reachable size gives that standard error');
  }
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (seAt(mid) > targetSE) lo = mid; else hi = mid;
    if (hi / lo < 1 + 1e-12) break;
  }
  return hi;
}

// The chance of each verdict at a true effect, under the three-way rule.
// The interval is estimate +/- z_a * SE, the effect is predicted positive,
// and delta is the smallest effect worth detecting:
//   holds        the interval excludes 0 in the predicted direction
//   doesNotHold  the interval excludes effects of delta or more
//   reversal     the interval lies wholly below 0 (part of doesNotHold)
//   both         the interval sits strictly between 0 and delta, so it
//                supports "an effect, but smaller than delta"; possible
//                only when the interval is narrower than delta
//   inconclusive none of the above
// The five always sum to 1 (reversal is inside doesNotHold, both is
// carved out of the overlap of holds and doesNotHold).
export function verdictChances({ effect, se, delta, zA }) {
  const holds = 1 - normCdf(zA - effect / se);
  const doesNotHold = normCdf((delta - effect) / se - zA);
  const reversal = normCdf(-effect / se - zA);
  const bothPossible = 2 * zA * se < delta;
  const both = bothPossible
    ? Math.max(0, doesNotHold - normCdf(zA - effect / se))
    : 0;
  const inconclusive = 1 - holds - doesNotHold + both;
  return { holds, doesNotHold, reversal, both, inconclusive, bothPossible };
}

// The multiple of the required size at which "both" first becomes
// possible: the size where 2 * z_a * SE shrinks to delta, as a ratio
// (2 * z_a / K)^2 of the required size.
export function bothThresholdMultiple(zA, K) {
  return (2 * zA / K) ** 2;
}
