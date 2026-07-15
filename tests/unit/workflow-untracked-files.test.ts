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

  it.each([
    [
      ".github/workflows/issue-delivery.yml",
      "build",
      "Enforce paths and risk",
      ".ai/runs/delivery/contract.json",
    ],
    [
      ".github/workflows/pr-outcome.yml",
      "repair",
      "Validate Repair patch",
      ".ai/runs/outcome/contract.json",
    ],
  ])(
    "rejects unverified Codex output before publishing %s",
    (path, job, name, contractPath) => {
      const script = stepScript(path, job, name);
      const validateResult = script.indexOf("require-delivery-approval.mjs");
      const semanticGate = script.slice(
        validateResult,
        script.indexOf("validate-diff.mjs"),
      );

      expect(validateResult).toBeGreaterThan(
        script.indexOf("validate-json.mjs"),
      );
      expect(validateResult).toBeLessThan(script.indexOf("validate-diff.mjs"));
      expect(validateResult).toBeLessThan(script.indexOf("git diff --binary"));
      expect(semanticGate).toContain(job);
      expect(semanticGate).toContain(contractPath);
    },
  );

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
    expect(delivery.concurrency.group).toContain("github.run_id");
    expect(delivery.concurrency.group).toContain("content:processed");
    expect(
      delivery.jobs.prepare.steps.find(
        (step: { id?: string }) => step.id === "context",
      ).run,
    ).toContain("--require-ready");
    expect(
      delivery.jobs["mark-codex-started"].steps.find(
        (step: { id?: string }) => step.id === "start",
      ).run,
    ).toContain("issue-progress.mjs");
    expect(
      delivery.jobs["mark-codex-started"].steps.find(
        (step: { id?: string }) => step.id === "start",
      ).run,
    ).toContain("$CONTRACT_DIGEST");
    expect(delivery.jobs.prepare.outputs.contract_digest).toContain(
      "contract_digest",
    );
    expect(delivery.jobs.build.if).toContain(
      "needs.mark-codex-started.outputs.started == 'true'",
    );
    const progressCheckout = delivery.jobs["mark-codex-started"].steps.find(
      (step: { uses?: string; with?: Record<string, unknown> }) =>
        String(step.uses ?? "").startsWith("actions/checkout@"),
    );
    expect(progressCheckout?.with?.["persist-credentials"]).toBe(false);
    const finishedCheckout = delivery.jobs["mark-codex-finished"].steps.find(
      (step: { uses?: string; with?: Record<string, unknown> }) =>
        String(step.uses ?? "").startsWith("actions/checkout@"),
    );
    expect(finishedCheckout?.with?.["persist-credentials"]).toBe(false);
    expect(conversationPublisher.permissions.actions).toBeUndefined();
    expect(conversationPublisher.jobs.publish.concurrency).toBeUndefined();
  });

  it("runs Manual Issue Intake from user Issue context events", () => {
    const intake = workflow(".github/workflows/manual-issue-intake.yml");
    const collect = intake.jobs.collect;
    const scanStep = collect.steps.find(
      (step: { id?: string }) => step.id === "scan",
    );
    const scan = scanStep.run as string;

    expect(intake.on.schedule).toBeUndefined();
    expect(intake.on.issues.types).toEqual([
      "opened",
      "edited",
      "labeled",
      "reopened",
    ]);
    expect(intake.on.issue_comment.types).toEqual([
      "created",
      "edited",
      "deleted",
    ]);
    expect(intake.on.workflow_dispatch).toBeDefined();
    expect(intake.concurrency.group).toContain("github.event.issue.number");
    expect(intake.concurrency.group).toContain("github.run_id");
    expect(intake.concurrency.group).toContain("source:manual");
    expect(intake.concurrency.group).toContain("content:raw");
    expect(intake.concurrency["cancel-in-progress"]).toBe(false);
    expect(collect.if).toContain("content:raw");
    expect(collect.if).toContain("content:processed");
    expect(collect.if).toContain("duplicate");
    expect(collect.if).toContain("comment.user.type != 'Bot'");
    expect(collect.if).toContain("github.event.sender.type != 'Bot'");
    expect(collect.if).toContain("github.event.issue.pull_request == null");
    expect(collect.if).toContain("signalpatch-feedback:");
    expect(collect.if).toContain("signalpatch-conversation-request:");
    expect(collect.if).toContain("source:manual");
    expect(scan).toContain("github.event.issue.number");
    expect(scanStep.env.SIGNALPATCH_EVENT_ACTION).toContain(
      "github.event.action",
    );
    expect(scanStep.env.SIGNALPATCH_APP_BOT).toContain(
      "vars.SIGNALPATCH_APP_BOT",
    );
    expect(intake.jobs.publish.concurrency).toBeUndefined();
  });

  it("records failed Builder runs as a user-visible human-required status", () => {
    const delivery = workflow(".github/workflows/issue-delivery.yml");
    const finished = delivery.jobs["mark-codex-finished"];
    const contractDownload = finished.steps.find(
      (step: { name?: string }) =>
        step.name === "Download contract for a failed Builder",
    );
    const finishStep = finished.steps.find(
      (step: { name?: string }) =>
        step.name === "Mark Codex execution finished",
    );
    const statusStep = finished.steps.find(
      (step: { name?: string }) => step.name === "Record failed Builder status",
    );
    const run = statusStep?.run as string;

    expect(contractDownload?.if).toContain("needs.build.result != 'success'");
    expect(contractDownload?.if).toContain("needs.build.result != 'skipped'");
    expect(run).toContain("scripts/controllers/record-run.mjs");
    expect(run).toContain("--stage build");
    expect(run).toContain("--state HUMAN_REQUIRED");
    expect(run).toContain("--contract .ai/runs/delivery/contract.json");
    expect(statusStep?.if).toContain("always()");
    expect(statusStep?.env?.SUPABASE_SERVICE_ROLE_KEY).toContain(
      "secrets.SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(finishStep?.env?.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it("lets Intake infer implementation details for actionable product feedback", () => {
    const skill = readFileSync(".agents/skills/issue-intake/SKILL.md", "utf8");
    const evidence = readFileSync(
      ".agents/skills/issue-intake/references/evidence.md",
      "utf8",
    );

    expect(skill).toContain(
      "Use `NEEDS_EVIDENCE` only when the input is not product feedback",
    );
    expect(skill).toContain("smallest reasonable repository-derived defaults");
    expect(evidence).toContain("官网首页的元素进行居中展示");
    expect(evidence).toContain("return `SPEC_READY` without asking");
  });

  it("binds Feedback publication and Delivery to the exact source reference", () => {
    const publisher = readFileSync(
      "scripts/controllers/intake-publish.mjs",
      "utf8",
    );
    const preparation = readFileSync(
      "scripts/controllers/prepare-issue.mjs",
      "utf8",
    );

    expect(publisher).toContain(
      "contract.source.references[0] !== state.reference",
    );
    expect(preparation).toContain(
      "signalpatch-feedback:${contract.source.references[0]}",
    );
    expect(preparation).toContain('"conversation:explicit-user-confirmation"');
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

  it("requires Builder and Repair to finish local verification before approval", () => {
    const sharedGuidance = readFileSync(
      ".agents/skills/issue-delivery/SKILL.md",
      "utf8",
    );
    const repairGuidance = readFileSync(
      ".agents/skills/issue-delivery/references/repair.md",
      "utf8",
    );

    expect(sharedGuidance).toContain(
      "Do not return `APPROVE` until `pnpm verify` and `pnpm build` both pass",
    );
    expect(sharedGuidance).toContain("separate verification entries");
    expect(repairGuidance).toContain("narrowest reproducible validator");
  });

  it("passes structured Reviewer findings into Repair without tracking pnpm cache files", () => {
    const outcome = workflow(".github/workflows/pr-outcome.yml");
    const collectSteps = outcome.jobs["collect-failure"].steps as Array<{
      id?: string;
      if?: string;
      name?: string;
      uses?: string;
      run?: string;
      with?: Record<string, unknown>;
      "continue-on-error"?: boolean;
    }>;
    const reviewDownload = collectSteps.find(
      (step) => step.name === "Download structured Reviewer evidence",
    );

    expect(reviewDownload?.uses).toContain("actions/download-artifact@");
    expect(reviewDownload?.["continue-on-error"]).toBe(true);
    expect(reviewDownload?.with?.name).toContain("-review");
    expect(reviewDownload?.with?.["run-id"]).toContain("gate_run_id");

    const gate = workflow(".github/workflows/pr-gate.yml");
    const reviewUpload = gate.jobs["independent-review"].steps.find(
      (step: { uses?: string; with?: Record<string, unknown> }) =>
        String(step.uses ?? "").startsWith("actions/upload-artifact@") &&
        String(step.with?.name ?? "").endsWith("-review"),
    );
    expect(reviewUpload?.if).toContain("always()");

    const classify = collectSteps.find((step) => step.id === "classify")
      ?.run as string;
    expect(classify).toContain("compose-repair-evidence.mjs");
    expect(classify).toContain("repair-evidence.json");
    expect(classify).toContain('grep -Fq "Require approval"');
    expect(classify).toContain(
      "[[ ! -s .ai/runs/outcome/reviewer/review.json ]]",
    );
    expect(classify).toContain('kind="evidence-missing"');
    expect(classify).toContain(
      'require("./.ai/runs/outcome/repair-evidence.json").fingerprint',
    );

    const render = stepScript(
      ".github/workflows/pr-outcome.yml",
      "repair",
      "Render Repair prompt",
    );
    expect(render).toContain(
      "--evidence .ai/runs/outcome/repair-evidence.json",
    );

    expect(readFileSync(".gitignore", "utf8")).toContain("/.pnpm-store/");

    const stop = stepScript(
      ".github/workflows/pr-outcome.yml",
      "mark-human-required",
      "Stop the bounded Repair loop",
    );
    const humanRequiredJob = outcome.jobs["mark-human-required"];
    const humanRequiredCheckout = humanRequiredJob.steps.find(
      (step: { uses?: string }) =>
        String(step.uses ?? "").startsWith("actions/checkout@"),
    );
    const humanRequiredStep = humanRequiredJob.steps.find(
      (step: { name?: string }) => step.name === "Stop the bounded Repair loop",
    );
    expect(stop).toContain('--repo "$GITHUB_REPOSITORY"');
    expect(stop).toContain('FAILURE_KIND" == "evidence-missing"');
    expect(outcome.jobs["mark-human-required"].if as string).toContain(
      "failure_kind == 'evidence-missing'",
    );
    expect(classify).toContain('kind="infrastructure-retrying"');
    expect(outcome.jobs["mark-human-required"].if as string).toContain(
      "failure_kind == 'configuration'",
    );
    expect(outcome.jobs["mark-human-required"].if as string).toContain(
      "failure_kind == 'infrastructure'",
    );
    expect(outcome.jobs["mark-human-required"].if as string).toContain(
      "needs.collect-failure.result == 'failure'",
    );
    expect(outcome.jobs["mark-human-required"].if as string).toContain(
      "failure_kind != 'infrastructure-retrying'",
    );
    expect(stop).toContain('COLLECT_RESULT" == "failure"');
    expect(stop).toContain("Failure evidence collection failed");
    expect(stop).toContain('FAILURE_KIND" == "configuration"');
    expect(stop).toContain('FAILURE_KIND" == "infrastructure"');
    expect(stop).toContain("scripts/controllers/record-run.mjs");
    expect(stop).toContain("--state HUMAN_REQUIRED");
    expect(humanRequiredCheckout?.with?.["persist-credentials"]).toBe(false);
    expect(humanRequiredStep?.env?.SUPABASE_SERVICE_ROLE_KEY).toContain(
      "secrets.SUPABASE_SERVICE_ROLE_KEY",
    );
  });
});
