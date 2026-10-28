import {
  createGraphqlUserClient,
  createProfileBuilder,
  environmentTokenSource,
  type ProfileOutcome,
} from '@cf/profile';
import { getDb } from './db';

const fakeProfiles: Record<string, ProfileOutcome> = {
  ghost: { kind: 'not-found' },
  throttled: { kind: 'rate-limited' },
  newcomer: {
    kind: 'profile',
    profile: { languageShare: {}, topics: [], emptyProfile: true },
  },
};

const fakeDeveloper: ProfileOutcome = {
  kind: 'profile',
  profile: {
    languageShare: { TypeScript: 70, Go: 30 },
    topics: ['cli'],
    emptyProfile: false,
  },
};

async function fakeProfileOutcome(username: string): Promise<ProfileOutcome> {
  const name = username.toLowerCase();
  if (name === 'broken') throw new Error('fake profile source failure');
  return fakeProfiles[name] ?? fakeDeveloper;
}

export async function getProfileOutcome(
  username: string,
): Promise<ProfileOutcome> {
  if (process.env.FAKE_PROFILE_SOURCE === '1') {
    return fakeProfileOutcome(username);
  }
  const buildProfile = createProfileBuilder({
    db: getDb(),
    client: createGraphqlUserClient({ tokenSource: environmentTokenSource() }),
  });
  return buildProfile(username);
}
