import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import type { BreakdownEntry } from '@cf/scoring';
import { getDb } from '@/lib/db';
import { findIssueDetail } from '@/lib/issue-detail';
import { getProfileOutcome } from '@/lib/profile-source';
import {
  ProfileNotFound,
  ProfileRateLimited,
} from '@/app/_components/profile-states';
import { ResultsSkeleton } from '@/app/_components/results-skeleton';
import { formatScore } from '@/app/_components/score-label';

type Props = PageProps<'/u/[username]/[owner]/[repo]/[number]'>;

const componentLabels: Record<string, string> = {
  language: 'Language overlap',
  health: 'Repo health',
  topics: 'Topic overlap',
  freshness: 'Issue freshness',
  unclaimed: 'Unclaimed',
  responseTime: 'Maintainer response time',
  recentCommits: 'Recent commit activity',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return { title: `${owner}/${repo}#${number}` };
}

export default function IssueDetailPage(props: Props) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <IssueDetail {...props} />
    </Suspense>
  );
}

function formatHours(hours: number | null): string | null {
  if (hours === null) return null;
  return hours < 48
    ? `${Math.round(hours)} hours`
    : `${Math.round(hours / 24)} days`;
}

function formatDate(date: Date | null): string | null {
  return date === null
    ? null
    : date.toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'UTC' });
}

async function IssueDetail({ params }: Props) {
  await connection();
  const {
    username: rawUsername,
    owner: rawOwner,
    repo: rawRepo,
    number: rawNumber,
  } = await params;
  const username = decodeURIComponent(rawUsername);
  const owner = decodeURIComponent(rawOwner);
  const repoName = decodeURIComponent(rawRepo);
  const number = Number.parseInt(rawNumber, 10);
  if (!Number.isInteger(number)) notFound();

  const outcome = await getProfileOutcome(username);
  if (outcome.kind === 'not-found')
    return <ProfileNotFound username={username} />;
  if (outcome.kind === 'rate-limited') return <ProfileRateLimited />;

  const detail = await findIssueDetail(
    getDb(),
    outcome.profile,
    { owner, repo: repoName, number },
    new Date(),
  );
  if (detail === null) notFound();

  const { issue, repo, match, health } = detail;
  const noData = <span className="no-data">no data</span>;

  return (
    <>
      <p className="breadcrumb">
        <Link href={`/u/${encodeURIComponent(username)}`}>
          ← Issues for {username}
        </Link>
      </p>
      <h1 className="detail-title">{issue.title}</h1>
      <p className="detail-sub">
        <span className="meta-repo">
          {repo.owner}/{repo.name}#{issue.number}
        </span>
        {issue.claimed && (
          <>
            {' '}
            <span className="badge">Claimed</span>
          </>
        )}
      </p>
      <a
        className="button"
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on GitHub<span className="sr-only"> (opens in a new tab)</span>
      </a>

      <div className="detail-grid facts-block">
        <section aria-labelledby="match-heading">
          <h2 className="section-title" id="match-heading">
            Match score
          </h2>
          <p className="section-total">
            {match.score === null
              ? 'No score'
              : `${formatScore(match.score)} out of 100`}
          </p>
          <Breakdown
            caption="Match score breakdown"
            entries={match.breakdown}
            noData={noData}
          />
        </section>
        <section aria-labelledby="health-heading">
          <h2 className="section-title" id="health-heading">
            Health score
          </h2>
          <p className="section-total">
            {health.score === null
              ? 'Not enough data'
              : `${formatScore(health.score)} out of 100`}
          </p>
          <Breakdown
            caption="Health score breakdown"
            entries={health.breakdown}
            noData={noData}
          />
        </section>
      </div>

      <section className="facts-block" aria-labelledby="repo-heading">
        <h2 className="section-title" id="repo-heading">
          Repo facts
        </h2>
        <dl className="facts">
          <dt>Language</dt>
          <dd>{repo.language ?? noData}</dd>
          <dt>Stars</dt>
          <dd>{repo.stars.toLocaleString('en')}</dd>
          <dt>Topics</dt>
          <dd>{repo.topics.length > 0 ? repo.topics.join(', ') : noData}</dd>
          <dt>Last commit</dt>
          <dd>{formatDate(repo.lastCommitAt) ?? noData}</dd>
          <dt>Median first response</dt>
          <dd>{formatHours(repo.medianFirstResponseHours) ?? noData}</dd>
        </dl>
      </section>
    </>
  );
}

function Breakdown({
  caption,
  entries,
  noData,
}: {
  caption: string;
  entries: BreakdownEntry<string>[];
  noData: React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="breakdown">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Value</th>
            <th scope="col">Weight</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.component}>
              <th scope="row">
                {componentLabels[entry.component] ?? entry.component}
              </th>
              {entry.value === null ? (
                <td colSpan={3}>{noData}</td>
              ) : (
                <>
                  <td>
                    <span className="value-cell">
                      <span className="value-bar" aria-hidden="true">
                        <span
                          style={{ width: `${Math.round(entry.value)}%` }}
                        />
                      </span>
                      {formatScore(entry.value)}
                    </span>
                  </td>
                  <td>{Math.round(entry.weight * 100)}%</td>
                  <td>
                    {entry.contribution === null
                      ? '–'
                      : entry.contribution.toFixed(1)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
