import { getDb } from './db';
import { loadActiveRepos, type ActiveRepo } from './ranking';
import { timed } from './timing';

export async function getActiveRepos(): Promise<ActiveRepo[]> {
  return timed('active-repos load', () => loadActiveRepos(getDb()));
}
