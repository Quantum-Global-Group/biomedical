import { StubPage } from "@/components/shell/StubPage";

export default function ValidatePage() {
  return (
    <StubPage
      active="/validate"
      step="03 · VALIDATE"
      title="Trust the result"
      blurb="Trust-scorecard radar, reliability diagram with calibration plot, reviewer decision panel, decision history."
      legacyHref="../hetqml-pages/validate/"
    />
  );
}
