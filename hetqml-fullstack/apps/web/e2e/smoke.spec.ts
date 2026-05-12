import { expect, test } from "@playwright/test";

/**
 * Smoke flow: Initialize → submit a job → wait for completion → open
 * Experiment and see model leaderboard rows (PR-AUC panel). Mirrors the punch-list item from
 * `PRIORITIZED_BACKLOG.md` §2 ("Playwright / E2E: add smoke flows
 * (Initialize → job → Experiment / Validate)").
 *
 * The test deliberately uses **forgiving locators** (role, accessible
 * name, partial text matches) so cosmetic copy edits don't break the
 * suite. If a `data-testid="leaderboard-row"` is added later the assertion
 * can tighten.
 *
 * Assumptions:
 *   - `pnpm dev:web` is serving the app on PLAYWRIGHT_BASE_URL.
 *   - `pnpm dev:api` is serving the API the web app proxies to (the dev
 *     proxy at `/__hetqml_api` is the default; override with
 *     NEXT_PUBLIC_DISABLE_DEV_API_PROXY=true if you point at a remote API).
 *   - The API is configured for the synthetic / classical run path so the
 *     job completes inside the polling timeout (~90s by default).
 */

test.describe("smoke: initialize → job → experiment", () => {
  test("submits an investigation and shows a leaderboard on Experiment", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // 1. Land on Initialize.
    await page.goto("/initialize");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible();

    // 2. Fill the cascade via the embedded recommendation engine (one click
    //    per missing field) so "Run investigation" becomes enabled — the form
    //    does not pre-select disease/compound/gene/metaedge on a cold load.
    const applyRecommended = page.getByRole("button", { name: /recommended/i });
    for (let i = 0; i < 4; i++) {
      await expect(applyRecommended.first()).toBeVisible({ timeout: 30_000 });
      await applyRecommended.first().click();
    }

    // 3. Submit.
    const runButton = page.getByRole("button", { name: /run investigation/i });
    await expect(runButton).toBeVisible();
    await expect(runButton).toBeEnabled({ timeout: 30_000 });
    await runButton.click();

    // 4. Stay on Initialize until the job finishes — JobView surfaces metrics
    //    once status is completed (no auto-navigation today).
    await expect(page.getByText("completed", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText("PR-AUC", { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // 5. Experiment hydrates the latest job from localStorage (`setLastJobId`)
    //    and renders LeaderboardPanel when a completed JobResult exists.
    await page.goto("/experiment");
    await expect(
      page.getByText(/which model performed best/i).first(),
    ).toBeVisible({ timeout: 90_000 });

    // Canonical 13-row roster from `apps/api/src/hetqml_api/jobs/runner.py`
    // — at least one of these algorithm names should be present.
    const anyKnownModel = page.getByText(
      /Quantum Kernel \+ Metapath|Stacking ensemble|Logistic Regression|DWPC \(Project Rephetio\)/i,
    );
    await expect(anyKnownModel.first()).toBeVisible({ timeout: 90_000 });
  });
});
