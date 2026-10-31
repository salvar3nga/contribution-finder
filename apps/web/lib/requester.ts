import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

export function requesterKeyFrom(headerList: Headers): string | undefined {
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || headerList.get('x-real-ip')?.trim();
  if (!address) return undefined;
  return createHash('sha256').update(address).digest('hex');
}

export async function currentRequesterKey(): Promise<string | undefined> {
  return requesterKeyFrom(await headers());
}
