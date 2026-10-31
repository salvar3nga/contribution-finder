import { describe, expect, it } from 'vitest';
import { requesterKeyFrom } from './requester';

describe('requesterKeyFrom', () => {
  it('uses the first address of x-forwarded-for', () => {
    const key = requesterKeyFrom(
      new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }),
    );

    expect(key).toBe(
      requesterKeyFrom(new Headers({ 'x-forwarded-for': '203.0.113.7' })),
    );
  });

  it('falls back to x-real-ip', () => {
    const key = requesterKeyFrom(new Headers({ 'x-real-ip': '203.0.113.7' }));

    expect(key).toBe(
      requesterKeyFrom(new Headers({ 'x-forwarded-for': '203.0.113.7' })),
    );
  });

  it('gives different addresses different keys', () => {
    const first = requesterKeyFrom(new Headers({ 'x-real-ip': '203.0.113.7' }));
    const second = requesterKeyFrom(
      new Headers({ 'x-real-ip': '203.0.113.8' }),
    );

    expect(first).not.toBe(second);
  });

  it('never exposes the raw address', () => {
    const key = requesterKeyFrom(new Headers({ 'x-real-ip': '203.0.113.7' }));

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns undefined when the request carries no address', () => {
    expect(requesterKeyFrom(new Headers())).toBeUndefined();
  });
});
