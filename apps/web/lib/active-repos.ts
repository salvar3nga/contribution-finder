import { cacheLife } from 'next/cache';
import { getDb } from './db';
import { loadActiveRepos, type ActiveRepo } from './ranking';
import { timed } from './timing';

export async function getActiveRepos(): Promise<ActiveRepo[]> {
  'use cache';
  cacheLife('minutes');
  return timed('active-repos cache miss', () => loadActiveRepos(getDb()));
}
