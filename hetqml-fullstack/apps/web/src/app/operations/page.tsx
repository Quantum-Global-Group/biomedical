import { StubPage } from "@/components/shell/StubPage";

export default function OperationsPage() {
  return (
    <StubPage
      active="/operations"
      step="05 · OPERATIONS"
      title="System health"
      blurb="IBM Quantum backends, active job queue, resource utilization, cost / budget, data sources, alerts."
      legacyHref="../hetqml-pages/operations/"
    />
  );
}
