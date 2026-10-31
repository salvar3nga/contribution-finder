export function safeGitHubUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const isGitHub =
      parsed.protocol === 'https:' && parsed.hostname === 'github.com';
    return isGitHub ? parsed.href : null;
  } catch {
    return null;
  }
}
