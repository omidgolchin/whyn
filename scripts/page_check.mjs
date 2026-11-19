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

  check(results().includes('2,054 units'), 'opens on example 3: required total 2,054');
  check(results().includes('8.01 points'), 'example 3: MDE 8.01 points at the given size');
  check(results().includes('37.6%'), 'example 3: verdict chance 37.6%');
  check(!window.document.querySelector('#example-story').hidden, 'example 3: story visible');
  check(text('#justification-text').includes('800 units'), 'justification mentions the given 800 units');
  check(results().includes('Assumed:'), 'Q4: the assumption line is shown under the numbers');
  check(results().includes("base rate 50% (you didn't know it)"), 'Q4: an unknown base rate is named as an assumption');
  check(results().includes('20% of studies end without holds'), 'Q5: the cost of 80% power is stated in the results');
  check(text('#justification-text').includes('20% of studies end without holds'), 'Q8: the justification states the cost of power too');

  const sizeInput = window.document.querySelector('#q-givenSize');
  sizeInput.value = '300';
  sizeInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(results().includes('per group or in total'), 'Q1: a size with no basis chosen computes nothing');
  const basisRadio = window.document.querySelector('input[name="givenBasis"][value="total"]');
  basisRadio.checked = true;
  basisRadio.dispatchEvent(new window.Event('change', { bubbles: true }));
  check(results().includes('You entered 300 in total'), 'Q1: choosing the basis runs the check and echoes the size as entered');
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
