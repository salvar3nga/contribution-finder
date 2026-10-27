export interface RateLimit {
  remaining: number;
  resetAt: Date;
}

export interface Rated<T> {
  value: T;
  rateLimit: RateLimit;
}

export interface SearchSlice {
  language: string;
  minStars: number;
  maxStars: number | null;
}

export interface DiscoveredRepo {
  id: string;
  owner: string;
  name: string;
  language: string | null;
  stars: number;
  topics: string[];
  lastCommitAt: Date | null;
  isFork: boolean;
  isArchived: boolean;
}

export interface SearchPage {
  repos: DiscoveredRepo[];
  nextCursor: string | null;
}

export interface RepoIssue {
  id: string;
  number: number;
  title: string;
  url: string;
  labels: string[];
  assigneeCount: number;
  openLinkedPrCount: number;
  lastActivityAt: Date;
}

export interface RecentItem {
  createdAt: Date;
  firstResponseAt: Date | null;
}

export interface RecentPullRequest {
  authorAssociation: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
}

export interface RepoActivity {
  complete: boolean;
  openIssues: RepoIssue[];
  recentItems: RecentItem[];
  recentPullRequests: RecentPullRequest[];
}

export interface RepoRef {
  owner: string;
  name: string;
}

export interface GitHubClient {
  searchRepos(
    slice: SearchSlice,
    cursor: string | null,
  ): Promise<Rated<SearchPage>>;
  fetchRepoActivity(repo: RepoRef, since: Date): Promise<Rated<RepoActivity>>;
}
