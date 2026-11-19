// computePlan is the one public entry point of the engine.
// JSON in, JSON out: a request names a scenario and its inputs, and the
// result carries the four numbers, the verdict chances, the guardrails
// that fired, and a justification that can be pasted into a paper.
//
// This module assembles; it does not calculate. The equation lives in
// budget.js, the sharing of alpha in multiplicity.js, and each scenario
// owns its own variance model and its own design wording.

import { alphaPerClaim } from './multiplicity.js';
import { zCritical, zPower, powerAt, mdeAt, verdictChances, bothThresholdMultiple } from './budget.js';
import { COPY, GUARDRAILS, powerCostLine } from '../copy.js';
import * as twoCondition from '../scenarios/two-condition.js';

export const SCHEMA_VERSION = 1;

const SCENARIOS = {
  [twoCondition.id]: twoCondition,
};

export function listScenarios() {
  return Object.values(SCENARIOS).map((s) => ({ id: s.id, version: s.version }));
}

function verdictSet(se, inputs, zA) {
  const at = (effect) => verdictChances({ effect, se, delta: inputs.delta, zA });
  return { zero: at(0), half: at(inputs.delta / 2), delta: at(inputs.delta) };
}

function pct(x, digits = 1) {
  return `${(100 * x).toFixed(digits)}%`;
}

function num(x, digits = 2) {
  return Number(x.toFixed(digits)).toLocaleString('en-US');
}

function guardrailsFor({ scenario, inputs, requiredRaw, plannedTotal, given, floor, tail, intervalLevel }) {
  const notes = [];
  const add = (idKey, text) => notes.push({ id: idKey, text });
  if (inputs.deltaSource === 'pilot' || inputs.deltaSource === 'convention') {
    add('deltaFromPilot', GUARDRAILS.deltaFromPilot);
  }
  if (inputs.deltaSource === 'advice') {
    add('sameSource', GUARDRAILS.sameSource);
  }
  if (inputs.claim === 'interaction') add('interactionCost', GUARDRAILS.interactionCost);
  if (inputs.sides === 'one') add('oneSided', GUARDRAILS.oneSided);
  if (inputs.power < 0.8) add('lowPower', GUARDRAILS.lowPower(Math.round(100 * (1 - inputs.power))));
  if (intervalLevel < 0.9) {
    add('lowLevel', GUARDRAILS.lowLevel(num(100 * tail, 1)));
  }
  if (plannedTotal < 30) add('fewUnits', GUARDRAILS.fewUnits);
  if (given) {
    if (given.totalUnits < requiredRaw) add('givenBelow', GUARDRAILS.givenBelow);
    if (given.bothPossible) add('givenAbove', GUARDRAILS.givenAbove);
  }
  if (floor && given && given.perPart <= floor.perPart) {
    add('belowFloor', `The size you entered is at or below the floor of ${num(floor.perPart)} units per part set by the spread of the effect: at that size, no number of runs per unit reaches the target.`);
  }
  if (typeof scenario.extraGuardrails === 'function') {
    notes.push(...scenario.extraGuardrails(inputs));
  }
  return notes;
}

function justificationFor({ scenario, inputs, result }) {
  const unitInfo = result.units;
  const effectText = (x) => `${num(unitInfo.scale * x)} ${unitInfo.effectUnit}`;
  const d = scenario.describe(inputs, { pct, num, effectText });
  const lines = [];
  lines.push('## Sample size justification');
  lines.push('');
  lines.push(`Design: ${d.outcomeText}; ${d.assignmentText}; ${d.claimText}.`);
  lines.push(`Smallest effect worth detecting: Δ = ${effectText(inputs.delta)}. ${COPY.sesoi.text}`);
  for (const line of d.noiseLines) lines.push(line);
  lines.push(`Confirmatory claims sharing the error rate: ${inputs.claims}; family error rate ${pct(inputs.alpha, 0)} (${inputs.sides === 'one' ? 'one' : 'two'}-sided), so each claim is read with a ${num(100 * result.intervalLevel)}% interval. Target power: ${pct(inputs.power, 0)}.`);
  // The cost of that power, from the verdict chances at a true effect
  // of exactly Δ at the standard error the equation asks for. (The
  // addendum to the 2026-11-18 ruling lifted the no-core fence for
  // this line only; the wording is the shared copy in copy.js.)
  const atDelta = verdictChances({ effect: inputs.delta, se: inputs.delta / result.K, delta: inputs.delta, zA: result.zA });
  lines.push(powerCostLine(inputs.power, {
    inconclusive: atDelta.inconclusive,
    doesNotHold: atDelta.doesNotHold - atDelta.both,
  }));
  lines.push('');
  const req = result.required;
  lines.push(`Required size: ${req.roundedTotal.toLocaleString('en-US')} units in total (${req.roundedPerPart.toLocaleString('en-US')} ${unitInfo.partName}); the unrounded value is ${num(req.total)} units. ${COPY.rounding.text}`);
  lines.push(`At that size the standard error is ${effectText(result.planned.se)}, so Δ spans ${num(result.planned.budgetRatio)} standard errors (Δ/SE = z_a + z_b = ${num(result.K)}). The smallest effect this size detects with ${pct(inputs.power, 0)} power is ${effectText(result.planned.mde)}.`);
  const v = result.planned.verdicts;
  lines.push(`If the true effect is 0: holds ${pct(v.zero.holds)}, does not hold ${pct(v.zero.doesNotHold)}, inconclusive ${pct(v.zero.inconclusive)}.`);
  lines.push(`If the true effect is Δ/2 (${effectText(inputs.delta / 2)}): holds ${pct(v.half.holds)}, does not hold ${pct(v.half.doesNotHold)}, inconclusive ${pct(v.half.inconclusive)}.`);
  lines.push(`If the true effect is Δ (${effectText(inputs.delta)}): holds ${pct(v.delta.holds)}, does not hold ${pct(v.delta.doesNotHold)}, inconclusive ${pct(v.delta.inconclusive)}.`);
  if (result.given) {
    const g = result.given;
    lines.push('');
    lines.push(`Checking a size that was given: ${g.totalUnits.toLocaleString('en-US')} units. That size buys a smallest detectable effect of ${effectText(g.mde)} and, if the true effect is Δ, a ${pct(g.powerAtDelta)} chance of "holds"; the formula needs ${req.roundedTotal.toLocaleString('en-US')} units for Δ. ${COPY.check.text}`);
  }
  if (result.floor) {
    lines.push(`Units floor: with this spread of the effect, fewer than ${num(result.floor.perPart)} units ${unitInfo.partName} can never reach the target, however many runs each unit gets.`);
  }
  if (result.guardrails.length) {
    lines.push('');
    lines.push('Notes:');
    for (const g of result.guardrails) lines.push(`- ${g.text}`);
  }
  lines.push('');
  lines.push('Every number comes from Δ/SE = z_a + z_b under a normal approximation, computed by WhyN. The calculation is deterministic — the same inputs always give the same answer — and independent of whoever produced any size it checks.');
  return lines.join('\n');
}

export function computePlan(request) {
  const scenario = SCENARIOS[request?.scenario];
  if (!scenario) {
    return { ok: false, schemaVersion: SCHEMA_VERSION, problems: [`unknown scenario: ${request?.scenario}`] };
  }
  const { inputs, problems } = scenario.validate(request.inputs ?? {});
  if (problems.length) {
    return { ok: false, schemaVersion: SCHEMA_VERSION, scenarioId: scenario.id, problems };
  }

  const { perClaim, tail } = alphaPerClaim({ alpha: inputs.alpha, claims: inputs.claims, sides: inputs.sides });
  const zA = zCritical(tail);
  const zB = zPower(inputs.power);
  const K = zA + zB;
  const targetSE = inputs.delta / K;

  const unitInfo = scenario.units(inputs);
  const requiredRaw = scenario.nForSE(targetSE, inputs);
  const perPartRaw = requiredRaw / unitInfo.parts;
  const roundedPerPart = Math.ceil(perPartRaw);
  const plannedTotal = roundedPerPart * unitInfo.parts;
  const sePlanned = scenario.seAt(plannedTotal, inputs);

  const result = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    inputs,
    alphaPerClaim: perClaim,
    intervalLevel: 1 - perClaim,
    zA,
    zB,
    K,
    units: unitInfo,
    required: {
      total: requiredRaw,
      perPart: perPartRaw,
      roundedTotal: plannedTotal,
      roundedPerPart,
    },
    planned: {
      totalUnits: plannedTotal,
      se: sePlanned,
      mde: mdeAt(sePlanned, K),
      budgetRatio: inputs.delta / sePlanned,
      powerAtDelta: powerAt(inputs.delta, sePlanned, zA),
      verdicts: verdictSet(sePlanned, inputs, zA),
    },
    given: null,
    floor: null,
    runs: null,
    bothMultiple: bothThresholdMultiple(zA, K),
    guardrails: [],
    justification: '',
  };

  if (inputs.givenUnits != null) {
    const se = scenario.seAt(inputs.givenUnits, inputs);
    const verdicts = verdictSet(se, inputs, zA);
    result.given = {
      totalUnits: inputs.givenUnits,
      perPart: inputs.givenUnits / unitInfo.parts,
      se,
      mde: mdeAt(se, K),
      powerAtDelta: powerAt(inputs.delta, se, zA),
      ratioToRequired: inputs.givenUnits / requiredRaw,
      bothPossible: verdicts.delta.bothPossible,
      verdicts,
    };
  }

  if (typeof scenario.minUnitsPerPart === 'function') {
    const perPart = scenario.minUnitsPerPart(targetSE, inputs);
    if (perPart != null) result.floor = { perPart, total: perPart * unitInfo.parts };
  }

  if (typeof scenario.runsNeededPerUnit === 'function') {
    const basisPerPart = result.given ? result.given.perPart : roundedPerPart;
    const runs = scenario.runsNeededPerUnit(basisPerPart, targetSE, inputs);
    if (runs != null) {
      result.runs = {
        basisPerPart,
        feasible: runs.feasible,
        runsPerUnit: runs.feasible ? runs.runsPerUnit : null,
        runsPerPart: runs.feasible ? Math.ceil(runs.runsPerPart) : null,
      };
    }
  }

  result.guardrails = guardrailsFor({
    scenario,
    inputs,
    requiredRaw,
    plannedTotal,
    given: result.given,
    floor: result.floor,
    tail,
    intervalLevel: result.intervalLevel,
  });
  result.justification = justificationFor({ scenario, inputs, result });
  return result;
}
