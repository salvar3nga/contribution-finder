import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="state">
      <h1>Page not found</h1>
      <p>That page or Issue isn&apos;t in our data.</p>
      <Link className="button" href="/">
        Back to home
      </Link>
    </section>
  );
}
