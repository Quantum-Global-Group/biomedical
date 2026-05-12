/**
 * @deprecated The five routes this component was scaffolded for
 * (Experiment, Validate, Visualize, Operations, Settings) are now real
 * Next.js client pages — see `apps/web/src/app/<route>/page.tsx` for
 * each. Nothing imports this file; kept temporarily so an external link
 * to the type doesn't break before the next cleanup pass. Safe to delete
 * when the porting-notes.md reference is also removed.
 */
import { AppShell } from "./AppShell";

interface Props {
  active: string;
  step: string;
  title: string;
  blurb: string;
  legacyHref: string;
}

export function StubPage({ active, step, title, blurb, legacyHref }: Props) {
  return (
    <AppShell active={active}>
      <div className="page-hero">
        <div>
          <div className="step">{step}</div>
          <h1 className="h1">{title}</h1>
          <p className="lede">{blurb}</p>
        </div>
        <span className="pill amber">deprecated stub</span>
      </div>
      <section className="panel">
        <p className="panel-purpose">
          Historical placeholder — the live Next route lives elsewhere. Static
          export reference: <a href={legacyHref}>{legacyHref}</a>.
        </p>
      </section>
    </AppShell>
  );
}
