import { describe, expect, it } from "vitest";

import {
  contractIssueBody,
  findDuplicateIssue,
  findMarkedIssue,
  issueLabels,
  problemFingerprint,
} from "../../scripts/controllers/lib/issue-lifecycle.mjs";

const contract = {
  problemSummary: "Tracking ID lookup fails",
  actualBehavior: " A copied ID returns not found. ",
  expectedBehavior: "A copied ID resolves.",
  riskLevel: "R1",
};

describe("Issue lifecycle", () => {
  it("keeps one Issue raw until the Contract is promoted", () => {
    expect(issueLabels.raw()).toEqual(["content:raw"]);
    expect(issueLabels.processed(contract)).toEqual([
      "content:processed",
      "ai:ready",
      "risk:r1",
    ]);
  });

  it("uses a stable Problem fingerprint in the Issue body", () => {
    const fingerprint = problemFingerprint(contract);
    const body = contractIssueBody(contract, "signalpatch-feedback:example");

    expect(body).toContain(`signalpatch-problem:${fingerprint}`);
    expect(body).toContain("signalpatch-feedback:example");
    expect(
      problemFingerprint({
        ...contract,
        problemSummary: " tracking   id LOOKUP fails ",
      }),
    ).toBe(fingerprint);
  });

  it("finds the oldest processed duplicate and ignores raw Issues", () => {
    const fingerprint = problemFingerprint(contract);
    const issues = [
      {
        number: 14,
        title: "[SignalPatch] Tracking ID lookup fails",
        body: `<!-- signalpatch-problem:${fingerprint} -->`,
        labels: [{ name: "content:processed" }],
      },
      {
        number: 12,
        title: "[SignalPatch] Tracking ID lookup fails",
        body: [
          "<!-- signalpatch-contract:start -->",
          "```json",
          JSON.stringify(contract),
          "```",
          "<!-- signalpatch-contract:end -->",
        ].join("\n"),
        labels: [{ name: "ai:done" }],
      },
      {
        number: 10,
        title: "[SignalPatch] Tracking ID lookup fails",
        body: `<!-- signalpatch-problem:${fingerprint} -->`,
        labels: [{ name: "content:raw" }],
      },
    ];

    expect(findDuplicateIssue(issues, contract, 15)?.number).toBe(12);
    expect(findDuplicateIssue(issues, contract, 12)?.number).toBe(14);
  });

  it("does not trust an idempotency marker in an unlabeled public Issue", () => {
    const marker = "signalpatch-feedback:feedback:example";
    const issues = [
      { number: 1, body: `<!-- ${marker} -->`, labels: [] },
      {
        number: 2,
        body: `<!-- ${marker} -->`,
        labels: [{ name: "content:raw" }],
      },
    ];

    expect(findMarkedIssue(issues, marker)?.number).toBe(2);
  });
});
