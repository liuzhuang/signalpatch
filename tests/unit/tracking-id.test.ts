import { describe, expect, it } from "vitest";

import { normalizeTrackingId } from "@/lib/tracking-id";

describe("Tracking ID", () => {
  it("keeps an exact Tracking ID unchanged", () => {
    expect(normalizeTrackingId("2a97cf48-c9c0-4b19-a7ac-fcfb7592de31")).toBe(
      "2a97cf48-c9c0-4b19-a7ac-fcfb7592de31",
    );
  });
});
