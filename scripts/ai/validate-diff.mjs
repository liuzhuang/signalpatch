#!/usr/bin/env node
// 【做什么】检查 git diff：是否在 Contract 允许路径内、是否触碰保护路径、风险是否被上调
// 【何时跑】issue-delivery build/publish；pr-outcome repair/publish-repair
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  loadPolicy,
  policyViolations,
  requiredRisk,
  requiresRiskEscalation,
} from "./lib/policy.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const base = option("--base", "HEAD");
const contractPath = option("--contract");
const policyPath = option("--policy", ".ai/policy.yaml");
if (!contractPath) {
  throw new Error("Usage: validate-diff.mjs --contract <file> [--base <ref>]");
}

const contract = JSON.parse(await readFile(contractPath, "utf8"));
const policy = await loadPolicy(policyPath);

////////////////////////////////////////////////////
// 只检查相对基准提交发生变化的路径，随后核对 Contract 范围、保护路径与风险等级
////////////////////////////////////////////////////
const output = execFileSync("git", ["diff", "--name-only", base, "--"], {
  encoding: "utf8",
});
const paths = output
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);
const riskLevel = requiredRisk(policy, paths, contract.riskLevel);
const violations = policyViolations(
  policy,
  paths,
  contract.allowedPaths,
  riskLevel,
);

////////////////////////////////////////////////////
// 即使路径本身允许修改，实际风险高于 Contract 声明时仍拒绝继续自动执行
////////////////////////////////////////////////////
if (requiresRiskEscalation(contract.riskLevel, riskLevel)) {
  violations.push({
    type: "risk-escalation-required",
    proposedRisk: contract.riskLevel,
    requiredRisk: riskLevel,
  });
}

const result = { valid: violations.length === 0, paths, riskLevel, violations };
process.stdout.write(`${JSON.stringify(result)}\n`);
if (!result.valid) {
  process.exitCode = 1;
}
