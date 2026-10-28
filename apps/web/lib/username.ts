const githubUsername = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export function parseUsername(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, '');
  return githubUsername.test(trimmed) ? trimmed : null;
}
