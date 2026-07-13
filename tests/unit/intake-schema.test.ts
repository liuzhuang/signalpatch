import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const bundled = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "scripts/ai/bundle-schema.mjs",
      ".ai/schemas/intake-output.schema.json",
      ".ai/schemas/issue-contract.schema.json",
    ],
    { encoding: "utf8" },
  ),
);
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
  bundled,
);
const issueContract = JSON.parse(
  readFileSync(".ai/schemas/issue-contract.schema.json", "utf8"),
);

describe("Intake structured output schema", () => {
  it("keeps the union below an object root", () => {
    expect(bundled.type).toBe("object");
    expect(bundled.allOf).toBeUndefined();
    expect(bundled.properties.result.anyOf).toHaveLength(2);
  });

  it("accepts NEEDS_EVIDENCE and rejects SPEC_READY without a contract", () => {
    expect(
      validate({
        result: {
          status: "NEEDS_EVIDENCE",
          reason: "A concrete reproduction is missing.",
          feedbackReferences: ["feedback:example"],
          missingEvidence: ["Exact failing input"],
        },
      }),
    ).toBe(true);
    expect(
      validate({
        result: {
          status: "SPEC_READY",
          reason: "Ready.",
          feedbackReferences: ["feedback:example"],
        },
      }),
    ).toBe(false);
  });

  it("keeps allowed paths relative and traversal-free without lookaround", () => {
    const pattern = new RegExp(
      issueContract.properties.allowedPaths.items.pattern,
    );
    expect(pattern.test("src/app/[trackingId]/route.ts")).toBe(true);
    expect(pattern.test(".github/workflows/pr-gate.yml")).toBe(true);
    expect(pattern.test("/absolute/path.ts")).toBe(false);
    expect(pattern.test("src/../secret.ts")).toBe(false);
    expect(pattern.test("src/**/*.ts")).toBe(false);
  });
});
