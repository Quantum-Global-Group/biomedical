import { AppShell } from "@/components/shell/AppShell";
import { OperationsClient } from "./OperationsClient";

// Operations renders in both build targets:
//   - Standalone (full): polls /ops/* every 5s, swaps live data into the
//     panels as it arrives.
//   - Lite (HF Space, static export): useOps() short-circuits to the
//     SEED_* fixtures (no fetch, no polling). The panels still render so
//     visitors can see what the operations console looks like; the "live"
//     vs "seed" footers show every feed as `seed`, and the page banner
//     reads "demo data — full version polls a live FastAPI".
export default function OperationsPage() {
  return (
    <AppShell active="/operations">
      <OperationsClient />
    </AppShell>
  );
}
