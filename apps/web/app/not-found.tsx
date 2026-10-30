import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="state">
      <h1>Page not found</h1>
      <p>You&apos;ve reached a page or Issue that isn&apos;t in the data.</p>
      <Link className="button" href="/">
        Back to home
      </Link>
    </section>
  );
}
