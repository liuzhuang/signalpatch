import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

function workflow(path: string) {
  return parse(readFileSync(path, "utf8"));
}

function stepScript(path: string, job: string, name: string) {
  return workflow(path).jobs[job].steps.find(
    (step: { name?: string }) => step.name === name,
  ).run as string;
}

describe("delivery workflow stage boundaries", () => {
  it.each([
    [".github/workflows/issue-delivery.yml", "build", "Enforce paths and risk"],
    [".github/workflows/pr-outcome.yml", "repair", "Validate Repair patch"],
  ])("includes untracked files before validating %s", (path, job, name) => {
    const script = stepScript(path, job, name);
    const expose = script.indexOf("git add --intent-to-add -- .");

    expect(expose).toBeGreaterThanOrEqual(0);
    expect(expose).toBeLessThan(script.indexOf("validate-diff.mjs"));
    expect(expose).toBeLessThan(script.indexOf("git diff --binary"));
  });

  it("does not rerun PR Gate when an accepted Draft PR becomes Ready", () => {
    expect(
      workflow(".github/workflows/pr-gate.yml").on.pull_request.types,
    ).toEqual(["opened", "synchronize", "reopened"]);
  });

  it("limits independent review to evidence available before Preview", () => {
    const guidance = readFileSync(
      ".agents/skills/issue-delivery/references/reviewer.md",
      "utf8",
    );

    expect(guidance).toContain("Do not require Preview or Production evidence");
    expect(guidance).toContain("Do not run write-producing verification");
  });
});
