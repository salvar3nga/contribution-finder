import type { Curve } from './config';

export interface BreakdownEntry<Component extends string> {
  component: Component;
  value: number | null;
  weight: number;
  contribution: number | null;
}

type ComponentInput<Component extends string> = Omit<
  BreakdownEntry<Component>,
  'contribution'
>;

export function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function applyCurve(input: number, { full, zero }: Curve): number {
  if (full === zero) return input <= full ? 100 : 0;
  const progress = (input - zero) / (full - zero);
  return 100 * Math.min(1, Math.max(0, progress));
}

export function curveOrNull(input: number | null, curve: Curve): number | null {
  return input === null ? null : applyCurve(input, curve);
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
  weightedComponents: number;
} {
  const withData = components.filter((component) => component.value !== null);
  const totalWeight = withData.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const breakdown = components.map((component): BreakdownEntry<Component> => {
    if (component.value === null || totalWeight === 0) {
      return noData(component.component);
    }
    const weight = component.weight / totalWeight;
    return {
      component: component.component,
      value: component.value,
      weight,
      contribution: component.value * weight,
    };
  });
  const score =
    totalWeight === 0
      ? null
      : breakdown.reduce((sum, entry) => sum + (entry.contribution ?? 0), 0);
  return {
    score,
    breakdown,
    weightedComponents: withData.filter((component) => component.weight > 0)
      .length,
  };
}
