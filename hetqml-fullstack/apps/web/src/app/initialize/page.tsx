import { AppShell } from "@/components/shell/AppShell";
import { fetchCatalogsForServerComponent } from "@/lib/data/fetchCatalogsServer";
import { InitializeClient } from "./InitializeClient";

export default async function InitializePage() {
  const catalogs = await fetchCatalogsForServerComponent();

  return (
    <AppShell active="/initialize">
      <div className="page-hero">
        <div>
          <div className="step">01 · INITIALIZE</div>
          <h1 className="h1">Define the investigation</h1>
          <p className="lede">
            Set what you&apos;re investigating and how it should run. The
            choices on this page govern every downstream evidence claim — the
            page exists to make those choices explicit before any number appears.
          </p>
        </div>
        <span className="pill">● ready</span>
      </div>
      <InitializeClient initialCatalogs={catalogs} />
    </AppShell>
  );
}
