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
        <span className="pill amber">stub</span>
      </div>
      <section className="panel">
        <p className="panel-purpose">
          This page is a stub in the Next.js port. The static export has the
          full content at <a href={legacyHref}>{legacyHref}</a>.
        </p>
      </section>
    </AppShell>
  );
}
