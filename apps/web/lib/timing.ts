export async function timed<T>(
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    console.log(
      `[timing] ${label} ${Math.round(performance.now() - startedAt)}ms`,
    );
  }
}
