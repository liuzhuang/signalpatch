import { describe, expect, it } from "vitest";

import { repairStatusForRun } from "../../scripts/controllers/lib/run-status.mjs";

describe("Automation Run status projection", () => {
  it.each([
    ["build", "SUCCEEDED", "BUILDING"],
    ["preview", "SUCCEEDED", "VERIFYING"],
    ["repair", "SUCCEEDED", "REPAIRING"],
    ["production", "SUCCEEDED", "RELEASED"],
    ["production", "HUMAN_REQUIRED", "HUMAN_REQUIRED"],
  ])("maps %s/%s to %s", (stage, state, expected) => {
    expect(repairStatusForRun(stage, state)).toBe(expected);
  });

  it("does not invent a public status for an unknown stage", () => {
    expect(repairStatusForRun("analysis", "SUCCEEDED")).toBeNull();
    expect(repairStatusForRun("production", "FAILED")).toBeNull();
  });
});
