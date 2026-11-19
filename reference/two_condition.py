"""Reference numbers for WhyN's worked examples and acceptance tests.

Fictional scenario used throughout: a language-learning app compares two hint
styles (A and B) on practice exercises. Each exercise is tried once with each
style, so it gives one paired difference. Outcome: solved on the first try
(yes/no). Exercises come in two equal groups, vocabulary and grammar.

Normal approximation throughout. Standard library only.
Run: python3 reference_numbers.py
"""
from math import sqrt
from statistics import NormalDist

Z = NormalDist()
z = Z.inv_cdf
Phi = Z.cdf


def k_value(conf_two_sided, power):
    """z(1 - alpha/2) + z(power): the effect must be this many standard errors."""
    alpha = 1 - conf_two_sided
    return z(1 - alpha / 2) + z(power)


def per_unit_variance(p0, p1, sigma):
    """Variance of one unit's paired difference y1 - y0 (yes/no outcomes),
    plus the spread of the true effect across units (sigma = its SD)."""
    return p0 * (1 - p0) + p1 * (1 - p1) + sigma ** 2


def outcome_probs(true_effect, se, threshold, conf):
    """Chance of each verdict under the three-way rule.
    holds: interval excludes 0 in the predicted (positive) direction.
    does not hold: interval excludes effects >= threshold.
    reversal: interval wholly below 0 (a subset of 'does not hold')."""
    za = z(1 - (1 - conf) / 2)
    holds = 1 - Phi(za - true_effect / se)
    not_hold = Phi((threshold - true_effect) / se - za)
    reversal = Phi(-true_effect / se - za)
    # both verdicts at once only if the interval fits between 0 and the threshold
    both = max(0.0, not_hold - Phi(za - true_effect / se)) if 2 * za * se < threshold else 0.0
    inconclusive = 1 - holds - not_hold + both
    return holds, not_hold, reversal, both, inconclusive


def main():
    print("A. K = z(1-alpha/2) + z(power)")
    for conf in (0.90, 0.95, 0.975, 0.99):
        print(f"   interval {conf:.3f}: K at 80% power {k_value(conf, 0.80):.4f}, at 90% power {k_value(conf, 0.90):.4f}")

    print("\nB. Exercises per group, paired yes/no outcome, worst case (rate 50%), 80% power")
    for conf in (0.95, 0.975):
        K = k_value(conf, 0.80)
        row = []
        for sigma in (0.0, 0.10, 0.20, 0.30):
            v = per_unit_variance(0.5, 0.5, sigma)          # 0.5 + sigma^2
            main_effect = (v / 2) / (0.05 / K) ** 2         # example 1: mean of two groups -> var v/(2S)
            interaction = (2 * v) / (0.10 / K) ** 2         # example 2: difference of two groups -> var 2v/S
            row.append(f"sigma {sigma:.2f}: ex1 {main_effect:7.1f}  ex2 {interaction:7.1f}")
        print(f"   {conf:.3f}: " + " | ".join(row))
    k95, k975 = k_value(0.95, 0.80), k_value(0.975, 0.80)
    print(f"   cost of splitting alpha over two claims: x{(k975 / k95) ** 2:.3f} units")
    print(f"   false 'holds' (predicted direction), two claims: at most {2 * 2.5:.1f}% with 95% intervals, "
          f"{2 * 1.25:.1f}% with 97.5%")

    S = 1032
    sigma = 0.20
    v = per_unit_variance(0.5, 0.5, sigma)
    se_main = sqrt(v / (2 * S))
    se_int = sqrt(2 * v / S)
    print(f"\nC. Planned size: S = {S} exercises per group, sigma {sigma}; SE(ex1) = {se_main:.5f}, SE(ex2) = {se_int:.5f}")
    print(f"   signal-to-noise at the thresholds: ex1 {0.05 / se_main:.3f} SE, ex2 {0.10 / se_int:.3f} SE")

    print("\nD. Alpha-beta trade-off at the fixed planned size (example 1, true effect = 5 points)")
    for conf in (0.90, 0.95, 0.975, 0.99, 0.995):
        za = z(1 - (1 - conf) / 2)
        power = 1 - Phi(za - 0.05 / se_main)
        print(f"   interval {conf:.3f}: false 'holds' rate (one direction) {100 * (1 - conf) / 2:5.2f}%  "
              f"power {100 * power:5.1f}%  miss rate {100 * (1 - power):5.1f}%")

    print("\nE. Three-way verdict chances at the planned size (97.5% interval)")
    for name, se, thr in (("example 1", se_main, 0.05), ("example 2", se_int, 0.10)):
        print(f"   {name} (threshold {100 * thr:.0f} points); interval width = {2 * z(0.9875) * se / thr:.2f} x threshold")
        for frac in (-0.5, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5):
            e = frac * thr
            h, n, r, b, i = outcome_probs(e, se, thr, 0.975)
            print(f"      true {100 * e:+6.2f} pts: holds {h:.3f}  does not hold {n:.3f} (reversal {r:.3f})  "
                  f"both {b:.3f}  inconclusive {i:.3f}")

    print("\nF. Minimum detectable effects at the planned size (80% power)")
    for conf in (0.975, 0.95):
        K = k_value(conf, 0.80)
        print(f"   interval {conf:.3f}: ex1 {100 * K * se_main:.2f} pts, ex2 {100 * K * se_int:.2f} pts")
    se_int_250 = sqrt(2 * v / 250)
    print(f"   with only 250 exercises per group, 97.5%: ex2 {100 * k975 * se_int_250:.1f} pts")
    print(f"   example 2 with a 5-point threshold would need {4 * v * k975 ** 2 / 0.05 ** 2:,.1f} exercises in all")

    print("\nG. Base rate: noise per try p(1-p)")
    for p in (0.5, 0.3, 0.16, 0.10, 0.05):
        print(f"   rate {p:.2f}: {p * (1 - p):.4f}")
    v16 = per_unit_variance(0.16 - 0.025, 0.16 + 0.025, sigma)
    se16 = sqrt(v16 / (2 * S))
    print(f"   base-rate check, rates 0.135 vs 0.185, sigma 0.20: power {1 - Phi(z(0.9875) - 0.05 / se16):.3f}")

    print("\nH. Many exercises tried once vs few exercises tried many times (example 1, 97.5%, sigma 0.20)")
    for s in (150, 250, 1032):
        gap = (0.05 / k975) ** 2 - sigma ** 2 / (2 * s)
        if gap <= 0:
            print(f"   {s} exercises per group: no number of tries reaches 80% power")
        else:
            n_cell = 0.25 / gap
            print(f"   {s} exercises per group: {n_cell:,.0f} tries per group and style -> {4 * n_cell:,.0f} tries")
    print(f"   one try per exercise and style: {4 * S:,} tries")
    print(f"   floor: fewer than {sigma ** 2 * k975 ** 2 / (2 * 0.05 ** 2):.0f} exercises per group can never reach 80% power")

    print("\nJ. Example 3: checking a number you were given (400 exercises per group, example 1's settings)")
    v = per_unit_variance(0.5, 0.5, sigma)
    se_given = sqrt(v / (2 * 400))
    h0, n0, _, _, i0 = outcome_probs(0.0, se_given, 0.05, 0.975)
    h5, n5, _, _, i5 = outcome_probs(0.05, se_given, 0.05, 0.975)
    print(f"   SE {100 * se_given:.2f} pts; MDE {100 * k975 * se_given:.2f} pts; power at 5 pts {h5:.3f}")
    print(f"   true effect 0: holds {h0:.3f}, does not hold {n0:.3f}, inconclusive {i0:.3f}")
    print(f"   true effect 5: holds {h5:.3f}, does not hold {n5:.3f}, inconclusive {i5:.3f}")

    print("\nK. The fourth verdict ('an effect, but smaller than the threshold') becomes possible when n exceeds")
    for conf in (0.95, 0.975):
        za = z(1 - (1 - conf) / 2)
        print(f"   interval {conf:.3f}, 80% power: {(2 * za / k_value(conf, 0.80)) ** 2:.3f} x the required n")

    print("\nI. Generic designs (95% interval, 80% power)")
    v = 0.10 * 0.90 + 0.12 * 0.88
    print(f"   independent groups, rates 10% vs 12%: n per group = {v * k95 ** 2 / 0.02 ** 2:,.1f}")
    print(f"   independent groups, means, SD 1, difference 0.5: n per group = {2 * 1.0 ** 2 * k95 ** 2 / 0.5 ** 2:.1f}")
    print(f"   paired, rate worst case, sigma 0, main effect 5 pts: units = {0.5 * k95 ** 2 / 0.05 ** 2:,.1f}")
    print(f"   paired, rate worst case, sigma 0, interaction 5 pts: units = {4 * 0.5 * k95 ** 2 / 0.05 ** 2:,.1f}"
          f" (4x the main effect)")


if __name__ == "__main__":
    main()
