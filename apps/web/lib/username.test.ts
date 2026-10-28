import { describe, expect, it } from 'vitest';
import { parseUsername } from './username';

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
