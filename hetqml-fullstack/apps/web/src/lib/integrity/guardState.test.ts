/**
 * Persist layer: redundant writes must not fire same-tab broadcasts, or
 * `useIntegrityGuards` churns persisted/toggles references and can recurse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GUARD_STATE_EVENT,
  GUARD_STATE_KEY,
  togglesContentFingerprint,
  writeGuardState,
} from "./guardState";

describe("guardState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.removeItem(GUARD_STATE_KEY);
    vi.restoreAllMocks();
  });

  it("togglesContentFingerprint is order-insensitive", () => {
    const a = { x: true, y: false } as Record<string, boolean>;
    const b = { y: false, x: true } as Record<string, boolean>;
    expect(togglesContentFingerprint(a)).toBe(togglesContentFingerprint(b));
  });

  it("writeGuardState no-ops second write when toggle map unchanged", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");

    writeGuardState({ a: true, b: false });
    const firstCount = dispatch.mock.calls.filter(
      (c) => (c[0] as CustomEvent)?.type === GUARD_STATE_EVENT,
    ).length;

    writeGuardState({ b: false, a: true });
    const secondCount = dispatch.mock.calls.filter(
      (c) => (c[0] as CustomEvent)?.type === GUARD_STATE_EVENT,
    ).length;

    expect(secondCount).toBe(firstCount);
  });

  it("writeGuardState still writes after toggle values actually change", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");

    writeGuardState({ a: true });
    writeGuardState({ a: false });

    const fires = dispatch.mock.calls.filter(
      (c) => (c[0] as CustomEvent)?.type === GUARD_STATE_EVENT,
    );
    expect(fires.length).toBeGreaterThanOrEqual(2);
  });
});
