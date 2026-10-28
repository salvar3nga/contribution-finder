import { describe, expect, it } from 'vitest';
import { decodeParam, parseUsername, usernameFromParam } from './username';

describe('parsing a GitHub username', () => {
  it('trims whitespace and a leading @', () => {
    expect(parseUsername('  @salvar3nga ')).toBe('salvar3nga');
  });

  it('rejects names GitHub could not have issued', () => {
    expect(parseUsername('')).toBeNull();
    expect(parseUsername('has space')).toBeNull();
    expect(parseUsername('-leading')).toBeNull();
    expect(parseUsername('a'.repeat(40))).toBeNull();
  });
});

describe('reading a username from a URL segment', () => {
  it('accepts a valid username', () => {
    expect(usernameFromParam('salvar3nga')).toBe('salvar3nga');
  });

  it('rejects anything a GitHub username cannot be, without throwing', () => {
    expect(usernameFromParam('%E0%A4%A')).toBeNull();
    expect(usernameFromParam('foo%20is%3Aissue')).toBeNull();
    expect(usernameFromParam('%40salvar3nga')).toBeNull();
    expect(usernameFromParam('')).toBeNull();
  });
});

describe('decoding a URL segment', () => {
  it('decodes percent escapes', () => {
    expect(decodeParam('my%2Drepo')).toBe('my-repo');
  });

  it('returns null for a malformed escape', () => {
    expect(decodeParam('%E0%A4%A')).toBeNull();
  });
});
