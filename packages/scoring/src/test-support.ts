import type { BreakdownEntry } from './breakdown';

export function breakdownEntry<Component extends string>(
  result: { breakdown: BreakdownEntry<Component>[] },
  component: Component,
): BreakdownEntry<Component> {
  const found = result.breakdown.find((entry) => entry.component === component);
  if (!found) throw new Error(`No breakdown entry for ${component}`);
  return found;
}
