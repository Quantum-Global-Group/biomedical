import { describe, it, expect } from "vitest";
import { getRunPathSelection } from "./runPath";

describe("getRunPathSelection", () => {
  it("defaults to quick mode and the hybrid family", () => {
    const sel = getRunPathSelection();
    expect(sel.mode.id).toBe("quick");
    expect(sel.family.id).toBe("hybrid");
    expect(sel.family.preset).toBe("Hybrid QSVC");
  });

  it("falls back to defaults when given unknown ids", () => {
    const sel = getRunPathSelection({
      mode: "nope" as never,
      family: "alsoNope" as never,
    });
    expect(sel.mode.id).toBe("quick");
    expect(sel.family.id).toBe("hybrid");
  });

  it("respects an explicit classical custom choice", () => {
    const sel = getRunPathSelection({ mode: "custom", family: "classical" });
    expect(sel.mode.id).toBe("custom");
    expect(sel.family.id).toBe("classical");
    expect(sel.summary).toMatch(/Custom mode/);
  });

  it("appends the quick-mode tagline only when in quick mode", () => {
    expect(getRunPathSelection({ mode: "quick" }).summary).toMatch(
      /Quick mode keeps default shots/,
    );
    expect(
      getRunPathSelection({ mode: "custom", family: "quantum" }).summary,
    ).not.toMatch(/Quick mode/);
  });
});
