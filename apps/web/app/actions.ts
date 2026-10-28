'use server';

import { redirect } from 'next/navigation';
import { parseUsername } from '@/lib/username';

export async function submitUsername(
  _previous: string | null,
  formData: FormData,
): Promise<string | null> {
  const username = parseUsername(String(formData.get('username') ?? ''));
  if (username === null) {
    return "That doesn't look like a GitHub username. Use letters, numbers and hyphens, up to 39 characters.";
  }
  redirect(`/u/${encodeURIComponent(username)}`);
}
