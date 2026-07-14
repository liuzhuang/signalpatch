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

  it("starts Delivery when an Issue becomes processed", () => {
    const delivery = workflow(".github/workflows/issue-delivery.yml");
    const conversationPublisher = workflow(
      ".github/workflows/publish-conversation-issues.yml",
    );

    expect(delivery.on.issues.types).toEqual(["labeled"]);
    expect(delivery.on.workflow_dispatch).toBeDefined();
    expect(delivery.jobs.prepare.if).toContain("content:processed");
    const progressCheckout = delivery.jobs["mark-codex-started"].steps.find(
      (step: { uses?: string; with?: Record<string, unknown> }) =>
        String(step.uses ?? "").startsWith("actions/checkout@"),
    );
    expect(progressCheckout?.with?.["persist-credentials"]).toBe(false);
    expect(conversationPublisher.permissions.actions).toBeUndefined();
    expect(conversationPublisher.jobs.publish.concurrency.group).toBe(
      "issue-publisher",
    );
  });

  it("keeps manual R2 PRs in the owner-only codex lane", () => {
    const gate = workflow(".github/workflows/pr-gate.yml");
    const outcome = workflow(".github/workflows/pr-outcome.yml");

    expect(gate.jobs.trust.steps[1].run).toContain("^codex/");
    expect(gate.jobs.trust.steps[1].run).toContain(
      '"$PR_AUTHOR" == "$REPOSITORY_OWNER"',
    );
    expect(gate.jobs["manual-independent-review"].environment).toBe(
      "r2-approval",
    );
    expect(gate.jobs["manual-independent-review"].name).toBe(
      "independent-review",
    );
    expect(outcome.jobs.finalize.if).toContain(
      "needs.trust.outputs.mode == 'automation'",
    );
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
