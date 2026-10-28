import { defaultScoringConfig } from '@cf/scoring';
import { componentLabels } from './_components/component-labels';
import { UsernameForm } from './_components/username-form';

export default function Home() {
  const weights = Object.entries(defaultScoringConfig.match.weights).sort(
    ([, a], [, b]) => b - a,
  );
  return (
    <div className="home-grid">
      <div>
        <h1 className="display">Find your next open-source contribution.</h1>
        <p className="lede">
          Enter a GitHub username. We rank beginner-friendly issues against the
          languages and topics you already work with, and show exactly how each
          score was made.
        </p>
        <UsernameForm />
      </div>
      <section className="explainer" aria-labelledby="explainer-heading">
        <h2 id="explainer-heading">How an Issue is scored</h2>
        <p>
          Every Issue gets a Match score from 0 to 100. These are the parts and
          how much each one counts. If a part has no data, it is left out and
          the rest share its weight.
        </p>
        <dl className="weights">
          {weights.map(([component, weight]) => (
            <div key={component}>
              <dt>{componentLabels[component]}</dt>
              <dd>{Math.round(weight * 100)}%</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
