import type { Curve } from './config.js';

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

export function applyCurve(input: number, { full, zero }: Curve): number {
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
  componentsWithData: number;
} {
  const withData = components.filter((candidate) => candidate.value !== null);
  const totalWeight = withData.reduce(
    (sum, present) => sum + present.weight,
    0,
  );
  const breakdown = components.map((input): BreakdownEntry<Component> => {
    if (input.value === null || totalWeight === 0) {
      return noData(input.component);
    }
    const weight = input.weight / totalWeight;
    return {
      component: input.component,
      value: input.value,
      weight,
      contribution: input.value * weight,
    };
  });
  const score =
    totalWeight === 0
      ? null
      : breakdown.reduce((sum, entry) => sum + (entry.contribution ?? 0), 0);
  return { score, breakdown, componentsWithData: withData.length };
}
