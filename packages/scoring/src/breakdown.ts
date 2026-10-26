import type { Curve } from "./config.js";

export interface BreakdownEntry {
  component: string;
  value: number | null;
  weight: number;
  contribution: number | null;
}

export function applyCurve(x: number, { full, zero }: Curve): number {
  const t = (x - zero) / (full - zero);
  return 100 * Math.min(1, Math.max(0, t));
}

export function combine(
  components: { component: string; value: number | null; weight: number }[],
): { score: number | null; breakdown: BreakdownEntry[]; withData: number } {
  const live = components.filter((c) => c.value !== null && c.weight > 0);
  const total = live.reduce((s, c) => s + c.weight, 0);
  const breakdown = components.map((c): BreakdownEntry => {
    if (c.value === null || c.weight <= 0 || total === 0) {
      return { component: c.component, value: null, weight: 0, contribution: null };
    }
    const weight = c.weight / total;
    return { component: c.component, value: c.value, weight, contribution: c.value * weight };
  });
  const score = live.length === 0 ? null : breakdown.reduce((s, b) => s + (b.contribution ?? 0), 0);
  return { score, breakdown, withData: live.length };
}
