import { expect, test } from '@playwright/test';

test('a username leads to ranked results and an Issue detail', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('GitHub username').fill('sergio');
  await page.getByRole('button', { name: 'Find issues' }).click();

  await expect(page).toHaveURL(/\/u\/sergio$/);
  const rows = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(rows.first()).toContainText('Fix the widget alignment');
  await expect(rows.nth(1)).toContainText('Document the config file');
  await expect(rows.nth(1)).toContainText('Claimed');
  await expect(rows.nth(1)).toContainText('Repo health: not enough data');

  await page.getByRole('link', { name: 'Fix the widget alignment' }).click();

  await expect(page).toHaveURL(/\/u\/sergio\/acme\/widgets\/7$/);
  await expect(
    page.getByRole('heading', { name: 'Match score' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Health score' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /View on GitHub/ }),
  ).toHaveAttribute('href', 'https://github.com/acme/widgets/issues/7');
});

test('every page sends security headers and the policy blocks nothing the app needs', async ({
  page,
}) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) {
      violations.push(message.text());
    }
  });

  const response = await page.goto('/');
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers['content-security-policy']).toContain("object-src 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['strict-transport-security']).toContain('max-age=');

  await page.getByLabel('GitHub username').fill('sergio');
  await page.getByRole('button', { name: 'Find issues' }).click();
  await expect(page).toHaveURL(/\/u\/sergio$/);
  await page.getByRole('link', { name: 'Fix the widget alignment' }).click();
  await expect(
    page.getByRole('heading', { name: 'Match score' }),
  ).toBeVisible();

  expect(violations).toEqual([]);
});

test('the language filter narrows the list', async ({ page }) => {
  await page.goto('/u/sergio');
  await page.getByRole('link', { name: /^Go/ }).click();

  await expect(page).toHaveURL(/language=Go/);
  await expect(page.getByText('Document the config file')).toBeVisible();
  await expect(page.getByText('Fix the widget alignment')).toHaveCount(0);
});

test('an Empty Profile says so', async ({ page }) => {
  await page.goto('/u/newcomer');
  await expect(
    page.getByText('No public activity found; showing top healthy issues'),
  ).toBeVisible();
});

test('not found, rate-limited and error states link back to Home', async ({
  page,
}) => {
  for (const [username, heading] of [
    ['ghost', 'No GitHub user with that name'],
    ['throttled', 'Too many lookups right now'],
    ['broken', 'Something went wrong'],
  ] as const) {
    await page.goto(`/u/${username}`);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/');
  }
});

test('a username GitHub could not have issued is a plain not-found page', async ({
  page,
}) => {
  for (const path of ['/u/foo%20is%3Aissue', '/u/-leading']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  }
});
