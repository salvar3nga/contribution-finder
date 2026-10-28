import { UsernameForm } from './_components/username-form';

export default function Home() {
  return (
    <>
      <h1 className="display">Find your next open-source contribution.</h1>
      <p className="lede">
        Enter a GitHub username. We rank beginner-friendly issues against the
        languages and topics you already work with, and show exactly how each
        score was made.
      </p>
      <UsernameForm />
    </>
  );
}
