#!/usr/bin/env node
// 【做什么】阻止未通过 Codex 本地门禁的 Builder/Repair 结果进入 PR 发布
// 【何时跑】Issue Delivery 或 PR Outcome 在创建或更新 PR 前
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

async function loadJson(valueOrPath) {
  return typeof valueOrPath === "string"
    ? JSON.parse(await readFile(valueOrPath, "utf8"))
    : valueOrPath;
}

export async function assertPublishableDeliveryResult(
  resultOrPath,
  { expectedStage, contractOrPath } = {},
) {
  if (!["build", "repair"].includes(expectedStage)) {
    throw new Error(
      `expected delivery stage must be "build" or "repair"; received ${JSON.stringify(expectedStage)}`,
    );
  }
  const [result, contract] = await Promise.all([
    loadJson(resultOrPath),
    loadJson(contractOrPath),
  ]);
  if (result?.stage !== expectedStage) {
    throw new Error(
      `delivery result stage must match expected stage ${JSON.stringify(expectedStage)}; received ${JSON.stringify(result?.stage)}`,
    );
  }
  if (result.decision !== "APPROVE") {
    throw new Error(
      `delivery result decision must be "APPROVE"; received ${JSON.stringify(result.decision)}`,
    );
  }
  if (!["R0", "R1", "R2", "R3"].includes(contract?.riskLevel)) {
    throw new Error("Contract riskLevel must be one of R0, R1, R2, or R3");
  }
  if (result.riskLevel !== contract.riskLevel) {
    throw new Error(
      `delivery result riskLevel must match Contract riskLevel ${JSON.stringify(contract.riskLevel)}; received ${JSON.stringify(result.riskLevel)}`,
    );
  }
  if (!Array.isArray(result.findings)) {
    throw new Error("delivery result findings must be an array");
  }
  const blockingFindings = result.findings.filter((finding) =>
    ["P0", "P1"].includes(finding.severity),
  );
  if (blockingFindings.length > 0) {
    const details = blockingFindings
      .map((finding) => `${finding.severity}:${finding.title}`)
      .join(", ");
    throw new Error(
      `delivery result must not approve with P0 or P1 findings: ${details}`,
    );
  }
  if (!Array.isArray(result.verification) || result.verification.length === 0) {
    throw new Error("delivery result verification must be a non-empty array");
  }
  const blockedChecks = result.verification.filter((entry) =>
    ["failed", "not-run"].includes(entry.status),
  );
  if (blockedChecks.length > 0) {
    const details = blockedChecks
      .map((entry) => `${JSON.stringify(entry.command)}=${entry.status}`)
      .join(", ");
    throw new Error(
      `delivery result verification must not contain failed or not-run checks: ${details}`,
    );
  }
  for (const command of ["pnpm verify", "pnpm build"]) {
    const passed = result.verification.some(
      (entry) => entry.command === command && entry.status === "passed",
    );
    if (!passed) {
      throw new Error(
        `delivery result verification is missing passed command: ${JSON.stringify(command)}`,
      );
    }
  }
  return result;
}

async function main() {
  const [expectedStage, contractPath, resultPath] = process.argv.slice(2);
  if (!expectedStage || !contractPath || !resultPath) {
    throw new Error(
      "Usage: require-delivery-approval.mjs <build|repair> <issue-contract.json> <delivery-result.json>",
    );
  }
  const result = await assertPublishableDeliveryResult(resultPath, {
    expectedStage,
    contractOrPath: contractPath,
  });
  process.stdout.write(
    `${JSON.stringify({ allowed: true, stage: result.stage, riskLevel: result.riskLevel })}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
