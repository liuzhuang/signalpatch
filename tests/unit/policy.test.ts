import { describe, expect, it } from "vitest";

import {
  globToRegExp,
  policyViolations,
  requiredRisk,
  requiresRiskEscalation,
  riskRank,
} from "../../scripts/ai/lib/policy.mjs";

const policy = {
  risk_rules: {
    R0: ["**/*.md"],
    R1: ["src/**"],
    R2: [".github/workflows/**", ".ai/**"],
    R3: ["**/*secret*"],
  },
  protected_paths: [".github/workflows/**", ".ai/policy.yaml"],
};

describe("deterministic policy", () => {
  it("matches recursive and file globs", () => {
    expect(globToRegExp("src/**").test("src/app/page.tsx")).toBe(true);
    expect(globToRegExp("**/*.md").test("README.md")).toBe(true);
    expect(globToRegExp("**/*.md").test("docs/runbook.md")).toBe(true);
  });

  it("raises but never lowers the proposed risk", () => {
    expect(requiredRisk(policy, ["src/app/page.tsx"], "R0")).toBe("R1");
    expect(requiredRisk(policy, ["README.md"], "R2")).toBe("R2");
    expect(requiredRisk(policy, ["config/secret.txt"], "R1")).toBe("R3");
    expect(riskRank("R2")).toBeGreaterThan(riskRank("R1"));
    expect(requiresRiskEscalation("R1", "R2")).toBe(true);
    expect(requiresRiskEscalation("R2", "R2")).toBe(false);
  });

  it("rejects paths outside the contract and protected paths", () => {
    expect(
      policyViolations(
        policy,
        ["src/lib/status.ts", ".ai/policy.yaml"],
        ["src/**", ".ai/**"],
        "R1",
      ),
    ).toEqual([{ type: "protected-path", path: ".ai/policy.yaml" }]);
    expect(policyViolations(policy, ["README.md"], ["src/**"], "R0")).toEqual([
      { type: "outside-allowed-paths", path: "README.md" },
    ]);
  });
});
