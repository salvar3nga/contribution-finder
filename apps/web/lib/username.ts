const githubUsername = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export function parseUsername(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, '');
  return githubUsername.test(trimmed) ? trimmed : null;
}

export function decodeParam(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function usernameFromParam(segment: string): string | null {
  const decoded = decodeParam(segment);
  return decoded !== null && githubUsername.test(decoded) ? decoded : null;
}
