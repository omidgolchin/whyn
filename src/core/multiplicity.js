// How the family error rate alpha is shared across confirmatory claims.
//
// v1's rule is Bonferroni: each of the m claims gets alpha / m. The rule
// lives in this one small module so a future scenario can bring a
// different sharing rule without anything else changing: the rest of the
// engine only ever asks for the alpha of one claim.

export function alphaPerClaim({ alpha, claims, sides }) {
  if (!(alpha > 0 && alpha < 1)) {
    throw new RangeError(`alphaPerClaim: alpha must lie between 0 and 1, got ${alpha}`);
  }
  if (!Number.isInteger(claims) || claims < 1) {
    throw new RangeError(`alphaPerClaim: claims must be a whole number >= 1, got ${claims}`);
  }
  const perClaim = alpha / claims;
  // The z that guards one claim: two-sided splits the claim's alpha
  // across both tails, one-sided puts it all in one tail.
  const tail = sides === 'one' ? perClaim : perClaim / 2;
  return { perClaim, tail };
}
