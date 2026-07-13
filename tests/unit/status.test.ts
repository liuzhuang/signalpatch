import { describe, expect, it, vi } from "vitest";

import { findRepairStatus } from "@/lib/status";

describe("Repair Status lookup", () => {
  it("returns the minimal public status contract", async () => {
    const lookup = vi.fn().mockResolvedValue({
      repair_status: "RECEIVED",
      updated_at: "2026-07-13T08:00:00.000Z",
    });

    await expect(findRepairStatus("tracking-id", lookup)).resolves.toEqual({
      trackingId: "tracking-id",
      repairStatus: "RECEIVED",
      updatedAt: "2026-07-13T08:00:00.000Z",
    });
    expect(lookup).toHaveBeenCalledWith("tracking-id");
  });

  it("returns null when the Tracking ID does not exist", async () => {
    await expect(
      findRepairStatus("missing", async () => null),
    ).resolves.toBeNull();
  });
});
