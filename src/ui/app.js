// The page: a compact form on one side, the answer on the other, and
// everything else (the verdict table, the error budget, the verdict
// curve, the justification) one click away. Explanations open on
// request from the info buttons. All calculation goes through
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

// The form in groups, in the order a person thinks about a study. The
// conventional settings sit in a closed group whose summary names
// their values, so nothing pre-filled is out of sight.
const GROUPS = [
  { id: 'given', title: 'The number you were given', keys: ['givenSize', 'givenBasis'], paths: ['check'] },
  { id: 'design', title: 'Your design', keys: ['subgroups', 'claim'] },
  { id: 'effect', title: 'The effect you care about', keys: ['delta', 'deltaSameAdvice', 'baseRateChoice', 'baseRate', 'sd', 'sigma'] },
  { id: 'claims', title: 'What you will report', keys: ['claims', 'claimsRule'] },
  { id: 'conventions', title: 'Conventions', keys: ['alpha', 'sides', 'power', 'runsPerUnit'], collapsible: true },
];

// Step 2: what the experiment compares. Each choice names the tests a
// researcher already knows it by, and sets the two answers the engine
// needs (outcome and assignment). Designs WhyN does not size yet are
// listed too, so nobody sizes an ANOVA with a two-group formula.
const EXPERIMENTS = [
  { id: 'rate-independent', outcome: 'rate', assignment: 'independent',
    title: 'Two separate groups, a yes/no outcome',
    tests: 'Two-proportion z-test; the same as a chi-square test on a 2×2 table',
    example: 'A clinic texts a reminder to half its patients and not to the other half, then compares the share who show up: say 70% without the text and 75% with it.',
    pickIf: 'Pick this when each unit gets one condition and each unit\'s outcome is a yes or a no.' },
  { id: 'mean-independent', outcome: 'mean', assignment: 'independent',
    title: 'Two separate groups, a measurement',
    tests: 'Two-sample t-test',
    example: 'Tomato plants get fertilizer A or fertilizer B, one each, and you compare their average height after six weeks.',
    pickIf: 'Pick this when each unit gets one condition and the outcome is a number you measure.' },
  { id: 'mean-paired', outcome: 'mean', assignment: 'paired',
    title: 'The same units under both conditions, a measurement',
    tests: 'Paired t-test',
    example: 'Each volunteer\'s reaction time is measured once with coffee and once without, and you compare the difference within each person.',
    pickIf: 'Pick this when every unit is measured under both conditions and the outcome is a number.' },
  { id: 'rate-paired', outcome: 'rate', assignment: 'paired',
    title: 'The same units under both conditions, a yes/no outcome over repeated tries',
    tests: 'Paired comparison of rates',
    example: 'Each exercise in a language app is shown to many learners in its old design and in its new one, and you compare the share answered correctly, exercise by exercise.',
    pickIf: 'Pick this when every unit gets both conditions and its outcome is a yes or no counted over many tries.' },
];
const LATER = [
  { title: 'Three or more groups', tests: 'one-way ANOVA', tool: 'gpower' },
  { title: 'How two measurements move together', tests: 'correlation, regression slope', tool: 'gpower' },
  { title: 'Categories across more than two groups', tests: 'chi-square on a larger table', tool: 'gpower' },
  { title: 'Time until an event', tests: 'log-rank, survival', tool: 'declare' },
  { title: 'Whole classes, clinics or sites assigned together', tests: 'cluster-randomized', tool: 'declare' },
];
const TOOLS = {
  gpower: '<a href="https://www.psychologie.hhu.de/arbeitsgruppen/allgemeine-psychologie-und-arbeitspsychologie/gpower">G*Power</a> sizes it',
  declare: '<a href="https://declaredesign.org/">DeclareDesign</a> can simulate it',
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
  if (key === 'delta') return inputs.outcome === 'rate' ? 'points' : inputs.outcome === 'mean' ? 'units' : '';
  if (key === 'baseRate' || key === 'alpha' || key === 'power') return '%';
  return '';
}
function stepFor(key, inputs) {
  if (key === 'delta') return inputs.outcome === 'rate' ? 0.5 : 0.1;
  if (key === 'sigma' || key === 'sd') return 0.05;
  return 1;
}

let currentInputs = { ...scenario.defaults() };
let currentPath = null;
let currentExampleId = null;
let conventionsOpen = false;

const formEl = $('#questions');
const resultsEl = $('#results');
const budgetEl = $('#budget');
const curveEl = $('#curve');
const guardrailsEl = $('#guardrails');
const justifyEl = $('#justification-text');
const storyEl = $('#example-story');
const whyEl = $('#example-why');
const whyDetails = $('#why-details');
const jumpEl = $('#answer-jump');
const pickerEl = $('#experiment-picker');
const startOverBtn = $('#start-over');

function applies(question, inputs) {
  if (typeof question.appliesWhen === 'function') return question.appliesWhen(inputs);
  if (!question.appliesTo) return true;
  return Object.entries(question.appliesTo).every(([k, v]) => inputs[k] === v);
}

function hintFor(question) {
  if (question.key === 'deltaSameAdvice') return GUARDRAILS.sameSource;
  if (question.copyKey && COPY[question.copyKey]) return COPY[question.copyKey].text;
  return HINTS[question.key] ?? '';
}

function shown(q) {
  if (!q || q.hidden) return false;
  if (q.paths && !q.paths.includes(currentPath)) return false;
  return applies(q, currentInputs);
}

// An info button and the explanation it opens. The explanation lives
// in the page as a hidden source (so it can be found and tested); the
// button shows a copy in one floating tooltip that sits over the page
// and moves nothing (see "Tooltips" below).
function infoButton(key, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'info';
  btn.setAttribute('aria-label', `What does “${label}” mean?`);
  btn.setAttribute('aria-controls', 'whyn-pop');
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = 'i';
  btn.dataset.pop = `hint-${key}`;
  return btn;
}
function hintPara(key, text) {
  const p = document.createElement('div');
  p.className = 'pop-src';
  p.id = `hint-${key}`;
  p.textContent = text;
  p.hidden = true;
  return p;
}

function buildField(q) {
  const wrap = document.createElement('div');
  wrap.className = `field field-${q.key}`;
  const id = `q-${q.key}`;
  // A label may be a function of the current answers (the SD of a
  // paired design is the SD of each unit's difference; the parts of
  // a design with subgroups are subgroups, not groups).
  const labelText = typeof q.label === 'function' ? q.label(currentInputs) : q.label;
  const hint = hintFor(q);
  const head = document.createElement('div');
  head.className = 'field-head';

  if (q.kind === 'choice') {
    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = labelText;
    head.appendChild(legend);
    if (hint) head.appendChild(infoButton(q.key, labelText));
    fs.appendChild(head);
    const row = document.createElement('div');
    row.className = 'choices';
    for (const opt of q.options) {
      const optLabel = typeof opt.label === 'function' ? opt.label(currentInputs) : opt.label;
      const lab = document.createElement('label');
      lab.className = 'choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = q.key;
      input.value = opt.value;
      input.checked = currentInputs[q.key] === opt.value;
      const span = document.createElement('span');
      span.textContent = optLabel;
      lab.append(input, span);
      row.appendChild(lab);
    }
    fs.appendChild(row);
    if (hint) fs.appendChild(hintPara(q.key, hint));
    wrap.appendChild(fs);
    return wrap;
  }

  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = labelText;
  head.appendChild(lab);
  if (hint) head.appendChild(infoButton(q.key, labelText));
  wrap.appendChild(head);
  const row = document.createElement('div');
  row.className = 'input-row';
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.id = id;
  input.name = q.key;
  input.step = String(stepFor(q.key, currentInputs));
  if (['claims', 'givenUnits', 'givenSize', 'runsPerUnit'].includes(q.key)) input.min = '1';
  input.value = toDisplay(q.key, currentInputs[q.key], currentInputs);
  if (q.key === 'delta' && currentPath === 'check' && q.hintCheck) input.placeholder = 'the improvement you were told about';
  row.appendChild(input);
  const suffix = suffixFor(q.key, currentInputs);
  if (suffix) {
    const s = document.createElement('span');
    s.className = 'suffix';
    s.textContent = suffix;
    row.appendChild(s);
  }
  wrap.appendChild(row);
  if (q.key === 'delta' && currentPath === 'check' && q.hintCheck) {
    const p = document.createElement('p');
    p.className = 'aside';
    p.textContent = q.hintCheck;
    wrap.appendChild(p);
  }
  if (hint) wrap.appendChild(hintPara(q.key, hint));
  return wrap;
}

function conventionsSummary(inputs) {
  const pct = (x) => (x == null ? '—' : `${+(100 * x).toFixed(1)}%`);
  const runs = inputs.runsPerUnit ?? 1;
  return `${pct(inputs.alpha)} error rate, ${inputs.sides === 'one' ? 'one' : 'two'}-sided, ${pct(inputs.power)} power, ${runs} run${runs === 1 ? '' : 's'} per unit`;
}

function buildForm() {
  formEl.innerHTML = '';
  const byKey = Object.fromEntries(scenario.questions.map((q) => [q.key, q]));
  for (const g of GROUPS) {
    if (g.paths && !g.paths.includes(currentPath)) continue;
    const qs = g.keys.map((k) => byKey[k]).filter(shown);
    if (!qs.length) continue;
    let box;
    if (g.collapsible) {
      box = document.createElement('details');
      box.className = 'group group-conventions';
      box.open = conventionsOpen;
      const sum = document.createElement('summary');
      sum.innerHTML = `<span class="group-title">${g.title}</span> <span class="group-sum">${conventionsSummary(currentInputs)}</span>`;
      box.appendChild(sum);
      box.addEventListener('toggle', () => { conventionsOpen = box.open; });
    } else {
      box = document.createElement('div');
      box.className = `group group-${g.id}`;
      const h = document.createElement('h3');
      h.className = 'group-title';
      h.textContent = g.title;
      box.appendChild(h);
    }
    const body = document.createElement('div');
    body.className = 'group-body';
    for (const q of qs) body.appendChild(buildField(q));
    box.appendChild(body);
    formEl.appendChild(box);
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
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
      `<td>${fmtPct(c.doesNotHold)} <span class="incl">(incl. ${fmtPct(c.reversal)} reversal)</span></td>` +
      `<td>${fmtPct(c.inconclusive)}</td>${showBoth ? `<td>${fmtPct(c.smaller)}</td>` : ''}</tr>`;
  };
  return `<div class="table-wrap"><table class="verdicts">
    <thead><tr><th scope="col">If the true effect is</th><th scope="col">holds</th>` +
    `<th scope="col">does not hold</th><th scope="col">inconclusive</th>` +
    `${showBoth ? '<th scope="col">an effect, but smaller than Δ</th>' : ''}</tr></thead>
    <tbody>
      ${row('0', verdicts.zero)}
      ${row(`Δ/2 (${effectText(result.inputs.delta / 2, result)})`, verdicts.half)}
      ${row(`Δ (${effectText(result.inputs.delta, result)})`, verdicts.delta)}
    </tbody></table></div>`;
}

// The size the visitor entered, in their own terms.
function givenPhrase(result) {
  const inp = result.inputs;
  if (inp.givenSize != null && inp.givenBasis) {
    return inp.givenBasis === 'per-group'
      ? `${fmtNum(inp.givenSize, 0)} ${result.units.partName}`
      : `${fmtNum(inp.givenSize, 0)} in total`;
  }
  return `${result.given.totalUnits.toLocaleString('en-US')} units`;
}

// The interval a typical result would have if the true effect were
// exactly Δ, at the entered size and at the required size: the
// picture of why a small study reads as inconclusive. Drawn from the
// result's own z_a and standard errors; nothing new is computed.
function intervalRuler(result) {
  const { inputs, zA } = result;
  const sc = result.units.scale;
  const d = inputs.delta;
  const oneSided = inputs.sides === 'one';
  const rows = [];
  const planSize = currentPath === 'plan';
  if (result.given) rows.push({ name: `At ${givenPhrase(result)}`, se: result.given.se });
  rows.push({ name: `At the required ${result.required.roundedPerPart.toLocaleString('en-US')} ${result.units.partName}`, se: result.planned.se });
  for (const r of rows) {
    r.lo = d - zA * r.se;
    r.hi = oneSided ? Infinity : d + zA * r.se;
    r.clears = r.lo > 0;
  }
  const finiteHi = Math.max(d, ...rows.map((r) => (Number.isFinite(r.hi) ? r.hi : d + zA * r.se)));
  let min = Math.min(0, ...rows.map((r) => r.lo));
  let max = finiteHi;
  const pad = (max - min) * 0.08;
  min -= pad; max += pad;
  const avail = resultsEl.clientWidth || 460;
  const W = Math.round(Math.min(560, Math.max(300, avail))); const L = 8; const R = W - 8;
  const x = (v) => L + ((v - min) / (max - min)) * (R - L);
  const rowH = 46; const top = 22;
  const H = top + rows.length * rowH + 22;
  const parts = [];
  parts.push(`<line class="ruler-axis" x1="${L}" x2="${R}" y1="${H - 20}" y2="${H - 20}"/>`);
  parts.push(`<line class="ruler-zero" x1="${x(0)}" x2="${x(0)}" y1="${top - 12}" y2="${H - 16}"/>`);
  parts.push(`<line class="ruler-delta" x1="${x(d)}" x2="${x(d)}" y1="${top - 12}" y2="${H - 16}"/>`);
  parts.push(`<text class="ruler-tick" x="${x(0)}" y="${H - 4}" text-anchor="middle">0</text>`);
  parts.push(`<text class="ruler-tick ruler-tick-delta" x="${x(d)}" y="${H - 4}" text-anchor="middle">Δ = ${esc(effectText(d, result))}</text>`);
  rows.forEach((r, i) => {
    const y = top + i * rowH + 20;
    const cls = r.clears ? 'iv-clears' : 'iv-crosses';
    const x1 = x(r.lo);
    const x2 = Number.isFinite(r.hi) ? x(r.hi) : R;
    parts.push(`<rect class="ruler-name-bg" x="${L - 3}" y="${y - 25}" width="${Math.round(r.name.length * 7.2 + 6)}" height="18" rx="3"/>`);
    parts.push(`<text class="ruler-name" x="${L}" y="${y - 11}">${esc(r.name)}</text>`);
    parts.push(`<line class="iv ${cls}" x1="${x1}" x2="${x2}" y1="${y}" y2="${y}"/>`);
    parts.push(`<line class="iv-cap ${cls}" x1="${x1}" x2="${x1}" y1="${y - 6}" y2="${y + 6}"/>`);
    if (Number.isFinite(r.hi)) parts.push(`<line class="iv-cap ${cls}" x1="${x2}" x2="${x2}" y1="${y - 6}" y2="${y + 6}"/>`);
    parts.push(`<circle class="iv-dot ${cls}" cx="${x(d)}" cy="${y}" r="4"/>`);
  });
  const given = result.given ? rows[0] : null;
  const req = rows[rows.length - 1];
  let caption;
  const yours = planSize ? 'this plan\'s size' : 'your size';
  if (given && !given.clears) {
    caption = `If the true effect is exactly Δ, a typical result at ${yours} has an interval that still reaches past 0, so it reads as inconclusive. At the required size it clears 0 and reads as holds.`;
  } else if (given) {
    caption = `If the true effect is exactly Δ, a typical result at ${yours} has an interval that clears 0, so it reads as holds.`;
  } else {
    caption = req.clears
      ? 'If the true effect is exactly Δ, a typical result at the required size has an interval that clears 0, so it reads as holds.'
      : 'If the true effect is exactly Δ, a typical result at this size still reaches past 0.';
  }
  const label = rows.map((r) => `${r.name}: interval from ${fmtNum(sc * r.lo)} to ${Number.isFinite(r.hi) ? fmtNum(sc * r.hi) : 'no upper limit'} ${result.units.effectUnit}`).join('; ');
  return `<figure class="ruler"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">${parts.join('')}</svg>` +
    `<figcaption>${caption}</figcaption></figure>`;
}

// One figure: a label, a value, an info button, and its reason. The
// reason stays in the page, closed until asked for.
function figure(key, label, value, { visible = '' } = {}) {
  return `<div class="number" data-figure="${key}">
    <div class="number-head"><span class="number-label">${label}</span>` +
    `<button type="button" class="info" data-pop="hint-fig-${key}" aria-controls="whyn-pop" aria-expanded="false" aria-label="Why: ${esc(label)}">i</button></div>
    <p class="big">${value}</p>${visible ? `<p class="keep">${visible}</p>` : ''}
  </div>`;
}
function figureWhy(key, label, why, extra = '') {
  return `<div class="pop-src${extra ? ' pop-wide' : ''}" id="hint-fig-${key}" hidden><p class="why-label">${label}</p><p>${why}</p>${extra}</div>`;
}

function renderResults(result) {
  const focus = result.given ?? result.planned;
  const focusIsGiven = Boolean(result.given);
  const req = result.required;
  const partName = result.units.partName;
  const reqPer = `${req.roundedPerPart.toLocaleString('en-US')} ${partName}`;
  const reqTotal = `${req.roundedTotal.toLocaleString('en-US')} units`;
  const deltaText = effectText(result.inputs.delta, result);
  const parts = [];

  // The answer in one sentence.
  let head;
  let sub = '';
  let jump;
  if (result.given && currentPath === 'plan') {
    head = `You need ${reqPer}.`;
    sub = `${req.roundedTotal.toLocaleString('en-US')} in total, to find an effect of ${deltaText} with ${fmtPct(result.inputs.power, 0)} power. The figures below are for the ${result.given.totalUnits.toLocaleString('en-US')} units this plan uses.`;
    jump = `You need ${reqPer}`;
  } else if (result.given) {
    const short = result.given.totalUnits < req.total;
    head = short
      ? `Too small to find an effect of ${deltaText}.`
      : `Enough to find an effect of ${deltaText}.`;
    const echo = typeof scenario.sizeEcho === 'function' ? scenario.sizeEcho(result.inputs, { num: fmtNum }) : null;
    sub = `${echo ? `${echo} ` : ''}${short ? `It needs ${reqPer} (${req.roundedTotal.toLocaleString('en-US')} in total).` : `The formula needs ${reqPer} (${req.roundedTotal.toLocaleString('en-US')} in total).`}`;
    if (short) sub += ' Ask whoever gave you the number which Δ, base rate or SD, error rate and power they assumed.';
    jump = short ? `Too small: needs ${reqPer}` : `Enough: needs ${reqPer}`;
  } else {
    head = `You need ${reqPer}.`;
    sub = `${req.roundedTotal.toLocaleString('en-US')} in total, to find an effect of ${deltaText} with ${fmtPct(result.inputs.power, 0)} power.`;
    if (currentPath === 'check') sub += ' Enter the size you were given to check it against this.';
    jump = `You need ${reqPer}`;
  }
  parts.push(`<p class="headline">${head}</p>`);
  parts.push(`<p class="subhead">${sub}</p>`);
  parts.push(intervalRuler(result));

  // The four numbers, each with its reason one click away. Power's
  // cost stays in sight under the required size (Addendum 2).
  let why1 = `Unrounded: ${fmtNum(req.total)} units. ${COPY.rounding.text}`;
  if (result.given) {
    why1 += result.given.totalUnits < req.total
      ? ` Your entered size is ${(req.total - result.given.totalUnits).toLocaleString('en-US', { maximumFractionDigits: 0 })} units short of it.`
      : ' Your entered size covers it.';
  }
  if (result.floor) {
    why1 += ` Below ${Math.ceil(result.floor.perPart).toLocaleString('en-US')} units ${partName}, no number of runs per unit reaches the target: the spread of the effect between units sets a floor that only more units can lift.`;
  }
  if (result.runs && !result.runs.feasible) {
    why1 += ` With ${fmtNum(result.runs.basisPerPart, 0)} units ${partName}, no number of runs reaches the target; those units are below the floor.`;
  } else if (result.runs && result.runs.runsPerUnit > 1.05) {
    why1 += ` If more units are out of reach: with ${fmtNum(result.runs.basisPerPart, 0)} units ${partName}, the target takes about ${result.runs.runsPerPart.toLocaleString('en-US')} runs ${partName} and condition, roughly ${fmtNum(result.runs.runsPerUnit, 1)} runs per unit.`;
  }
  parts.push('<div class="numbers">');
  const whys = [];
  parts.push(figure('required', 'Required sample size',
    `${reqTotal} <span class="sub">(${reqPer})</span>`, { visible: powerCost(result) }));
  whys.push(figureWhy('required', 'Required sample size', why1));

  const mdeLabel = focusIsGiven ? `Smallest effect ${givenPhrase(result)} can find` : 'Smallest effect the required size can find';
  let why2 = `The smallest effect ${focusIsGiven ? `the size you entered (${result.given.totalUnits.toLocaleString('en-US')} units)` : 'the required size'} would find with ${fmtPct(result.inputs.power, 0)} power.`;
  if (focusIsGiven && focus.mde > result.inputs.delta) {
    why2 += ` That is larger than your Δ of ${deltaText}: this size can only find effects bigger than the ones you care about.`;
  }
  parts.push(figure('mde', mdeLabel, effectText(focus.mde, result)));
  whys.push(figureWhy('mde', mdeLabel, why2));

  const showBoth = ['zero', 'half', 'delta'].some((k) => focus.verdicts[k].both > 0.0005);
  const atDelta = exclusiveVerdicts(focus.verdicts.delta);
  const holdsLabel = focusIsGiven
    ? `Chance of “holds” at ${currentPath === 'plan' ? 'this plan\'s size' : 'your size'}, if the effect is Δ`
    : 'Chance of “holds” if the effect is Δ';
  const why4 = `“Holds” means the interval excludes 0 in the predicted direction; “does not hold” means it excludes effects of Δ or more; “inconclusive” means neither. The table gives the chance of each verdict at three true effects${focusIsGiven ? ' for the size you entered' : ''}.`;
  const tableExtra = verdictTable(focus.verdicts, result, showBoth) + (showBoth
    ? '<p>“holds” and “an effect, but smaller than Δ” together make up the power: power counts every interval that clears 0 in the predicted direction, on either side of Δ.</p>'
    : '');
  parts.push(figure('verdicts', holdsLabel, fmtPct(atDelta.holds)));
  whys.push(figureWhy('verdicts', holdsLabel, why4, tableExtra));

  const tailPct = fmtPct(focus.verdicts.zero.holds);
  const why3 = `Family error rate ${fmtPct(result.inputs.alpha, 0)} split across ${result.inputs.claims} claim(s) (Bonferroni), ${fmtPct(result.alphaPerClaim)} each; a false "holds" in the predicted direction is at most ${tailPct} per claim.`;
  parts.push(figure('interval', 'Interval level', `${fmtNum(100 * result.intervalLevel)}% <span class="sub">per claim</span>`));
  whys.push(figureWhy('interval', 'Interval level', why3));
  parts.push('</div>');
  parts.push(`<div class="whys" hidden>${whys.join('')}</div>`);

  // The values the page assumed, named as assumptions.
  if (typeof scenario.assumptionLine === 'function') {
    const items = scenario.assumptionLine(result.inputs, { pct: fmtPct });
    parts.push(`<p class="assumed">Assumed: ${items.join('; ')}.</p>`);
  }
  resultsEl.innerHTML = parts.join('');
  jumpEl.textContent = `${jump}. See the answer`;
}

// The answer panel sticks beside the form on wide screens. When it is
// taller than the window, it sticks by its bottom edge instead, so
// every part of it stays reachable.
const answerEl = $('.answer');
function placeAnswer() {
  if (!answerEl) return;
  const h = answerEl.offsetHeight;
  const room = window.innerHeight || 0;
  answerEl.style.top = h && room && h + 32 > room ? `${room - h - 16}px` : '';
}

function renderExampleChrome() {
  const example = EXAMPLES.find((e) => e.id === currentExampleId);
  const matches = example && JSON.stringify(normalized(currentInputs)) === JSON.stringify(normalized(example.inputs));
  if (example && matches) {
    storyEl.innerHTML = `<p class="why-label">${example.title}</p><p>${example.story}</p>`;
    $('#example-chip-name').textContent = `Example ${example.id.replace(/\D/g, '')}`;
    $('#example-chip').hidden = false;
    whyEl.innerHTML = example.whyLines
      .map(([head, text]) => `<p><strong>${head}.</strong> ${text.charAt(0).toUpperCase()}${text.slice(1)}</p>`).join('');
    whyEl.hidden = false;
  } else {
    $('#example-chip').hidden = true;
    whyEl.hidden = true;
  }
  whyDetails.hidden = whyEl.hidden;
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
  if (!ready()) return;
  if (popBtn && !document.contains(popBtn)) hidePop();
  const result = computePlan({ scenario: scenario.id, inputs: currentInputs });
  writeState(scenario, { inputs: currentInputs, path: currentPath, exampleId: currentExampleId });
  renderExampleChrome();
  // Keep the conventions summary in step with edits inside the group.
  const sum = formEl.querySelector('.group-conventions .group-sum');
  if (sum) sum.textContent = conventionsSummary(currentInputs);
  if (!result.ok) {
    resultsEl.innerHTML = '<p class="headline headline-waiting">Your sample size appears here once the details are filled in.</p>' +
      '<p class="note">Still needed:</p><ul class="problems">' + result.problems
        .map((p) => { const t = p.replace(/^[A-Za-z]+: /, ''); return `<li class="problem">${esc(t.charAt(0).toUpperCase() + t.slice(1))}</li>`; }).join('') + '</ul>';
    setActions(false);
    budgetEl.innerHTML = '';
    curveEl.innerHTML = '';
    guardrailsEl.innerHTML = '';
    justifyEl.textContent = '';
    jumpEl.textContent = 'Some questions still need an answer. See what is missing';
    return;
  }
  setActions(true);
  renderResults(result);
  if (popBtn && !document.contains(popBtn)) hidePop();
  placeAnswer();
  budgetExplorer(budgetEl, { inputs: currentInputs, result });
  verdictCurve(curveEl, { inputs: currentInputs, result });
  const n = result.guardrails.length;
  guardrailsEl.innerHTML = n
    ? `<details class="notes"><summary>${n === 1 ? 'A note on your inputs' : `${n} notes on your inputs`}</summary><ul>` +
      result.guardrails.map((g) => `<li>${g.text}</li>`).join('') + '</ul></details>'
    : '';
  justifyEl.textContent = result.justification;
}

function chosenExperiment() {
  return EXPERIMENTS.find((e) => e.outcome === currentInputs.outcome && e.assignment === currentInputs.assignment) ?? null;
}

function renderPicker() {
  const chosen = chosenExperiment();
  if (pickerEl.dataset.built) {
    pickerEl.querySelectorAll('input[name="experiment"]').forEach((r) => { r.checked = r.value === pending.exp; });
    return;
  }
  const rows = EXPERIMENTS.map((e) => `<div class="exp-row"><label class="exp">
      <input type="radio" name="experiment" value="${e.id}"${pending.exp === e.id ? ' checked' : ''}>
      <span class="exp-body"><span class="exp-title">${e.title}</span><span class="exp-tests">${e.tests}</span></span>
    </label><button type="button" class="info exp-info" data-pop="pop-exp-${e.id}" aria-controls="whyn-pop" aria-expanded="false" aria-label="An example: ${e.title}">i</button></div>` +
    `<div id="pop-exp-${e.id}" class="pop-src" hidden><p class="why-label">${e.title}</p><p>For example: ${e.example}</p><p>${e.pickIf}</p><p class="exp-tests">Known as: ${e.tests}.</p></div>`).join('');
  const later = LATER.map((e) => `<li><span class="exp-title">${e.title}</span> <span class="exp-tests">(${e.tests}).</span> ${TOOLS[e.tool]}.</li>`).join('');
  pickerEl.innerHTML = `<fieldset class="exp-list"><legend class="visually-hidden">What does your experiment compare?</legend>${rows}</fieldset>` +
    '<p class="later-line">Not in WhyN yet: ANOVA, correlation, larger chi-square tables, survival, clusters. ' +
    '<button type="button" class="info" data-pop="later-list" aria-controls="whyn-pop" aria-expanded="false" aria-label="Designs WhyN does not size yet">i</button></p>' +
    `<div id="later-list" class="pop-src pop-wide" hidden><p class="why-label">Not in WhyN yet</p><p>WhyN sizes the four designs above. Sizing one of these with them would give the wrong number, so use another tool for now:</p><ul>${later}</ul></div>`;
  pickerEl.dataset.built = '1';
}

// Steps 1 and 2 are held as pending choices until Continue (or Apply
// changes) is pressed, so nothing else on the page reacts while a
// person is still deciding.
const pending = { path: null, exp: null };
const applyBtn = $('#apply-choices');
const applyNote = $('#apply-note');
function syncPending() {
  pending.path = currentPath;
  pending.exp = chosenExperiment()?.id ?? null;
  document.querySelectorAll('input[name="path"]').forEach((r) => { r.checked = r.value === pending.path; });
}
function updateApply() {
  const complete = Boolean(pending.path && pending.exp);
  const applied = ready();
  const same = applied && pending.path === currentPath && pending.exp === chosenExperiment()?.id;
  applyBtn.textContent = applied ? 'Apply changes' : 'Continue';
  applyBtn.disabled = !complete || same;
  applyNote.textContent = applied && !same && complete
    ? 'Below still shows your earlier choice.'
    : (!complete && (pending.path || pending.exp) ? 'Answer both questions to continue.' : '');
}
function applyChoices() {
  if (!pending.path || !pending.exp) return;
  if (pending.path !== currentPath) {
    // The worked examples name an engine-level deltaSource. The
    // questions replace it — the check path asks the Δ-source
    // question itself — so a path switch drops it rather than
    // letting it answer that question silently (Addendum 2).
    delete currentInputs.deltaSource;
    if (pending.path === 'plan') {
      // The check-only questions belong to the check path; leaving
      // their answers in place would check a size the planning path
      // never asked about.
      for (const q of scenario.questions) {
        if (q.paths && !q.paths.includes('plan')) currentInputs[q.key] = q.default;
      }
    }
  }
  currentPath = pending.path;
  const e = EXPERIMENTS.find((x) => x.id === pending.exp);
  currentInputs.outcome = e.outcome;
  currentInputs.assignment = e.assignment;
  const claimQ = scenario.questions.find((q) => q.key === 'claim');
  if (!applies(claimQ, currentInputs)) currentInputs.claim = null;
  renderAll();
  const first = formEl.querySelector('input:not([type=radio]), input');
  first?.focus({ preventScroll: true });
  const top = $('#step-details').getBoundingClientRect?.().top ?? 0;
  if (top > (window.innerHeight || 0) - 120) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    $('#step-details').scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

function setActions(on) {
  $('#copy-justification').disabled = !on;
  $('#show-justification').disabled = !on;
}

function ready() {
  return Boolean(currentPath && chosenExperiment());
}

// Show only the steps that apply: the start is two questions, the
// details and the answer appear once both are answered.
function renderAll() {
  hidePop();
  renderPicker();
  const r = ready();
  $('#details-placeholder').hidden = r;
  formEl.hidden = !r;
  startOverBtn.disabled = !(currentPath || currentInputs.outcome || currentInputs.assignment || pending.path || pending.exp);
  if (r) {
    buildForm();
    render();
  } else {
    formEl.innerHTML = '';
    resultsEl.innerHTML = '<p class="headline headline-waiting">Your sample size will appear here.</p>' +
      '<p class="note">Answer steps 1 and 2, then the details. Every number comes with its reason, one click away.</p>';
    guardrailsEl.innerHTML = '';
    justifyEl.textContent = '';
    budgetEl.innerHTML = '';
    curveEl.innerHTML = '';
    setActions(false);
    renderExampleChrome();
    jumpEl.hidden = true;
    jumpEl.textContent = '';
  }
  updateApply();
  syncJump();
}

function startOver() {
  currentInputs = { ...scenario.defaults() };
  currentPath = null;
  currentExampleId = null;
  pending.path = null;
  pending.exp = null;
  document.querySelectorAll('input[name="path"]').forEach((r) => { r.checked = false; });
  history.replaceState(null, '', location.pathname);
  renderAll();
}

pickerEl.addEventListener('change', (event) => {
  if (event.target.name !== 'experiment') return;
  pending.exp = event.target.value;
  startOverBtn.disabled = false;
  updateApply();
});
applyBtn.addEventListener('click', applyChoices);
startOverBtn.addEventListener('click', startOver);

function loadExample(id) {
  const example = EXAMPLES.find((e) => e.id === id);
  if (!example) return;
  currentExampleId = id;
  currentPath = example.path;
  currentInputs = { ...scenario.defaults(), ...example.inputs };
  syncPending();
  renderAll();
  const menu = $('#example-menu');
  if (menu) menu.open = false;
}

const STRUCTURAL = new Set(['outcome', 'assignment', 'claim', 'subgroups', 'claims', 'baseRateChoice', 'sides']);
formEl.addEventListener('input', (event) => {
  if (event.target.type === 'radio') return;
  collectInputs();
  render();
});
formEl.addEventListener('change', (event) => {
  collectInputs();
  if (STRUCTURAL.has(event.target.name)) {
    // A claim chosen for a two-subgroup design means nothing once the
    // question stops applying; clear it, so it is asked afresh if the
    // subgroups come back.
    const claimQ = scenario.questions.find((q) => q.key === 'claim');
    if (!applies(claimQ, currentInputs)) currentInputs.claim = null;
    const focusName = event.target.name;
    const focusValue = event.target.value;
    buildForm();
    formEl.querySelector(`input[name="${focusName}"][value="${focusValue}"]`)?.focus();
  }
  render();
});

// Tooltips. One floating panel serves every info button: it opens
// over the page, below the button (above it when there is no room),
// and moves nothing. A mouse shows it on hover; a click or tap keeps
// it open; Esc, a click elsewhere, or the button again closes it.
const popEl = $('#whyn-pop');
let popBtn = null;
let popPinned = false;
let hoverTimer = null;
const canHover = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function placePop(btn) {
  const r = btn.getBoundingClientRect();
  const vw = document.documentElement.clientWidth || window.innerWidth || 1024;
  const vh = window.innerHeight || 800;
  const w = Math.min(popEl.classList.contains('pop-wide') ? 560 : 360, vw - 24);
  popEl.style.width = `${w}px`;
  const left = Math.max(12, Math.min(r.left - 12, vw - w - 12));
  const h = popEl.offsetHeight;
  const below = r.bottom + 8;
  const top = below + h > vh - 12 && r.top - h - 8 > 12 ? r.top - h - 8 : below;
  popEl.style.left = `${left + window.scrollX}px`;
  popEl.style.top = `${top + window.scrollY}px`;
}
function showPop(btn, pinned) {
  const src = document.getElementById(btn.dataset.pop);
  if (!src) return;
  if (popBtn && popBtn !== btn) popBtn.setAttribute('aria-expanded', 'false');
  popEl.innerHTML = src.innerHTML;
  popEl.classList.toggle('pop-wide', src.classList.contains('pop-wide'));
  popEl.hidden = false;
  placePop(btn);
  popBtn = btn;
  popPinned = pinned;
  btn.setAttribute('aria-expanded', 'true');
}
function hidePop() {
  clearTimeout(hoverTimer);
  if (!popEl || popEl.hidden) return;
  popEl.hidden = true;
  popEl.innerHTML = '';
  if (popBtn) popBtn.setAttribute('aria-expanded', 'false');
  popBtn = null;
  popPinned = false;
}
document.addEventListener('click', (event) => {
  const btn = event.target.closest('button.info[data-pop]');
  if (btn) {
    if (popBtn === btn && popPinned) hidePop();
    else showPop(btn, true);
    return;
  }
  if (!popEl.hidden && !popEl.contains(event.target)) hidePop();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && popBtn) {
    const btn = popBtn;
    hidePop();
    btn.focus();
  }
});
if (canHover) {
  document.addEventListener('mouseover', (event) => {
    const btn = event.target.closest?.('button.info[data-pop]');
    if (btn && !popPinned) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showPop(btn, false), 120);
    } else if (popEl.contains(event.target)) {
      clearTimeout(hoverTimer);
    }
  });
  document.addEventListener('mouseout', (event) => {
    const leaving = event.target.closest?.('button.info[data-pop]') || popEl.contains(event.target);
    const to = event.relatedTarget;
    if (!leaving || popPinned) return;
    if (to && (popEl.contains(to) || to.closest?.('button.info[data-pop]') === popBtn)) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { if (!popPinned) hidePop(); }, 150);
  });
}
window.addEventListener('resize', () => { if (popBtn) placePop(popBtn); });

document.querySelectorAll('input[name="path"]').forEach((r) => {
  r.addEventListener('change', () => {
    pending.path = r.value;
    startOverBtn.disabled = false;
    updateApply();
  });
});

$('#example-bar').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-example]');
  if (button) loadExample(button.dataset.example);
});

const copyBtn = $('#copy-justification');
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(justifyEl.textContent);
    copyBtn.textContent = 'Copied';
  } catch {
    $('#justify-details').open = true;
    const range = document.createRange();
    range.selectNodeContents(justifyEl);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyBtn.textContent = 'Selected: copy it now';
  }
  setTimeout(() => { copyBtn.textContent = 'Copy the justification'; }, 2000);
});

$('#show-justification').addEventListener('click', () => {
  const d = $('#justify-details');
  d.open = true;
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#observed-power').addEventListener('click', () => {
  const note = $('#observed-power-note');
  note.textContent = GUARDRAILS.observedPower;
  note.hidden = false;
});

let syncJump = () => {};
// On a phone the answer sits below the form; a small bar keeps the
// answer's first line in reach until the answer itself is on screen.
if (typeof window.IntersectionObserver === 'function' && window.matchMedia) {
  const narrow = window.matchMedia('(max-width: 59.99rem)');
  let answerVisible = false;
  const sync = () => { jumpEl.hidden = !narrow.matches || answerVisible || !ready() || !jumpEl.textContent; };
  new IntersectionObserver((entries) => {
    answerVisible = entries.some((e) => e.isIntersecting);
    sync();
  }).observe(resultsEl);
  narrow.addEventListener?.('change', sync);
  syncJump = sync;
  sync();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 150);
});

// Start: a shared link opens on its answer; otherwise the page asks
// two questions first (decision log #10).
const fromUrl = readState(scenario);
if (fromUrl) {
  currentInputs = { ...scenario.defaults(), ...fromUrl.inputs };
  currentPath = fromUrl.path;
  currentExampleId = fromUrl.exampleId;
  syncPending();
}
renderAll();
