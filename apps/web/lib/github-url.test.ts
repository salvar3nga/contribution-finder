import { describe, expect, it } from 'vitest';
import { safeGitHubUrl } from './github-url';

describe('safeGitHubUrl', () => {
  it('accepts an https github.com URL', () => {
    expect(safeGitHubUrl('https://github.com/acme/widgets/issues/7')).toBe(
      'https://github.com/acme/widgets/issues/7',
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://github.com/acme/widgets/issues/7',
    'https://github.com.evil.example/acme/widgets/issues/7',
    'https://evil.example/github.com/acme',
    '//github.com/acme/widgets/issues/7',
    'not a url',
    '',
  ])('rejects %j', (url) => {
    expect(safeGitHubUrl(url)).toBeNull();
  });
});
