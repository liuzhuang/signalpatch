import { describe, expect, it } from "vitest";

import { composeRepairEvidence } from "../../scripts/ai/compose-repair-evidence.mjs";

describe("composeRepairEvidence", () => {
  const failure = {
    fingerprint: "failure-fingerprint",
    summary: "Require approval exited with code 1",
    truncated: false,
  };

  it("preserves the bounded failure summary and projects actionable Reviewer findings", () => {
    const result = composeRepairEvidence(failure, {
      stage: "review",
      summary: "The regression validator is incomplete.",
      changedPaths: ["tests/smoke/app.spec.ts"],
      verification: [
        {
          command: "git show --check",
          status: "passed",
          detail: "No whitespace errors.",
          ignored: "nested extra field",
        },
      ],
      riskLevel: "R1",
      decision: "REQUEST_CHANGES",
      findings: [
        {
          severity: "P2",
          title: "About copy is not asserted",
          evidence: "The test only checks the nested strong element.",
          ignored: "nested extra field",
        },
      ],
      ignored: "must not be copied into Repair evidence",
    });

    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.fingerprint).not.toBe(failure.fingerprint);
    expect(result).toEqual({
      fingerprint: result.fingerprint,
      summary: failure.summary,
      truncated: failure.truncated,
      reviewer: {
        stage: "review",
        summary: "The regression validator is incomplete.",
        changedPaths: ["tests/smoke/app.spec.ts"],
        verification: [
          {
            command: "git show --check",
            status: "passed",
            detail: "No whitespace errors.",
          },
        ],
        riskLevel: "R1",
        decision: "REQUEST_CHANGES",
        findings: [
          {
            severity: "P2",
            title: "About copy is not asserted",
            evidence: "The test only checks the nested strong element.",
          },
        ],
      },
    });
    expect(composeRepairEvidence(failure, result.reviewer)).toEqual(result);
  });

  it("keeps non-review failures usable when no Reviewer artifact exists", () => {
    expect(composeRepairEvidence(failure)).toEqual({
      ...failure,
      reviewer: null,
    });
  });

  it("accepts empty verification detail allowed by the delivery schema", () => {
    const result = composeRepairEvidence(failure, {
      stage: "review",
      summary: "A finding needs repair.",
      changedPaths: [],
      verification: [{ command: "pnpm verify", status: "not-run", detail: "" }],
      riskLevel: "R1",
      decision: "REQUEST_CHANGES",
      findings: [
        { severity: "P2", title: "Missing assertion", evidence: "AC-2" },
      ],
    });

    expect(result).toMatchObject({
      reviewer: { verification: [{ detail: "" }] },
    });
  });

  it("keeps the fingerprint stable when non-root-cause fields or finding order change", () => {
    const reviewer = {
      stage: "review",
      summary: "First summary.",
      changedPaths: ["a.ts"],
      verification: [
        { command: "pnpm verify", status: "passed", detail: "green" },
      ],
      riskLevel: "R1",
      decision: "REQUEST_CHANGES",
      findings: [
        { severity: "P2", title: "Second finding", evidence: "line 20" },
        { severity: "P1", title: "First finding", evidence: "line 10" },
      ],
    };
    const first = composeRepairEvidence(failure, reviewer);
    const second = composeRepairEvidence(failure, {
      ...reviewer,
      summary: "Unrelated summary changed.",
      changedPaths: ["different.ts"],
      verification: [{ command: "pnpm build", status: "not-run", detail: "" }],
      findings: [...reviewer.findings].reverse().map((finding) => ({
        ...finding,
        title: `  ${finding.title.replace(" ", "   ")}  `,
      })),
    });

    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("does not change an application failure fingerprint for an approving review", () => {
    const result = composeRepairEvidence(failure, {
      stage: "review",
      summary: "No blocking findings.",
      changedPaths: ["src/app/page.tsx"],
      verification: [
        { command: "pnpm verify", status: "passed", detail: "green" },
      ],
      riskLevel: "R1",
      decision: "APPROVE",
      findings: [],
    });

    expect(result.fingerprint).toBe(failure.fingerprint);
  });
});
