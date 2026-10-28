'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export default function ErrorState({ reset }: { reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="state">
      <h1 ref={heading} tabIndex={-1}>
        Something went wrong
      </h1>
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
