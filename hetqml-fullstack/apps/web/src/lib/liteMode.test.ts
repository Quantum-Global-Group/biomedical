/**
 * Tests on the lite-mode helper. Verifies the env-var probe responds to
 * NEXT_PUBLIC_LITE_MODE correctly and that the public string constants
 * carry the expected wording (the LiteUnavailablePanel / sidebar badge
 * read these directly).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isLiteMode, LITE_BADGE_LABEL, LITE_BANNER_BODY } from "./liteMode";

const ORIG = process.env.NEXT_PUBLIC_LITE_MODE;

afterEach(() => {
  process.env.NEXT_PUBLIC_LITE_MODE = ORIG;
});

describe("isLiteMode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns true only for the literal string 'true'", () => {
    process.env.NEXT_PUBLIC_LITE_MODE = "true";
    expect(isLiteMode()).toBe(true);
  });

  it("returns false when the env var is missing", () => {
    delete process.env.NEXT_PUBLIC_LITE_MODE;
    expect(isLiteMode()).toBe(false);
  });

  it("returns false when the env var is 'false'", () => {
    process.env.NEXT_PUBLIC_LITE_MODE = "false";
    expect(isLiteMode()).toBe(false);
  });

  it("returns false for any other value (no truthy coercion)", () => {
    process.env.NEXT_PUBLIC_LITE_MODE = "1";
    expect(isLiteMode()).toBe(false);
    process.env.NEXT_PUBLIC_LITE_MODE = "yes";
    expect(isLiteMode()).toBe(false);
  });
});

describe("lite-mode copy", () => {
  it("LITE_BADGE_LABEL identifies the build as a demo HF Space", () => {
    expect(LITE_BADGE_LABEL).toContain("Demo");
    expect(LITE_BADGE_LABEL).toContain("HF Space");
  });

  it("LITE_BANNER_BODY explains what's missing (backend, IBM auth, decision logging)", () => {
    expect(LITE_BANNER_BODY).toContain("no backend");
    expect(LITE_BANNER_BODY).toContain("IBM");
    expect(LITE_BANNER_BODY).toContain("decision");
    expect(LITE_BANNER_BODY).toContain("mock data");
  });
});
