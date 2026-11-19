// The two pictures: the error-budget bar and the verdict curve.
// Hand-written SVG, no library. Line styles differ as well as colours,
// so the curves stay readable without colour.

import { invNorm, normCdf } from '../core/normal.js';
import { verdictChances, powerAt } from '../core/budget.js';
import * as scenario from '../scenarios/two-condition.js';

const LEVELS = [0.90, 0.95, 0.975, 0.99, 0.995];

function el(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function fmtPct(x, digits = 1) {
  return `${(100 * x).toFixed(digits)}%`;
}

// ---------------------------------------------------------------------
// The error-budget bar. The bar's length is delta / SE at the size in
// focus; it is split into the false-alarm part (z_a) and the miss part
// (z_b). Two sliders explore the trade-off: in "keep the size" mode
// they move along the split at the current size; in "keep the rates"
// mode they show the size those rates would need. Exploring never
// changes the plan's own answers (DECISIONS.md, decision 4).
// ---------------------------------------------------------------------
export function budgetExplorer(container, ctx) {
  const { inputs, result } = ctx;
  const focus = result.given ?? result.planned;
  const se = focus.se;
  const ratio = inputs.delta / se;

  container.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'The error budget';
  container.appendChild(title);
  const intro = document.createElement('p');
  intro.innerHTML = `Every number above comes from one equation: <strong>Δ/SE = z<sub>a</sub> + z<sub>b</sub></strong>. ` +
    `At ${focus.totalUnits.toLocaleString('en-US')} units, Δ spans <strong>${ratio.toFixed(2)} standard errors</strong>. ` +
    'The bar splits that budget: the first part buys protection against false alarms, the second against misses.';
  container.appendChild(intro);

  const svg = el('svg', { viewBox: '0 0 660 108', class: 'budget-bar', role: 'img' });
  svg.setAttribute('aria-label', 'Bar showing how the error budget is split between false alarms and misses');
  container.appendChild(svg);

  const controls = document.createElement('div');
  controls.className = 'budget-controls';
  controls.innerHTML = `
    <fieldset class="mode-toggle">
      <legend>Moving the sliders</legend>
      <label><input type="radio" name="budget-mode" value="size" checked> keep the size, watch the trade-off</label>
      <label><input type="radio" name="budget-mode" value="rates"> keep the error rates, watch the size</label>
    </fieldset>
    <label class="slider-row">Interval level
      <input type="range" id="bb-level" min="0" max="${LEVELS.length - 1}" step="1" value="${nearestLevel(result.intervalLevel)}">
      <output id="bb-level-out"></output>
    </label>
    <label class="slider-row">Power
      <input type="range" id="bb-power" min="50" max="99" step="1" value="${Math.round(100 * inputs.power)}">
      <output id="bb-power-out"></output>
    </label>
    <p class="budget-readout" id="bb-readout" aria-live="polite"></p>`;
  container.appendChild(controls);

  const levelSlider = controls.querySelector('#bb-level');
  const powerSlider = controls.querySelector('#bb-power');
  const levelOut = controls.querySelector('#bb-level-out');
  const powerOut = controls.querySelector('#bb-power-out');
  const readout = controls.querySelector('#bb-readout');
  const mode = () => controls.querySelector('input[name="budget-mode"]:checked').value;

  // Per-claim z_a for an interval level, honouring the plan's sidedness.
  const zAForLevel = (level) => inputs.sides === 'one' ? invNorm(level) : invNorm((1 + level) / 2);
  const levelForZA = (zA) => inputs.sides === 'one' ? normCdf(zA) : 2 * normCdf(zA) - 1;

  function draw(zA, zB) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W = 660;
    const x0 = 8;
    const x1 = W - 8;
    const y = 18;
    const h = 34;
    const total = Math.max(zA + zB, ratio);
    const unit = (x1 - x0) / (total * 1.02);
    const wA = zA * unit;
    const wB = zB * unit;
    svg.appendChild(el('rect', { x: x0, y, width: wA, height: h, class: 'bar-false' }));
    svg.appendChild(el('rect', { x: x0 + wA, y, width: wB, height: h, class: 'bar-miss' }));
    if (ratio > zA + zB + 1e-9) {
      svg.appendChild(el('rect', { x: x0 + (zA + zB) * unit, y, width: (ratio - zA - zB) * unit, height: h, class: 'bar-spare' }));
    }
    // The marker shows where the budget at the current size ends.
    const mx = x0 + ratio * unit;
    svg.appendChild(el('line', { x1: mx, y1: y - 6, x2: mx, y2: y + h + 6, class: 'bar-marker' }));
    svg.appendChild(el('text', { x: Math.min(mx + 4, W - 150), y: y - 10, class: 'bar-cap' },
      `your size buys ${ratio.toFixed(2)} SE`));
    svg.appendChild(el('text', { x: x0 + 2, y: y + h + 18, class: 'bar-label' },
      `false alarms: z_a = ${zA.toFixed(2)}`));
    svg.appendChild(el('text', { x: x0 + wA + 2, y: y + h + 18, class: 'bar-label' },
      `misses: z_b = ${zB.toFixed(2)}`));
    if (ratio > zA + zB + 1e-9) {
      svg.appendChild(el('text', { x: x0 + (zA + zB) * unit + 2, y: y + h + 18, class: 'bar-label' }, 'to spare'));
    }
    if (zA + zB > ratio + 1e-9) {
      svg.appendChild(el('text', { x: x0 + 2, y: y + h + 36, class: 'bar-warn' },
        `short by ${(zA + zB - ratio).toFixed(2)} standard errors at this size`));
    }
  }

  function update(fromSlider) {
    let level;
    let power;
    if (mode() === 'size') {
      if (fromSlider === 'power') {
        const zB = invNorm(Number(powerSlider.value) / 100);
        const zA = Math.max(0.05, ratio - zB);
        level = levelForZA(zA);
        power = Number(powerSlider.value) / 100;
        draw(zA, zB);
      } else {
        level = LEVELS[Number(levelSlider.value)];
        const zA = zAForLevel(level);
        power = powerAt(inputs.delta, se, zA);
        draw(zA, invNorm(Math.min(0.999, Math.max(0.001, power))));
        powerSlider.value = String(Math.round(100 * power));
      }
      const falseHolds = inputs.sides === 'one' ? 1 - level : (1 - level) / 2;
      readout.textContent =
        `At ${focus.totalUnits.toLocaleString('en-US')} units: a ${fmtPct(level)} interval gives power ${fmtPct(power)} — ` +
        `false "holds" ${fmtPct(falseHolds)} in the predicted direction, misses ${fmtPct(1 - power)}.`;
    } else {
      level = LEVELS[Number(levelSlider.value)];
      power = Number(powerSlider.value) / 100;
      const zA = zAForLevel(level);
      const zB = invNorm(power);
      draw(zA, zB);
      const n = scenario.nForSE(inputs.delta / (zA + zB), inputs);
      const perPart = Math.ceil(n / result.units.parts);
      readout.textContent =
        `At a ${fmtPct(level)} interval and ${fmtPct(power, 0)} power, the formula needs ` +
        `${perPart.toLocaleString('en-US')} units ${result.units.partName} (${(perPart * result.units.parts).toLocaleString('en-US')} in total).`;
    }
    levelOut.textContent = fmtPct(level);
    powerOut.textContent = fmtPct(power, 0);
  }

  function nearestLevel(level) {
    let best = 0;
    LEVELS.forEach((l, i) => { if (Math.abs(l - level) < Math.abs(LEVELS[best] - level)) best = i; });
    return best;
  }

  levelSlider.addEventListener('input', () => update('level'));
  powerSlider.addEventListener('input', () => update('power'));
  controls.querySelectorAll('input[name="budget-mode"]').forEach((r) =>
    r.addEventListener('change', () => update('level')));
  update('level');
}

// ---------------------------------------------------------------------
// The verdict curve: the chance of each verdict as the true effect
// runs from -0.5 delta to 1.5 delta, at the size in focus.
// ---------------------------------------------------------------------
export function verdictCurve(container, ctx) {
  const { inputs, result } = ctx;
  const focus = result.given ?? result.planned;
  const se = focus.se;
  const zA = result.zA;
  const delta = inputs.delta;
  const scale = result.units.scale;
  const unitWord = result.units.effectUnit;

  container.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'The verdict curve';
  container.appendChild(title);
  const intro = document.createElement('p');
  intro.textContent = `How a study of ${focus.totalUnits.toLocaleString('en-US')} units would read, for each true effect. ` +
    'The table under the four numbers gives the same chances at 0, Δ/2 and Δ.';
  container.appendChild(intro);

  const W = 660;
  const H = 250;
  const padL = 44;
  const padR = 10;
  const padT = 12;
  const padB = 34;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'verdict-curve', role: 'img' });
  svg.setAttribute('aria-label', 'Curves showing the chance of each verdict across true effects');
  const x = (e) => padL + ((e / delta + 0.5) / 2) * (W - padL - padR);
  const y = (p) => padT + (1 - p) * (H - padT - padB);

  for (const gy of [0, 0.5, 1]) {
    svg.appendChild(el('line', { x1: padL, y1: y(gy), x2: W - padR, y2: y(gy), class: 'grid' }));
    svg.appendChild(el('text', { x: padL - 6, y: y(gy) + 4, class: 'axis', 'text-anchor': 'end' }, `${Math.round(100 * gy)}%`));
  }
  const series = [
    ['holds', 'holds', 's-holds'],
    ['doesNotHold', 'does not hold', 's-not'],
    ['inconclusive', 'inconclusive', 's-inc'],
  ];
  let bothSeen = false;
  const points = { holds: [], doesNotHold: [], inconclusive: [], both: [] };
  for (let i = 0; i <= 80; i++) {
    const e = (-0.5 + (2 * i) / 80) * delta;
    const v = verdictChances({ effect: e, se, delta, zA });
    points.holds.push([e, v.holds]);
    points.doesNotHold.push([e, v.doesNotHold]);
    points.inconclusive.push([e, v.inconclusive]);
    if (v.both > 0.0005) { bothSeen = true; points.both.push([e, v.both]); }
  }
  const line = (pts) => pts.map(([e, p], i) => `${i === 0 ? 'M' : 'L'}${x(e).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  for (const [key, , cls] of series) {
    svg.appendChild(el('path', { d: line(points[key]), class: `curve ${cls}` }));
  }
  if (bothSeen) {
    svg.appendChild(el('path', { d: line(points.both), class: 'curve s-both' }));
    series.push(['both', 'an effect, but smaller than Δ', 's-both']);
  }
  // The three key points, marked on every curve.
  for (const e of [0, delta / 2, delta]) {
    const v = verdictChances({ effect: e, se, delta, zA });
    for (const [key, , cls] of series) {
      svg.appendChild(el('circle', { cx: x(e), cy: y(v[key]), r: 3.2, class: `dot ${cls}` }));
    }
    svg.appendChild(el('text', { x: x(e), y: H - 18, class: 'axis', 'text-anchor': 'middle' },
      e === 0 ? '0' : e === delta / 2 ? `Δ/2 (${(scale * e).toFixed(scale === 100 ? 1 : 2)} ${unitWord})` : `Δ (${(scale * e).toFixed(scale === 100 ? 1 : 2)} ${unitWord})`));
  }
  svg.appendChild(el('text', { x: x(-0.5 * delta), y: H - 18, class: 'axis', 'text-anchor': 'middle' }, `${(scale * -0.5 * delta).toFixed(0)}`));
  svg.appendChild(el('text', { x: x(1.5 * delta), y: H - 18, class: 'axis', 'text-anchor': 'middle' }, `${(scale * 1.5 * delta).toFixed(0)}`));
  svg.appendChild(el('text', { x: (padL + W - padR) / 2, y: H - 2, class: 'axis', 'text-anchor': 'middle' },
    `true effect (${unitWord})`));
  container.appendChild(svg);

  const legend = document.createElement('p');
  legend.className = 'curve-legend';
  legend.innerHTML = series.map(([key, label, cls]) =>
    `<span class="legend-item"><svg width="26" height="8" aria-hidden="true"><line x1="1" y1="4" x2="25" y2="4" class="curve ${cls}"/></svg> ${label}</span>`).join(' ');
  container.appendChild(legend);
}
