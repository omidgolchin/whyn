// The worked examples, as input sets plus the story and the
// why-lines the page shows with them. The page opens on the plain
// check (decision log #8): the rehearsal's case of an AI-given size,
// in the plainest design the tool covers. The other three are the
// spec's (sections 8-10): a language-learning app compares two hint
// styles on practice exercises, each tried once with each style.

const base = {
  outcome: 'rate', assignment: 'paired', claim: 'main', delta: 0.05,
  deltaSource: 'substance', baseRateChoice: 'unknown', baseRate: null,
  sd: null, sigma: 0.2, claims: 2, claimsRule: 'one',
  alpha: 0.05, sides: 'two', power: 0.8,
  runsPerUnit: 1, subgroups: 'yes',
};

export const EXAMPLES = [
  {
    id: 'ex4',
    button: 'Check a plain case',
    title: 'Example 4 — a plain check (300 students per group)',
    path: 'check',
    story: 'A team is planning a course study. They asked an AI assistant how many students to enroll to detect a 4-point rise in the course\u2019s pass rate, and it told them 300 per group. They check that number here, before enrolling anyone.',
    inputs: {
      outcome: 'rate', assignment: 'independent', claim: 'main', delta: 0.04,
      deltaSource: 'substance', deltaSameAdvice: 'no',
      baseRateChoice: 'unknown', baseRate: null, sd: null, sigma: null,
      claims: 1, claimsRule: null,
      alpha: 0.05, sides: 'two', power: 0.8,
      givenSize: 300, givenBasis: 'per-group',
      runsPerUnit: 1, subgroups: 'no',
    },
    whyLines: [
      ['What 300 per group buys', 'It reliably finds rises of 11.4 points or more. A 4-point rise, the smallest the team cares about, would be found only 16% of the time; the rest ends inconclusive or worse.'],
      ['What a 4-point gain needs', '2,453 students per group, 4,906 in all — about eight times the advice. At 300 per group the interval is simply wider than the gain being looked for, so the gap is not a rounding choice.'],
      ['Why an unknown pass rate costs', 'With the pass rate unknown, the plan assumes 50%, where a yes/no outcome varies most. If the real rate were far from half, the same 4-point gain would need fewer students; not knowing means paying for the worst case.'],
      ["Power's cost", 'Even at the full 2,453 per group, a real 4-point rise is missed one time in five: that is the 80% power the plan targets. Asking for 90% would halve the miss rate and cost about a third more students.'],
    ],
  },
  {
    id: 'ex3',
    button: 'Check a number you were given',
    title: 'Example 3 — checking a number you were given',
    path: 'check',
    story: 'Before using WhyN, the team asked an AI assistant how many exercises to test, and it recommended 400 per subgroup (800 in all). They enter that number first, then the same design and settings as example 1.',
    inputs: { ...base, givenSize: 400, givenBasis: 'per-group', deltaSameAdvice: 'no' },
    whyLines: [
      ['What your number buys', '400 per subgroup reliably finds gains of 8 points or more. A 5-point gain, the smallest the team cares about, would be found only 38% of the time.'],
      ['Why inconclusive dominates', 'at this size the interval is wider than the gap between 0 and Δ, so most results cannot tell a 5-point gain from none.'],
      ['What would make 400 right', 'a Δ of 8 points. If the team would act only on gains that large, the number is fine; the tool says so rather than calling the number wrong.'],
      ['Why the two answers differ', "the formula used Δ = 5, σ = 0.20 and two claims. Compare those inputs with the assistant's before deciding which number to use."],
    ],
  },
  {
    id: 'ex1',
    button: 'Plan a main effect',
    title: 'Example 1 — a main effect (5 points)',
    path: 'plan',
    story: 'A language-learning app compares two hint styles, A and B, on practice exercises. Each exercise is tried once with each style, so it gives one paired difference. The outcome is whether the learner solves the exercise on the first try. Exercises come in two equal groups: vocabulary and grammar. The claim: style B raises the first-try success rate, averaged over both groups. The plan uses 1,032 exercises per group so its balanced cells fill equally — enter that as the size to see the planned numbers.',
    inputs: { ...base, givenUnits: 2064 },
    whyLines: [
      ['Why 97.5%, not 95%', 'two claims share the 5% error rate. With 95% intervals for each, a false "holds" could happen on either claim, up to 5% in all; 97.5% keeps it at 2.5%. The split costs 21% more exercises (1,027 against 848 per group).'],
      ['Why not 90% or 99%', 'at this size, 90% doubles the false-alarm rate to 5%. 99% cuts power to 70%, or needs 23% more exercises to keep 80%.'],
      ['Symmetry worth showing', 'at the planned size, the chance of "holds" when the effect is Δ equals the chance of "does not hold" when it is 0 (both 80.2%). Sizing for the three-way rule buys both at once.'],
      ['Why one try per exercise', 'if the effect varies across exercises (σ = 0.20), giving the same exercise to more learners cannot average that away. With only 150 exercises per group, 80% power would take 1,928 tries per group and style (7,711 in all) instead of 4,128. Below 76 exercises per group, no number of tries is enough.'],
      ['Why assume 50%', 'it is the worst case. If a later trial put the rate under the first style at 13.5% (18.5% under the other), the same size would give 96.8% power instead of 80.2%, and the false "holds" rate would stay at 1.25%.'],
    ],
  },
  {
    id: 'ex2',
    button: 'Plan an interaction',
    title: 'Example 2 — an interaction (10 points)',
    path: 'plan',
    story: 'The same exercises and settings as example 1. The claim: style B helps grammar exercises more than vocabulary exercises — the gain on grammar minus the gain on vocabulary. This is the example that teaches why interactions are expensive.',
    inputs: { ...base, claim: 'interaction', delta: 0.10, givenUnits: 2064 },
    whyLines: [
      ['Why the same size', 'a difference between two effects has four times the variance of their average (two independent halves, each with half the units). Doubling Δ offsets it exactly, since sample size scales with 1/Δ².'],
      ['What 10 points means', "if claim 1's whole 5-point average came from grammar (0 points on vocabulary, 10 on grammar), the difference would be 10."],
      ['What a coarser threshold costs', '15 points would be cheaper, but a real 10-point difference would then count as not worth detecting.'],
    ],
  },
];
