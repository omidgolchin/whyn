// Page check: static checks that always run, plus a full boot of the
// page in jsdom when jsdom is available (CI installs it for this step;
// the acceptance tests themselves need no dependencies).
//
// Run: node scripts/page_check.mjs

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok' : 'FAIL'}: ${msg}`);
  if (!ok) failures++;
};

// --- Static checks ---------------------------------------------------
const html = readFileSync(join(root, 'index.html'), 'utf8');
check(!/<script[^>]+src="http/.test(html), 'no external scripts');
check(!/<link[^>]+href="http/.test(html), 'no external stylesheets');
check(!/<img[^>]+src="http/.test(html), 'no external images');

let totalBytes = 0;
const weigh = (rel) => { totalBytes += statSync(join(root, rel)).size; };
weigh('index.html');
weigh('styles.css');
const walk = (dir) => {
  for (const name of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (name.isDirectory()) walk(join(dir, name.name));
    else if (name.name.endsWith('.js')) weigh(join(dir, name.name));
  }
};
walk('src');
check(totalBytes < 200 * 1024, `page weight ${(totalBytes / 1024).toFixed(1)} KB is under 200 KB`);

for (const rel of ['src/ui/app.js', 'src/core/plan.js', 'src/scenarios/two-condition.js', 'reference/two_condition.py']) {
  check(statSync(join(root, rel)).size > 0, `${rel} exists`);
}

// --- Boot check (needs jsdom) ----------------------------------------
let JSDOM = null;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.log('skip: jsdom not installed, boot check not run (CI installs it)');
}
if (JSDOM) {
  const dom = new JSDOM(html, { url: 'http://localhost/whyn/' });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.location = window.location;
  globalThis.history = window.history;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  await import(join(root, 'src/ui/app.js'));
  const text = (sel) => window.document.querySelector(sel)?.textContent ?? '';
  const results = () => text('#results');

  // The start (decision log #10, steadied by #15): the frame is fixed
  // from the first visit. Steps 1-3 and the answer panel are all in
  // place; the panel says what will appear, step 3 holds a one-line
  // placeholder, and no numbers show until both questions are answered.
  const doc = window.document;
  const box = (sel) => { const e = doc.querySelector(sel); return e && !e.hidden && !e.closest('[hidden]'); };
  check(box('#answer') && text('#answer-h') === 'Your answer', 'start: the answer panel is in place and says what it is');
  check(results().includes('will appear here'), 'start: the panel says what will appear in it');
  check(box('#step-details') && box('#details-placeholder'), 'start: step 3 is in place, with a placeholder');
  check(doc.querySelectorAll('#experiment-picker input[name="experiment"]').length === 4, 'start: four experiments to pick from');
  check(text('#experiment-picker').includes('chi-square') && text('#experiment-picker').includes('t-test'), 'start: the picker names the tests people know');
  check(text('#experiment-picker').includes('ANOVA') && text('#experiment-picker').includes('correlation'), 'start: the designs not covered yet are named');
  check(!results().includes('units'), 'start: no numbers before the questions');
  check(doc.querySelector('#copy-justification').disabled && doc.querySelector('#start-over').disabled, 'start: buttons wait, greyed out, rather than appearing later');

  const pick = (name, value) => {
    const r = doc.querySelector(`input[name="${name}"][value="${value}"]`);
    r.checked = true;
    r.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  pick('path', 'plan');
  check(!results().includes('Still needed') && box('#details-placeholder') && doc.querySelector('#apply-choices').disabled, 'start: one answer is not enough');
  pick('experiment', 'mean-independent');
  check(box('#details-placeholder') && !doc.querySelector('#apply-choices').disabled, 'choosing does not change the page until Continue');
  doc.querySelector('#apply-choices').click();
  check(!box('#details-placeholder') && doc.querySelector('#q-delta'), 'Continue fills step 3 in place');
  check(results().includes('Still needed'), 'the answer panel names what is still needed');
  check(doc.querySelectorAll('#experiment-picker input[name="experiment"]').length === 4 &&
    doc.querySelector('input[name="experiment"][value="mean-independent"]').checked, 'the picker stays as it was, with the choice marked');
  check(!doc.querySelector('input[name="outcome"]'), 'the details do not ask again what step 2 answered');
  check(text('#apply-choices') === 'Apply changes' && doc.querySelector('#apply-choices').disabled, 'after Continue the button waits for a change');
  pick('experiment', 'rate-independent');
  check(doc.querySelector('#q-sd') && !doc.querySelector('input[name="baseRateChoice"]') && !doc.querySelector('#apply-choices').disabled,
    'a changed choice waits for Apply changes; the questions below stay as they were');
  pick('experiment', 'mean-independent');
  check(doc.querySelector('#apply-choices').disabled, 'changing back needs no apply');
  check(text('#pop-exp-rate-independent').includes('For example') && text('#pop-path-check').includes('For example'), 'every choice in steps 1 and 2 has an example behind its info button');

  // Explanations open in one floating tooltip and move nothing.
  const deltaInfo = doc.querySelector('button.info[data-pop="hint-delta"]');
  deltaInfo.click();
  const pop = doc.querySelector('#whyn-pop');
  check(!pop.hidden && pop.textContent.length > 20 && deltaInfo.getAttribute('aria-expanded') === 'true', 'an info button opens the tooltip');
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  check(pop.hidden && deltaInfo.getAttribute('aria-expanded') === 'false', 'Esc closes the tooltip');

  doc.querySelector('#start-over').click();
  check(!doc.querySelector('input[name="path"]:checked') && box('#details-placeholder') && results().includes('will appear here'), 'start over returns to the first visit');

  // Q14 (decision log #10 moved it behind the first example): the
  // plain check, an AI-given 300 students per group for a 4-point
  // pass-rate rise, keeps every number it had as the landing page.
  doc.querySelector('button[data-example="ex4"]').click();
  check(results().includes('4,906 units'), 'Q14: opens on the plain check: required total 4,906');
  check(results().includes('11.44 points'), 'Q14: MDE 11.44 points at the given size');
  check(results().includes('16.4%'), 'Q14: verdict chance 16.4% at delta');
  check(!window.document.querySelector('#example-chip').hidden && text('#example-story').includes('300 per group'), 'Q14: the example is named, with its story one click away');
  check(text('#justification-text').includes('600 units'), 'Q14: justification mentions the given 600 units');
  check(results().includes('Assumed:'), 'Q4: the assumption line is shown under the numbers');
  check(results().includes("base rate 50% (you didn't know it)"), 'Q4: an unknown base rate is named as an assumption');
  check(results().includes('20% of studies end without holds'), 'Q5: the cost of 80% power is stated in the results');
  check(text('#justification-text').includes('20% of studies end without holds'), 'Q8: the justification states the cost of power too');
  check(window.document.querySelector('#q-givenSize').value === '300', 'Q14: the opening example shows the 300 it was given');
  check(window.document.querySelector('input[name="givenBasis"][value="per-group"]').checked, 'Q14: the per-group basis is chosen');
  check(results().includes('You entered 300 per group (600 in total).'), 'Q14: the size echo appears');
  check(results().split('At the required size, if the true effect is exactly Δ').length - 1 === 1, 'Q10: the cost line appears once in the results');
  check((window.document.querySelector('#results .number')?.textContent ?? '').includes('At the required size'), 'Q10: the cost line sits under number 1, the required size');

  // Q13: the verdict categories are mutually exclusive — reversal
  // is a sub-line of "does not hold", the old note under the table
  // is gone, and every displayed row sums to 100%.
  const rowSumsOk = () => {
    const rows = window.document.querySelectorAll('#results table.verdicts tbody tr');
    if (!rows.length) return false;
    return [...rows].every((tr) => {
      const cells = [...tr.querySelectorAll('td')].map((td) => parseFloat(td.textContent));
      return Math.abs(cells.reduce((s, x) => s + x, 0) - 100) <= 0.1 + 1e-9;
    });
  };
  check(results().includes('(incl.'), 'Q13: reversal shows inside the does-not-hold cell');
  check(!results().includes('three readings'), 'Q13: the note under the verdict table is gone');
  check(rowSumsOk(), 'Q13: every displayed verdict row sums to 100% on the plain check');

  // Example 3, behind its button now (Addendum 3): its numbers and
  // the Addendum 2 landing assertions hold there.
  window.document.querySelector('button[data-example="ex3"]').click();
  check(results().includes('2,054 units'), 'example 3: required total 2,054');
  check(results().includes('8.01 points'), 'example 3: MDE 8.01 points at the given size');
  check(results().includes('37.6%'), 'example 3: verdict chance 37.6%');
  check(text('#justification-text').includes('800 units'), 'example 3: justification mentions the given 800 units');
  check(window.document.querySelector('#q-givenSize').value === '400', 'Q11: example 3 shows the 400 it was given');
  check(window.document.querySelector('input[name="givenBasis"][value="per-group"]').checked, 'Q11: the per-group basis is chosen');
  check(results().includes('You entered 400 per subgroup (800 in total).'), 'Q11: the size echo appears, in the design\u2019s own word for its parts');
  check(results().split('At the required size, if the true effect is exactly Δ').length - 1 === 1, 'Q10: the cost line appears once in the results (example 3)');
  check(results().includes('at most 1.2%'), 'Addendum 2: number 3 states the false-holds figure the verdict table shows');
  check(rowSumsOk(), 'Q13: every displayed verdict row sums to 100% on example 3');

  // Back to a blank check path for the Q1 steps: switching to plan
  // and back resets the check-only questions (and drops the
  // example's engine-level deltaSource, which the questions replace).
  const pathRadio = (v) => window.document.querySelector(`input[name="path"][value="${v}"]`);
  pathRadio('plan').checked = true;
  pathRadio('plan').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.querySelector('#apply-choices').click();
  pathRadio('check').checked = true;
  pathRadio('check').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.querySelector('#apply-choices').click();

  const sizeInput = window.document.querySelector('#q-givenSize');
  sizeInput.value = '300';
  sizeInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(results().includes('per group or in total'), 'Q1: a size with no basis chosen computes nothing');
  const basisRadio = window.document.querySelector('input[name="givenBasis"][value="total"]');
  basisRadio.checked = true;
  basisRadio.dispatchEvent(new window.Event('change', { bubbles: true }));
  check(results().includes('You entered 300 in total'), 'Q1: choosing the basis runs the check and echoes the size as entered');
  check(text('#guardrails').includes('only as independent as its inputs'), 'Q12: an unanswered Δ-source fires the independence guardrail');
  check(results().includes('Δ source: not stated, treated as not sure'), 'Q12: the assumption line names the unanswered Δ-source');
  check(window.location.search.includes('s=two-condition'), 'URL state is written');
  check(window.document.querySelector('#budget').getElementsByTagName('svg').length >= 1, 'budget bar drawn');
  check(window.document.querySelector('#curve').getElementsByTagName('path').length >= 3, 'verdict curve drawn');

  window.document.querySelector('button[data-example="ex1"]').click();
  check(results().includes('4.99 points'), 'example 1: MDE 4.99 at the planned size');
  window.document.querySelector('button[data-example="ex2"]').click();
  check(results().includes('9.97 points'), 'example 2: MDE 9.97 at the planned size');
  check(text('#guardrails').includes('4× the units'), 'example 2: interaction guardrail fires');

  const deltaInput = window.document.querySelector('#q-delta');
  deltaInput.value = '20';
  deltaInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(results().includes('514 units'), 'editing delta recomputes (514 units at delta 20)');

  deltaInput.value = '';
  deltaInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(results().includes('must be entered'), 'a missing delta is reported plainly');

  window.document.querySelector('#observed-power').click();
  check(text('#observed-power-note').includes('adds nothing beyond the p-value'), 'observed power is refused with its reason');
}

if (failures) {
  console.error(`${failures} page check(s) failed`);
  process.exit(1);
}
console.log('page check passed');
