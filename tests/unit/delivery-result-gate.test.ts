import { describe, expect, it } from "vitest";

import { assertPublishableDeliveryResult } from "../../scripts/ai/require-delivery-approval.mjs";

const contract = { riskLevel: "R1" };
const buildContext = { expectedStage: "build", contractOrPath: contract };

function deliveryResult(overrides = {}) {
  return {
    stage: "build",
    decision: "APPROVE",
    riskLevel: "R1",
    findings: [],
    verification: [
      { command: "pnpm verify", status: "passed", detail: "green" },
    ],
    ...overrides,
  };
}

describe("assertPublishableDeliveryResult", () => {
  it("accepts an approved build result after verify passes", async () => {
    const result = deliveryResult();

    await expect(
      assertPublishableDeliveryResult(result, buildContext),
    ).resolves.toBe(result);
  });

  it("rejects output from a different stage at the Builder boundary", async () => {
    await expect(
      assertPublishableDeliveryResult(
        deliveryResult({ stage: "repair" }),
        buildContext,
      ),
    ).rejects.toThrow(
      'delivery result stage must match expected stage "build"; received "repair"',
    );
  });

  it("rejects a result that does not approve publication", async () => {
    await expect(
      assertPublishableDeliveryResult(
        deliveryResult({ decision: "REQUEST_CHANGES" }),
        buildContext,
      ),
    ).rejects.toThrow(
      'delivery result decision must be "APPROVE"; received "REQUEST_CHANGES"',
    );
  });

  it("rejects a model-reported risk that differs from the Contract", async () => {
    await expect(
      assertPublishableDeliveryResult(
        deliveryResult({ riskLevel: "R2" }),
        buildContext,
      ),
    ).rejects.toThrow(
      'delivery result riskLevel must match Contract riskLevel "R1"; received "R2"',
    );
  });

  it.each(["P0", "P1"])(
    "rejects an approved result containing a %s finding",
    async (severity) => {
      await expect(
        assertPublishableDeliveryResult(
          deliveryResult({
            findings: [{ severity, title: "blocker", evidence: "evidence" }],
          }),
          buildContext,
        ),
      ).rejects.toThrow(
        `delivery result must not approve with P0 or P1 findings: ${severity}:blocker`,
      );
    },
  );

  it("rejects an empty verification record", async () => {
    await expect(
      assertPublishableDeliveryResult(
        deliveryResult({ verification: [] }),
        buildContext,
      ),
    ).rejects.toThrow("delivery result verification must be a non-empty array");
  });

  it("rejects a result containing a failed check", async () => {
    await expect(
      assertPublishableDeliveryResult(
        deliveryResult({
          verification: [
            { command: "pnpm verify", status: "passed" },
            { command: "pnpm test", status: "failed" },
          ],
        }),
        buildContext,
      ),
    ).rejects.toThrow(
      'delivery result verification must not contain failed or not-run checks: "pnpm test"=failed',
    );
  });

  it("rejects a result containing a not-run check", async () => {
    await expect(
      assertPublishableDeliveryResult(
        deliveryResult({
          verification: [
            { command: "pnpm verify", status: "passed" },
            { command: "pnpm test:smoke", status: "not-run" },
          ],
        }),
        buildContext,
      ),
    ).rejects.toThrow(
      'delivery result verification must not contain failed or not-run checks: "pnpm test:smoke"=not-run',
    );
  });

  it.each([
    {
      verification: [{ command: "pnpm build", status: "passed" }],
      missing: "pnpm verify",
    },
    {
      verification: [{ command: "pnpm verify --filter app", status: "passed" }],
      missing: "pnpm verify",
    },
  ])(
    "requires the exact passed command $missing",
    async ({ verification, missing }) => {
      await expect(
        assertPublishableDeliveryResult(
          deliveryResult({ verification }),
          buildContext,
        ),
      ).rejects.toThrow(
        `delivery result verification is missing passed command: ${JSON.stringify(missing)}`,
      );
    },
  );
});
