// Shareable state in the URL query string: the scenario id, its schema
// version, the entry path, and the scenario's own inputs — nothing in
// the scheme assumes any particular set of questions, so a future
// scenario brings its own keys. Only values that differ from the
// defaults are written, which keeps links short.

const NUMBER_KEYS = new Set([
  'delta', 'baseRate', 'sd', 'sigma', 'claims', 'alpha', 'power',
  'givenUnits', 'givenSize', 'runsPerUnit',
]);

export function readState(scenario) {
  const params = new URLSearchParams(location.search);
  if (params.get('s') !== scenario.id) return null;
  const inputs = {};
  for (const q of scenario.questions) {
    const raw = params.get(q.key);
    if (raw == null || raw === '') continue;
    inputs[q.key] = NUMBER_KEYS.has(q.key) ? Number(raw) : raw;
  }
  return {
    inputs,
    path: params.get('path') === 'plan' ? 'plan' : 'check',
    exampleId: params.get('ex'),
  };
}

export function writeState(scenario, { inputs, path, exampleId }) {
  const params = new URLSearchParams();
  params.set('s', scenario.id);
  params.set('v', String(scenario.version));
  params.set('path', path);
  const defaults = scenario.defaults();
  for (const q of scenario.questions) {
    const value = inputs[q.key];
    if (value == null || value === defaults[q.key]) continue;
    params.set(q.key, String(value));
  }
  if (exampleId) params.set('ex', exampleId);
  const url = `${location.pathname}?${params.toString()}`;
  history.replaceState(null, '', url);
}
