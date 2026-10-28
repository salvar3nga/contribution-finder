import { cacheLife } from 'next/cache';
import { getDb } from './db';
import { loadActiveRepos, type ActiveRepo } from './ranking';

export async function getActiveRepos(): Promise<ActiveRepo[]> {
  'use cache';
  cacheLife('minutes');
  return loadActiveRepos(getDb());
}
