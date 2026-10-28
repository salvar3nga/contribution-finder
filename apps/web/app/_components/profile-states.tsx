import Link from 'next/link';

function State({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="state">
      <h1>{title}</h1>
      <p>{children}</p>
      <Link className="button" href="/">
        Back to home
      </Link>
    </section>
  );
}

export function ProfileNotFound({ username }: { username: string }) {
  return (
    <State title="We couldn't find that user">
      GitHub has no user called {username}, or the name belongs to an
      organisation. Check the spelling and try again.
    </State>
  );
}

export function ProfileRateLimited() {
  return (
    <State title="Too many lookups right now">
      GitHub&apos;s rate limit is used up for the moment. Try again later.
    </State>
  );
}
