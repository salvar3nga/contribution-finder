import type { Curve } from './config.js';

export interface BreakdownEntry<Component extends string = string> {
  component: Component;
  value: number | null;
  weight: number;
  contribution: number | null;
}

export interface ComponentInput<Component extends string> {
  component: Component;
  value: number | null;
  weight: number;
}

export function applyCurve(x: number, { full, zero }: Curve): number {
  const t = (x - zero) / (full - zero);
  return 100 * Math.min(1, Math.max(0, t));
}

export function curveOrNull(x: number | null, curve: Curve): number | null {
  return x === null ? null : applyCurve(x, curve);
}

export function noData<Component extends string>(
  component: Component,
): BreakdownEntry<Component> {
  return { component, value: null, weight: 0, contribution: null };
}

export function combine<Component extends string>(
  components: ComponentInput<Component>[],
): {
  score: number | null;
  breakdown: BreakdownEntry<Component>[];
  componentsWithData: number;
} {
  const withData = components.filter((c) => c.value !== null);
  const totalWeight = withData.reduce((sum, c) => sum + c.weight, 0);
  const breakdown = components.map((c): BreakdownEntry<Component> => {
    if (c.value === null || totalWeight === 0) return noData(c.component);
    const weight = c.weight / totalWeight;
    return {
      component: c.component,
      value: c.value,
      weight,
      contribution: c.value * weight,
    };
  });
  const score =
    totalWeight === 0
      ? null
      : breakdown.reduce((sum, b) => sum + (b.contribution ?? 0), 0);
  return { score, breakdown, componentsWithData: withData.length };
}
