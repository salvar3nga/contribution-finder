'use client';

import Link from 'next/link';

export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section className="state">
      <h1>Something went wrong</h1>
      <p>
        We couldn&apos;t load this page. Try again, or start over from home.
      </p>
      <div className="field-row">
        <button className="button" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="button button-quiet" href="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
