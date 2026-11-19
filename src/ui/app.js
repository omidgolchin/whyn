// The page: questions on one side, the four numbers and their reasons
// on the other, with the budget bar, the verdict curve, the guardrails
// and the justification below. All calculation goes through
// computePlan; this file only asks, formats and draws.

import { computePlan } from '../core/plan.js';
import { verdictChances } from '../core/budget.js';
import * as scenario from '../scenarios/two-condition.js';
import { COPY, GUARDRAILS, powerCostLine, exclusiveVerdicts } from '../copy.js';
import { EXAMPLES } from './examples.js';
import { readState, writeState } from './state.js';
import { budgetExplorer, verdictCurve } from './charts.js';

const $ = (sel) => document.querySelector(sel);

const HINTS = {
  outcome: 'Effects are stated in percentage points for a rate, in outcome units for a mean.',
  sd: 'For paired units this is the standard deviation of the within-unit difference; it already contains the spread of the effect.',
};

// Display conversions: the form speaks in points and percents where a
// person would; the engine speaks in proportions.
function toDisplay(key, value, inputs) {
  if (value == null) return '';
  if (key === 'delta') return inputs.outcome === 'rate' ? value * 100 : value;
  if (key === 'baseRate' || key === 'alpha' || key === 'power') return value * 100;
  return value;
}
function fromDisplay(key, raw, inputs) {
  if (raw === '' || raw == null) return null;
  const value = Number(raw);
  if (Number.isNaN(value)) return null;
  if (key === 'delta') return inputs.outcome === 'rate' ? value / 100 : value;
  if (key === 'baseRate' || key === 'alpha' || key === 'power') return value / 100;
  return value;
}
function suffixFor(key, inputs) {
  if (key === 'delta') return inputs.outcome === 'rate' ? 'points' : 'units';
  if (key === 'baseRate' || key === 'alpha' || key === 'power') return '%';
  return '';
}
function stepFor(key, inputs) {
  if (key === 'delta') return inputs.outcome === 'rate' ? 0.5 : 0.1;
  if (key === 'sigma' || key === 'sd') return 0.05;
  if (key === 'baseRate' || key === 'alpha' || key === 'power') return 1;
  return 1;
}

let currentInputs = { ...scenario.defaults() };
let currentPath = 'check';
let currentExampleId = null;

const formEl = $('#questions');
const resultsEl = $('#results');
const budgetEl = $('#budget');
const curveEl = $('#curve');
const guardrailsEl = $('#guardrails');
const justifyEl = $('#justification-text');
const storyEl = $('#example-story');
const whyEl = $('#example-why');

function applies(question, inputs) {
  if (typeof question.appliesWhen === 'function') return question.appliesWhen(inputs);
  if (!question.appliesTo) return true;
  return Object.entries(question.appliesTo).every(([k, v]) => inputs[k] === v);
}

function hintFor(question) {
  if (question.key === 'deltaSameAdvice') return GUARDRAILS.sameSource;
  if (question.key === 'delta' && currentPath === 'check' && question.hintCheck) return question.hintCheck;
  if (question.copyKey && COPY[question.copyKey]) return COPY[question.copyKey].text;
  return HINTS[question.key] ?? '';
}

function buildForm() {
  formEl.innerHTML = '';
  const ordered = [...scenario.questions].sort((a, b) => {
    if (currentPath !== 'check') return 0;
    if (a.key === 'givenSize') return -1;
    if (b.key === 'givenSize') return 1;
    return 0;
  });
  for (const q of ordered) {
    if (q.hidden) continue;
    if (q.paths && !q.paths.includes(currentPath)) continue;
    if (!applies(q, currentInputs)) continue;
    const wrap = document.createElement('div');
    wrap.className = 'field' + (q.key === 'givenSize' && currentPath === 'check' ? ' field-first' : '');
    const id = `q-${q.key}`;
    // A label may be a function of the current answers (the SD of a
    // paired design is the SD of each unit's difference; the parts of
    // a design with subgroups are subgroups, not groups).
    const labelText = typeof q.label === 'function' ? q.label(currentInputs) : q.label;
    if (q.kind === 'choice') {
      const fs = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = labelText;
      fs.appendChild(legend);
      for (const opt of q.options) {
        const optLabel = typeof opt.label === 'function' ? opt.label(currentInputs) : opt.label;
        const lab = document.createElement('label');
        lab.className = 'radio';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = q.key;
        input.value = opt.value;
        input.checked = currentInputs[q.key] === opt.value;
        lab.append(input, document.createTextNode(` ${optLabel}`));
        fs.appendChild(lab);
      }
      wrap.appendChild(fs);
    } else {
      const lab = document.createElement('label');
      lab.htmlFor = id;
      lab.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.id = id;
      input.name = q.key;
      input.step = String(stepFor(q.key, currentInputs));
      if (q.key === 'claims' || q.key === 'givenUnits' || q.key === 'givenSize' || q.key === 'runsPerUnit') input.min = '1';
      input.value = toDisplay(q.key, currentInputs[q.key], currentInputs);
      if (q.key === 'delta') input.placeholder = 'must be entered';
      wrap.appendChild(lab);
      const row = document.createElement('div');
      row.className = 'input-row';
      row.appendChild(input);
      const suffix = suffixFor(q.key, currentInputs);
      if (suffix) {
        const s = document.createElement('span');
        s.className = 'suffix';
        s.textContent = suffix;
        row.appendChild(s);
      }
      wrap.appendChild(row);
    }
    const hint = hintFor(q);
    if (hint) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = hint;
      wrap.appendChild(p);
    }
    formEl.appendChild(wrap);
  }
}

function collectInputs() {
  const next = { ...currentInputs };
  for (const q of scenario.questions) {
    if (q.kind === 'choice') {
      const checked = formEl.querySelector(`input[name="${q.key}"]:checked`);
      if (checked) next[q.key] = checked.value;
    } else {
      const input = formEl.querySelector(`input[name="${q.key}"]`);
      if (input) next[q.key] = fromDisplay(q.key, input.value, next);
    }
  }
  currentInputs = next;
}

function fmtNum(x, digits = 2) {
  return Number(x.toFixed(digits)).toLocaleString('en-US');
}
function fmtPct(x, digits = 1) {
  return `${(100 * x).toFixed(digits)}%`;
}
function effectText(x, result) {
  return `${fmtNum(result.units.scale * x)} ${result.units.effectUnit}`;
}

// The cost of the chosen power, from the verdict chances at a true
// effect of exactly Δ at the standard error the formula asks for —
// the same figures the justification states.
function powerCost(result) {
  const { inputs, zA, K } = result;
  const v = verdictChances({ effect: inputs.delta, se: inputs.delta / K, delta: inputs.delta, zA });
  return powerCostLine(inputs.power, {
    inconclusive: v.inconclusive,
    doesNotHold: v.doesNotHold - v.both,
  });
}

// The verdict table shows mutually exclusive cells (decision log
// #7): the fourth verdict is carved out of both "holds" and "does
// not hold", a reversal sits inside "does not hold" as a sub-line,
// and every row adds up to 100%.
function verdictTable(verdicts, result, showBoth) {
  const row = (label, v) => {
    const c = exclusiveVerdicts(v);
    return `<tr><th scope="row">${label}</th>` +
      `<td>${fmtPct(c.holds)}</td>` +
      `<td>${fmtPct(c.doesNotHold)} (incl. ${fmtPct(c.reversal)} reversal)</td>` +
      `<td>${fmtPct(c.inconclusive)}</td>${showBoth ? `<td>${fmtPct(c.smaller)}</td>` : ''}</tr>`;
  };
  return `<table class="verdicts">
    <thead><tr><th scope="col">If the true effect is</th><th scope="col">holds</th>` +
    `<th scope="col">does not hold</th><th scope="col">inconclusive</th>` +
    `${showBoth ? '<th scope="col">an effect, but smaller than Δ</th>' : ''}</tr></thead>
    <tbody>
      ${row('0', verdicts.zero)}
      ${row(`Δ/2 (${effectText(result.inputs.delta / 2, result)})`, verdicts.half)}
      ${row(`Δ (${effectText(result.inputs.delta, result)})`, verdicts.delta)}
    </tbody></table>`;
}

function renderResults(result) {
  const focus = result.given ?? result.planned;
  const focusIsGiven = Boolean(result.given);
  const focusLabel = focusIsGiven
    ? `the size you entered (${result.given.totalUnits.toLocaleString('en-US')} units)`
    : 'the required size';
  const req = result.required;
  const parts = [];
  parts.push('<h2>The four numbers</h2>');
  if (currentPath === 'check' && !result.given) {
    parts.push('<p class="note">Enter the size you were given in the first question to check it; the numbers below are the plan from the design alone.</p>');
  }
  if (result.given && typeof scenario.sizeEcho === 'function') {
    const echo = scenario.sizeEcho(result.inputs, { num: fmtNum });
    if (echo) parts.push(`<p class="note">${echo}</p>`);
  }
  // 1. Required size. The cost of the chosen power is computed at
  // this size, so the line sits here, once (Addendum 2) — beside the
  // entered size it contradicted the verdict table below it.
  let why1 = `Unrounded: ${fmtNum(req.total)} units. ${COPY.rounding.text}`;
  if (result.given) {
    why1 += result.given.totalUnits < req.total
      ? ` Your entered size is ${(req.total - result.given.totalUnits).toLocaleString('en-US', { maximumFractionDigits: 0 })} units short of it. Ask whoever gave you this number which Δ, base rate or SD, error rate and power they assumed.`
      : ' Your entered size covers it.';
  }
  why1 += ` ${powerCost(result)}`;
  parts.push(`<div class="number"><h3>1 · Required sample size</h3>
    <p class="big">${req.roundedTotal.toLocaleString('en-US')} units <span class="sub">(${req.roundedPerPart.toLocaleString('en-US')} ${result.units.partName})</span></p>
    <p class="why">${why1}</p></div>`);
  // 2. MDE at the size in focus.
  let why2 = `The smallest effect ${focusLabel} would find with ${fmtPct(result.inputs.power, 0)} power.`;
  if (focusIsGiven && focus.mde > result.inputs.delta) {
    why2 += ` That is larger than your Δ of ${effectText(result.inputs.delta, result)}: this size can only find effects bigger than the ones you care about.`;
  }
  parts.push(`<div class="number"><h3>2 · Minimum detectable effect at ${focusLabel}</h3>
    <p class="big">${effectText(focus.mde, result)}</p>
    <p class="why">${why2}</p></div>`);
  // 3. Interval level. The false-"holds" figure is the verdict
  // table's own holds chance at a true effect of 0, formatted by the
  // same function, so the two always agree (Addendum 2).
  const tailPct = fmtPct(focus.verdicts.zero.holds);
  parts.push(`<div class="number"><h3>3 · Interval level</h3>
    <p class="big">${fmtNum(100 * result.intervalLevel)}% <span class="sub">per claim</span></p>
    <p class="why">Family error rate ${fmtPct(result.inputs.alpha, 0)} split across ${result.inputs.claims} claim(s) (Bonferroni), ${fmtPct(result.alphaPerClaim)} each; a false "holds" in the predicted direction is at most ${tailPct} per claim.</p></div>`);
  // 4. Verdict chances. When the fourth verdict can occur, one line
  // states how the table's cells relate to power: power counts every
  // interval that clears 0, so it is "holds" and "smaller than Δ"
  // together (decision log #7).
  const showBoth = ['zero', 'half', 'delta'].some((k) => focus.verdicts[k].both > 0.0005);
  parts.push(`<div class="number"><h3>4 · The chance of each verdict at ${focusLabel}</h3>
    ${verdictTable(focus.verdicts, result, showBoth)}${showBoth
      ? '<p class="why">"holds" and "an effect, but smaller than Δ" together make up the power: power counts every interval that clears 0 in the predicted direction, on either side of Δ.</p>'
      : ''}</div>`);
  // The values the page assumed, named as assumptions.
  if (typeof scenario.assumptionLine === 'function') {
    const items = scenario.assumptionLine(result.inputs, { pct: fmtPct });
    parts.push(`<p class="assumed">Assumed: ${items.join(' · ')}.</p>`);
  }
  // Floor and runs.
  if (result.floor || (result.runs && (!result.runs.feasible || result.runs.runsPerUnit > 1.05))) {
    parts.push('<div class="number"><h3>Units and runs</h3>');
    if (result.floor) {
      parts.push(`<p class="why">Units floor: below ${Math.ceil(result.floor.perPart).toLocaleString('en-US')} units ${result.units.partName}, no number of runs per unit reaches the target — the spread of the effect between units sets a floor that only more units can lift.</p>`);
    }
    if (result.runs && !result.runs.feasible) {
      parts.push(`<p class="why">With ${fmtNum(result.runs.basisPerPart, 0)} units ${result.units.partName}, no number of runs reaches the target; those units are below the floor.</p>`);
    } else if (result.runs && result.runs.runsPerUnit > 1.05) {
      parts.push(`<p class="why">Runs instead of units: with ${fmtNum(result.runs.basisPerPart, 0)} units ${result.units.partName}, the target takes about ${result.runs.runsPerPart.toLocaleString('en-US')} runs ${result.units.partName} and condition — roughly ${fmtNum(result.runs.runsPerUnit, 1)} runs per unit.</p>`);
    }
    parts.push('</div>');
  }
  resultsEl.innerHTML = parts.join('');
}

function renderExampleChrome() {
  const example = EXAMPLES.find((e) => e.id === currentExampleId);
  const matches = example && JSON.stringify(normalized(currentInputs)) === JSON.stringify(normalized(example.inputs));
  if (example && matches) {
    storyEl.innerHTML = `<strong>${example.title}.</strong> ${example.story}`;
    storyEl.hidden = false;
    whyEl.innerHTML = '<h3>Why these numbers</h3>' + example.whyLines
      .map(([head, text]) => `<p><em>${head}:</em> ${text}</p>`).join('');
    whyEl.hidden = false;
  } else {
    storyEl.hidden = true;
    whyEl.hidden = true;
  }
  document.querySelectorAll('#example-bar button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.example === currentExampleId && Boolean(matches)));
  });
}

function normalized(inputs) {
  const out = {};
  for (const q of scenario.questions) out[q.key] = inputs[q.key] ?? null;
  return out;
}

function render() {
  const result = computePlan({ scenario: scenario.id, inputs: currentInputs });
  writeState(scenario, { inputs: currentInputs, path: currentPath, exampleId: currentExampleId });
  renderExampleChrome();
  if (!result.ok) {
    resultsEl.innerHTML = '<h2>The four numbers</h2>' + result.problems
      .map((p) => `<p class="problem">${p}</p>`).join('') +
      '<p class="note">Nothing is calculated until the questions above make sense.</p>';
    budgetEl.innerHTML = '';
    curveEl.innerHTML = '';
    guardrailsEl.innerHTML = '';
    justifyEl.textContent = '';
    return;
  }
  renderResults(result);
  budgetExplorer(budgetEl, { inputs: currentInputs, result });
  verdictCurve(curveEl, { inputs: currentInputs, result });
  guardrailsEl.innerHTML = result.guardrails.length
    ? '<h3>Notes on these choices</h3><ul>' + result.guardrails.map((g) => `<li>${g.text}</li>`).join('') + '</ul>'
    : '';
  justifyEl.textContent = result.justification;
}

function loadExample(id) {
  const example = EXAMPLES.find((e) => e.id === id);
  if (!example) return;
  currentExampleId = id;
  currentPath = example.path;
  currentInputs = { ...scenario.defaults(), ...example.inputs };
  document.querySelectorAll('input[name="path"]').forEach((r) => { r.checked = r.value === currentPath; });
  buildForm();
  render();
}

const STRUCTURAL = new Set(['outcome', 'assignment', 'claim', 'subgroups', 'claims', 'baseRateChoice']);
formEl.addEventListener('input', () => { collectInputs(); render(); });
formEl.addEventListener('change', (event) => {
  collectInputs();
  if (STRUCTURAL.has(event.target.name)) {
    // A claim chosen for a two-subgroup design means nothing once the
    // question stops applying; clear it, so it is asked afresh if the
    // subgroups come back.
    const claimQ = scenario.questions.find((q) => q.key === 'claim');
    if (!applies(claimQ, currentInputs)) currentInputs.claim = null;
    buildForm();
  }
  render();
});

document.querySelectorAll('input[name="path"]').forEach((r) => {
  r.addEventListener('change', () => {
    currentPath = r.value;
    // The worked examples name an engine-level deltaSource. The
    // questions replace it — the check path asks the Δ-source
    // question itself — so a hand path switch drops it rather than
    // letting it answer that question silently (Addendum 2).
    delete currentInputs.deltaSource;
    if (currentPath === 'plan') {
      // The check-only questions belong to the check path; leaving
      // their answers in place would check a size the planning path
      // never asked about.
      for (const q of scenario.questions) {
        if (q.paths && !q.paths.includes('plan')) currentInputs[q.key] = q.default;
      }
    }
    buildForm();
    render();
  });
});

$('#example-bar').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-example]');
  if (button) loadExample(button.dataset.example);
});

$('#copy-justification').addEventListener('click', async () => {
  const button = $('#copy-justification');
  try {
    await navigator.clipboard.writeText(justifyEl.textContent);
    button.textContent = 'Copied';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(justifyEl);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = 'Selected — copy it now';
  }
  setTimeout(() => { button.textContent = 'Copy the justification'; }, 2000);
});

$('#observed-power').addEventListener('click', () => {
  const note = $('#observed-power-note');
  note.textContent = GUARDRAILS.observedPower;
  note.hidden = false;
});

// Start: a shared link wins; otherwise open on the plain check
// (decision log #8): an AI-given size in the plainest design.
const fromUrl = readState(scenario);
if (fromUrl) {
  currentInputs = { ...scenario.defaults(), ...fromUrl.inputs };
  currentPath = fromUrl.path;
  currentExampleId = fromUrl.exampleId;
  document.querySelectorAll('input[name="path"]').forEach((r) => { r.checked = r.value === currentPath; });
  buildForm();
  render();
} else {
  loadExample('ex4');
}
