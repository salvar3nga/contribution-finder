export function formatScore(score: number | null): string {
  return score === null ? '–' : String(Math.round(score));
}
