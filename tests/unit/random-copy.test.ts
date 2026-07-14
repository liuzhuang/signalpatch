import { describe, expect, it } from "vitest";

import { HOMEPAGE_COPY, pickRandomCopy } from "@/components/random-copy";

describe("homepage random copy", () => {
  it("selects only maintained non-empty copy", () => {
    expect(HOMEPAGE_COPY.length).toBeGreaterThan(1);
    expect(HOMEPAGE_COPY.every((copy) => copy.trim().length > 0)).toBe(true);
    expect(pickRandomCopy(0)).toBe(HOMEPAGE_COPY[0]);
    expect(pickRandomCopy(0.999999)).toBe(
      HOMEPAGE_COPY[HOMEPAGE_COPY.length - 1],
    );
  });
});
