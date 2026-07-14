#!/usr/bin/env node
// 【做什么】根据修改路径列表与 .ai/policy.yaml 计算最终风险等级（CLI 诊断工具）
// 【何时跑】维护者本地手动；无 Workflow 自动调用
import { readFile } from "node:fs/promises";

import { loadPolicy, requiredRisk } from "./lib/policy.mjs";

const [proposedRisk, pathsFile, policyFile = ".ai/policy.yaml"] =
  process.argv.slice(2);
if (!proposedRisk || !pathsFile) {
  throw new Error(
    "Usage: evaluate-risk.mjs <R0|R1|R2|R3> <paths-file> [policy-file]",
  );
}

const paths = (await readFile(pathsFile, "utf8"))
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

////////////////////////////////////////////////////
// 将模型建议风险与实际修改路径合并计算；策略只能上调风险，不能被模型降级
////////////////////////////////////////////////////
const policy = await loadPolicy(policyFile);
const riskLevel = requiredRisk(policy, paths, proposedRisk);

process.stdout.write(`${JSON.stringify({ proposedRisk, riskLevel, paths })}\n`);
