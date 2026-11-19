// The standard normal distribution: density, cumulative probability and
// inverse cumulative probability. No dependencies, no randomness.
//
// normCdf uses the power series for |x| <= 3.5 and a continued fraction
// for the tail beyond that; both reach full double precision.
// invNorm starts from Acklam's rational approximation and refines it
// with two Halley steps, which lands within 1e-12 of the true value
// across the range this tool uses (checked in tests/core.test.js).

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const SQRT_2 = Math.sqrt(2);

export function normPdf(x) {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

// Phi(x) for x >= 0, from the series
//   Phi(x) = 1/2 + phi(x) * (x + x^3/3 + x^5/(3*5) + x^7/(3*5*7) + ...)
// which converges quickly for |x| <= 3.5.
function cdfSeries(x) {
  let term = x;
  let sum = x;
  for (let k = 1; k < 200; k++) {
    term *= (x * x) / (2 * k + 1);
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return 0.5 + normPdf(x) * sum;
}

// Upper tail Q(x) = 1 - Phi(x) for x > 3.5, from Laplace's continued
// fraction for the Mills ratio, evaluated with the modified Lentz method:
//   Q(x) = phi(x) / (x + 1/(x + 2/(x + 3/(x + ...))))
function tailFraction(x) {
  const tiny = 1e-300;
  let f = x;
  let c = x;
  let d = 0;
  for (let n = 1; n < 200; n++) {
    d = x + n * d;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    c = x + n / c;
    if (Math.abs(c) < tiny) c = tiny;
    const step = c * d;
    f *= step;
    if (Math.abs(step - 1) < 1e-16) break;
  }
  return normPdf(x) / f;
}

export function normCdf(x) {
  if (x >= 0) {
    return x <= 3.5 ? cdfSeries(x) : 1 - tailFraction(x);
  }
  return x >= -3.5 ? 1 - cdfSeries(-x) : tailFraction(-x);
}

export function invNorm(p) {
  if (!(p > 0 && p < 1)) {
    throw new RangeError(`invNorm: p must lie between 0 and 1, got ${p}`);
  }
  // Acklam's approximation (max relative error about 1.15e-9 before refining).
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285984469534e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let x;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
         ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Two Halley steps against normCdf bring the error to rounding level.
  for (let i = 0; i < 2; i++) {
    const err = normCdf(x) - p;
    const u = (err * SQRT_2PI) * Math.exp(0.5 * x * x);
    x -= u / (1 + 0.5 * x * u);
  }
  return x;
}
