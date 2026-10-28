import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getDb } from '@/lib/db';
import { getProfileOutcome } from '@/lib/profile-source';
import { rankIssues, type Ranking } from '@/lib/ranking';
import {
  ProfileNotFound,
  ProfileRateLimited,
} from '@/app/_components/profile-states';
import { ResultsSkeleton } from '@/app/_components/results-skeleton';
import { formatScore } from '@/app/_components/score-label';

export async function generateMetadata({
  params,
}: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await params;
  return { title: `Issues for ${decodeURIComponent(username)}` };
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

function languageSummary(languageShare: Record<string, number>): string {
  return Object.entries(languageShare)
    .sort(([, a], [, b]) => b - a)
    .map(([language, share]) => `${language} ${Math.round(share)}%`)
    .join(', ');
}

async function Results({ params, searchParams }: PageProps<'/u/[username]'>) {
  await connection();
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);
  const query = await searchParams;
  const language = firstValue(query.language);
  const page = Number.parseInt(firstValue(query.page) ?? '1', 10) || 1;

  const outcome = await getProfileOutcome(username);
  if (outcome.kind === 'not-found')
    return <ProfileNotFound username={username} />;
  if (outcome.kind === 'rate-limited') return <ProfileRateLimited />;

  const { profile } = outcome;
  const ranking = await rankIssues(getDb(), profile, {
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
            Your last 12 months: {languageSummary(profile.languageShare)}
          </p>
        )}
      </header>
      {profile.emptyProfile && (
        <p className="notice" role="note">
          No public activity found; showing top healthy issues
        </p>
      )}
      <LanguageFilter username={username} ranking={ranking} active={language} />
      <IssueList username={username} ranking={ranking} />
      <Pagination username={username} ranking={ranking} language={language} />
    </>
  );
}

function LanguageFilter({
  username,
  ranking,
  active,
}: {
  username: string;
  ranking: Ranking;
  active: string | null;
}) {
  const options: (string | null)[] = [null, ...ranking.languages];
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
      <p className="result-count" aria-live="polite">
        {ranking.total} {ranking.total === 1 ? 'Issue' : 'Issues'}, best match
        first
      </p>
      <ol className="issue-list">
        {ranking.items.map(({ issue, repo, matchScore }) => (
          <li key={issue.id} className="issue-row">
            <div
              className="score"
              aria-label={`Match score ${formatScore(matchScore)}`}
            >
              {formatScore(matchScore)}
              <small>Match</small>
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
                    ? 'Health: not enough data'
                    : `Health ${formatScore(repo.health)}`}
                </span>
                {issue.claimed && <span className="badge">Claimed</span>}
              </p>
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
