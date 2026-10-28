import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getActiveRepos } from '@/lib/active-repos';
import { usernameFromParam } from '@/lib/username';
import { getProfileOutcome } from '@/lib/profile-source';
import { rankIssues, type Ranking } from '@/lib/ranking';
import {
  ProfileNotFound,
  ProfileRateLimited,
} from '@/app/_components/profile-states';
import { ResultsSkeleton } from '@/app/_components/results-skeleton';
import { strengthLabels } from '@/app/_components/component-labels';
import { formatScore } from '@/app/_components/score-label';

export async function generateMetadata({
  params,
}: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Issues for ${usernameFromParam(username) ?? 'unknown user'}`,
  };
}

export default function ResultsPage(props: PageProps<'/u/[username]'>) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <Results {...props} />
    </Suspense>
  );
}

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function resultsHref(username: string, language: string | null, page: number) {
  const query = new URLSearchParams();
  if (language) query.set('language', language);
  if (page > 1) query.set('page', String(page));
  const suffix = query.size > 0 ? `?${query}` : '';
  return `/u/${encodeURIComponent(username)}${suffix}`;
}

async function Results({ params, searchParams }: PageProps<'/u/[username]'>) {
  await connection();
  const { username: rawUsername } = await params;
  const username = usernameFromParam(rawUsername);
  if (username === null) notFound();
  const query = await searchParams;
  const language = firstValue(query.language);
  const page = Number.parseInt(firstValue(query.page) ?? '1', 10) || 1;

  const outcome = await getProfileOutcome(username);
  if (outcome.kind === 'not-found')
    return <ProfileNotFound username={username} />;
  if (outcome.kind === 'rate-limited') return <ProfileRateLimited />;

  const { profile } = outcome;
  const ranking = rankIssues(await getActiveRepos(), profile, {
    language,
    page,
    now: new Date(),
  });

  return (
    <>
      <header className="results-head">
        <h1>Issues for {username}</h1>
        {!profile.emptyProfile && (
          <p className="profile-line">
            Ranked against your public activity from the last 12 months. Your
            languages show their share.
          </p>
        )}
      </header>
      {profile.emptyProfile && (
        <p className="notice" role="note">
          No public activity found; showing top healthy issues
        </p>
      )}
      <LanguageFilter
        username={username}
        ranking={ranking}
        languageShare={profile.languageShare}
        active={language}
      />
      <IssueList username={username} ranking={ranking} />
      <Pagination username={username} ranking={ranking} language={language} />
    </>
  );
}

function shareOf(
  languageShare: Record<string, number>,
  language: string,
): number {
  const wanted = language.toLowerCase();
  return Object.entries(languageShare)
    .filter(([name]) => name.toLowerCase() === wanted)
    .reduce((total, [, share]) => total + share, 0);
}

function LanguageFilter({
  username,
  ranking,
  languageShare,
  active,
}: {
  username: string;
  ranking: Ranking;
  languageShare: Record<string, number>;
  active: string | null;
}) {
  const languages = [...ranking.languages].sort(
    (a, b) => shareOf(languageShare, b) - shareOf(languageShare, a),
  );
  const options: (string | null)[] = [null, ...languages];
  return (
    <nav aria-label="Filter by language">
      <ul className="filter">
        {options.map((option) => {
          const current =
            (option?.toLowerCase() ?? null) === (active?.toLowerCase() ?? null);
          return (
            <li key={option ?? 'all'}>
              <Link
                href={resultsHref(username, option, 1)}
                aria-current={current ? 'true' : undefined}
              >
                {option ?? 'All languages'}
                {option !== null && shareOf(languageShare, option) > 0 && (
                  <span className="chip-share">
                    {Math.round(shareOf(languageShare, option))}%
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IssueList({
  username,
  ranking,
}: {
  username: string;
  ranking: Ranking;
}) {
  if (ranking.items.length === 0) {
    return <p className="result-count">No open Issues match this filter.</p>;
  }
  return (
    <>
      <p className="result-count">
        {ranking.total} {ranking.total === 1 ? 'Issue' : 'Issues'}, best match
        first
      </p>
      <ol className="issue-list">
        {ranking.items.map(({ issue, repo, matchScore, strengths }) => (
          <li key={issue.id} className="issue-row">
            <div className="score">
              <span className="sr-only">Match score </span>
              {formatScore(matchScore)}
              <span className="sr-only"> out of 100</span>
              <small aria-hidden="true">Match /100</small>
            </div>
            <div>
              <h2 className="issue-title">
                <Link
                  href={`/u/${encodeURIComponent(username)}/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/${issue.number}`}
                >
                  {issue.title}
                </Link>
              </h2>
              <p className="meta">
                <span className="meta-repo">
                  {repo.owner}/{repo.name}
                </span>
                {repo.language && <span>{repo.language}</span>}
                <span>
                  {repo.health === null
                    ? 'Repo health: not enough data'
                    : `Repo health ${formatScore(repo.health)}`}
                </span>
                {issue.claimed && <span className="badge">Claimed</span>}
              </p>
              {strengths.length > 0 && (
                <ul className="strengths" aria-label="Strongest matches">
                  {strengths.map((strength) => (
                    <li key={strength}>{strengthLabels[strength]}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function Pagination({
  username,
  ranking,
  language,
}: {
  username: string;
  ranking: Ranking;
  language: string | null;
}) {
  if (ranking.pageCount <= 1) return null;
  const { page, pageCount } = ranking;
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link
          className="button button-quiet"
          href={resultsHref(username, language, page - 1)}
          rel="prev"
        >
          Previous
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="button button-quiet"
          aria-disabled="true"
        >
          Previous
        </span>
      )}
      <span>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          className="button button-quiet"
          href={resultsHref(username, language, page + 1)}
          rel="next"
        >
          Next
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="button button-quiet"
          aria-disabled="true"
        >
          Next
        </span>
      )}
    </nav>
  );
}
