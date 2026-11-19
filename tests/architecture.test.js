// Architecture tests: the separation the growth rules depend on.
// The shared core must stay free of any one design's vocabulary, so a
// second scenario can be added as a new module with no core edits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// Design-specific terms (error rates are core vocabulary, not a design).
const designWords = /\b(paired|subgroups?|cells?|sigma|base rate|arms?)\b/i;

test('core modules contain no design vocabulary', () => {
  for (const file of ['src/core/normal.js', 'src/core/budget.js', 'src/core/multiplicity.js']) {
    assert.ok(!designWords.test(read(file)), `${file} mentions a design term`);
  }
});

test('plan.js assembles without design prose of its own', () => {
  const plan = read('src/core/plan.js');
  assert.ok(!/paired|subgroup|per group|per cell/i.test(plan), 'plan.js carries design wording');
});

test('core and scenario modules touch no DOM, network or randomness', () => {
  const files = [
    'src/core/normal.js', 'src/core/budget.js', 'src/core/multiplicity.js',
    'src/core/plan.js', 'src/scenarios/two-condition.js',
  ];
  for (const file of files) {
    const src = read(file);
    assert.ok(!/document|window|fetch\(|Math\.random/.test(src), `${file} reaches outside pure computation`);
  }
});
